import {
  Db,
  MongoClient,
  MongoClientOptions,
  ClientSession,
  TransactionOptions,
} from "mongodb";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MongoEasyConfig = {
  uri: string;
  dbName?: string;
  options?: MongoClientOptions;
};

export type TransactionFn<T> = (session: ClientSession) => Promise<T>;

export type RetryOptions = {
  retries?: number;
  delayMs?: number;
  factor?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
};

export type ConnectResult = { client: MongoClient; db: Db };

// ─── Errors ───────────────────────────────────────────────────────────────────

export class MongoEasyError extends Error {
  constructor(message: string) {
    super(`MongoEasyManager: ${message}`);
    this.name = "MongoEasyError";
  }
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export class MongoEasyManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoEasyConfig | null = null;
  private connectPromise: Promise<ConnectResult> | null = null;

  constructor(config?: MongoEasyConfig) {
    if (config) this.config = config;
  }

  setConfig(config: MongoEasyConfig): void {
    if (this.isConnected()) {
      throw new MongoEasyError(
        "Cannot change config while connected. Call disconnect() first."
      );
    }
    this.config = config;
  }

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  async connect(config?: MongoEasyConfig): Promise<ConnectResult> {
    if (config) {
      if (this.isConnected()) {
        throw new MongoEasyError(
          "Cannot change config while connected. Call disconnect() first."
        );
      }
      this.config = config;
    }

    if (!this.config?.uri) {
      throw new MongoEasyError(
        "Missing config. Provide uri (and optional dbName)."
      );
    }

    // Already connected — return immediately
    if (this.client && this.db) {
      return { client: this.client, db: this.db };
    }

    // Concurrent calls share the same promise to avoid double-connecting
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.createConnection().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private async createConnection(): Promise<ConnectResult> {
    const config = this.config!;
    const client = new MongoClient(config.uri, config.options);

    try {
      await client.connect();
    } catch (error) {
      await client.close().catch(() => {});
      throw error;
    }

    const dbName = config.dbName ?? this.extractDbName(config.uri);
    const db = client.db(dbName);

    this.client = client;
    this.db = db;

    return { client, db };
  }

  getClient(): MongoClient {
    if (!this.client) {
      throw new MongoEasyError("Not connected. Call connect() first.");
    }
    return this.client;
  }

  getDb(): Db {
    if (!this.db) {
      throw new MongoEasyError("Not connected. Call connect() first.");
    }
    return this.db;
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.db = null;

    if (client) {
      await client.close();
    }
  }

  async healthcheck(): Promise<boolean> {
    try {
      await this.getDb().command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async withTransaction<T>(
    fn: TransactionFn<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const client = this.getClient();
    const session = client.startSession();

    try {
      let result: T | undefined;

      await session.withTransaction(async () => {
        result = await fn(session);
      }, options);

      // withTransaction aborts and returns undefined on transient errors;
      // expose that explicitly rather than silently returning undefined.
      if (result === undefined) {
        throw new MongoEasyError(
          "Transaction completed but returned no result. " +
            "It may have been aborted."
        );
      }

      return result;
    } finally {
      await session.endSession();
    }
  }

  async retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      retries = 3,
      delayMs = 200,
      factor = 2,
      isRetryable = () => true,
      onRetry,
    } = options;

    let attempt = 0;
    let wait = delayMs;

    while (attempt <= retries) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === retries || !isRetryable(error)) {
          throw error;
        }

        onRetry?.(error, attempt + 1);

        await this.sleep(wait);
        wait = Math.floor(wait * factor);
        attempt++;
      }
    }

    // This line should never be reached, but TypeScript needs it
    throw new Error("Maximum retries exceeded");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractDbName(uri: string): string | undefined {
    try {
      const pathname = new URL(uri).pathname.replace("/", "").trim();
      return pathname.length ? pathname : undefined;
    } catch {
      return undefined;
    }
  }
}

// ─── Default singleton ────────────────────────────────────────────────────────

const defaultManager = new MongoEasyManager();

export const setConfig = (config: MongoEasyConfig): void =>
  defaultManager.setConfig(config);
export const isConnected = (): boolean => defaultManager.isConnected();
export const connect = (config?: MongoEasyConfig): Promise<ConnectResult> =>
  defaultManager.connect(config);
export const getClient = (): MongoClient => defaultManager.getClient();
export const getDb = (): Db => defaultManager.getDb();
export const disconnect = (): Promise<void> => defaultManager.disconnect();
export const healthcheck = (): Promise<boolean> => defaultManager.healthcheck();
export const withTransaction = <T>(
  fn: TransactionFn<T>,
  options?: TransactionOptions
): Promise<T> => defaultManager.withTransaction(fn, options);
export const retry = <T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> => defaultManager.retry(fn, options);

export const createMongoManager = (config?: MongoEasyConfig): MongoEasyManager =>
  new MongoEasyManager(config);

export type { Db, MongoClient, MongoClientOptions, ClientSession, TransactionOptions };