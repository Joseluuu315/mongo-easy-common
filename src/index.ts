import {
  Db,
  MongoClient,
  MongoClientOptions,
  ClientSession,
  TransactionOptions
} from "mongodb";

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
};

export class MongoEasyManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoEasyConfig | null = null;

  constructor(config?: MongoEasyConfig) {
    if (config) this.config = config;
  }

  setConfig(config: MongoEasyConfig): void {
    this.config = config;
  }

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  async connect(config?: MongoEasyConfig): Promise<{ client: MongoClient; db: Db }> {
    if (config) this.config = config;
    if (!this.config) {
      throw new Error("MongoEasyManager: missing config. Provide uri (and optional dbName)." );
    }

    if (this.client && this.db) {
      return { client: this.client, db: this.db };
    }

    const client = new MongoClient(this.config.uri, this.config.options);
    await client.connect();

    const dbName = this.config.dbName ?? this.extractDbName(this.config.uri);
    const db = client.db(dbName);

    this.client = client;
    this.db = db;

    return { client, db };
  }

  getClient(): MongoClient {
    if (!this.client) {
      throw new Error("MongoEasyManager: not connected. Call connect() first.");
    }
    return this.client;
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("MongoEasyManager: not connected. Call connect() first.");
    }
    return this.db;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    this.client = null;
    this.db = null;
  }

  async healthcheck(): Promise<boolean> {
    const db = this.getDb();
    try {
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async withTransaction<T>(fn: TransactionFn<T>, options?: TransactionOptions): Promise<T> {
    const client = this.getClient();
    const session = client.startSession();

    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await fn(session);
      }, options);

      if (result === undefined) {
        throw new Error("MongoEasyManager: transaction returned undefined result.");
      }

      return result;
    } finally {
      await session.endSession();
    }
  }

  async retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const retries = options.retries ?? 3;
    const delayMs = options.delayMs ?? 200;
    const factor = options.factor ?? 2;
    const isRetryable = options.isRetryable ?? (() => true);

    let attempt = 0;
    let wait = delayMs;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (attempt >= retries || !isRetryable(error)) {
          throw error;
        }
        await this.sleep(wait);
        wait = Math.floor(wait * factor);
        attempt += 1;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractDbName(uri: string): string | undefined {
    try {
      const parsed = new URL(uri);
      const dbName = parsed.pathname.replace("/", "").trim();
      return dbName.length ? dbName : undefined;
    } catch {
      return undefined;
    }
  }
}

const defaultManager = new MongoEasyManager();

export const setConfig = (config: MongoEasyConfig): void => defaultManager.setConfig(config);
export const isConnected = (): boolean => defaultManager.isConnected();
export const connect = (config?: MongoEasyConfig) => defaultManager.connect(config);
export const getClient = (): MongoClient => defaultManager.getClient();
export const getDb = (): Db => defaultManager.getDb();
export const disconnect = (): Promise<void> => defaultManager.disconnect();
export const healthcheck = (): Promise<boolean> => defaultManager.healthcheck();
export const withTransaction = <T>(fn: TransactionFn<T>, options?: TransactionOptions) =>
  defaultManager.withTransaction(fn, options);
export const retry = <T>(fn: () => Promise<T>, options?: RetryOptions) =>
  defaultManager.retry(fn, options);

export const createMongoManager = (config?: MongoEasyConfig) => new MongoEasyManager(config);

export type { Db, MongoClient, MongoClientOptions, ClientSession, TransactionOptions };
