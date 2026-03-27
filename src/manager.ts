import {
  Db,
  MongoClient,
  Collection,
  TransactionOptions,
  Document,
} from "mongodb";
import { MongoEasyError } from "./errors";
import { validateRequired, sanitizeString } from "./utils";
import {
  MongoEasyConfig,
  ConnectResult,
  TransactionFn,
  RetryOptions,
} from "./types";
import { EasyCollection } from "./collection";

/**
 * MongoDB connection manager with transaction support and retry logic.
 * Provides a clean API for managing MongoDB connections and operations.
 */
export class MongoEasyManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoEasyConfig | null = null;
  private connectPromise: Promise<ConnectResult> | null = null;

  constructor(config?: MongoEasyConfig) {
    if (config) {
      this.setConfig(config);
    }
  }

  /**
   * Set or update the configuration for this manager instance.
   * @param config - MongoDB configuration
   * @throws MongoEasyError if already connected
   */
  setConfig(config: MongoEasyConfig): void {
    if (this.isConnected()) {
      throw new MongoEasyError(
        "Cannot change config while connected. Call disconnect() first."
      );
    }
    
    // Validate configuration
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Check if the manager is currently connected to MongoDB.
   * @returns Whether connected to MongoDB
   */
  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  /**
   * Connect to MongoDB using the current or provided configuration.
   * @param config - Optional configuration override
   * @returns Connection result with client and database instances
   * @throws MongoEasyError if configuration is invalid
   */
  async connect(config?: MongoEasyConfig): Promise<ConnectResult> {
    if (config) {
      if (this.isConnected()) {
        throw new MongoEasyError(
          "Cannot change config while connected. Call disconnect() first."
        );
      }
      this.setConfig(config);
    }

    if (!this.config?.uri) {
      throw new MongoEasyError(
        "Missing config. Provide uri (and optional dbName)."
      );
    }

    // Return existing connection if available
    if (this.client && this.db) {
      return { client: this.client, db: this.db };
    }

    // Return ongoing connection promise if exists
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // Create new connection
    this.connectPromise = this.createConnection().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  /**
   * Internal method to establish a new MongoDB connection.
   * @private
   */
  private async createConnection(): Promise<ConnectResult> {
    const config = this.config!;
    
    try {
      const client = new MongoClient(config.uri, config.options);
      await client.connect();

      const dbName = config.dbName ?? this.extractDbName(config.uri);
      const db = client.db(dbName);

      this.client = client;
      this.db = db;

      return { client, db };
    } catch (error) {
      // Ensure client is closed on connection failure
      if (this.client) {
        await this.client.close().catch(() => {});
        this.client = null;
      }
      throw error;
    }
  }

  /**
   * Get the MongoDB client instance.
   * @returns MongoClient instance
   * @throws MongoEasyError if not connected
   */
  getClient(): MongoClient {
    if (!this.client) {
      throw new MongoEasyError("Not connected. Call connect() first.");
    }
    return this.client;
  }

  /**
   * Get the MongoDB database instance.
   * @returns Database instance
   * @throws MongoEasyError if not connected
   */
  getDb(): Db {
    if (!this.db) {
      throw new MongoEasyError("Not connected. Call connect() first.");
    }
    return this.db;
  }

  /**
   * Get a raw MongoDB Collection.
   * @param name - Collection name
   * @returns MongoDB Collection instance
   */
  getCollection<T extends Document>(name: string): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  /**
   * Get an `EasyCollection` wrapper with all CRUD helpers.
   * @param name - Collection name
   * @returns EasyCollection instance with enhanced methods
   * 
   * @example
   * const users = mongo.col<User>("users");
   * const alice = await users.findOne({ name: "Alice" });
   */
  col<T extends Document>(name: string): EasyCollection<T> {
    // Validate collection name
    const sanitizedName = sanitizeString(name, "Collection name");
    return new EasyCollection<T>(this.getCollection<T>(sanitizedName));
  }

  /**
   * Disconnect from MongoDB and clean up resources.
   */
  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.db = null;

    if (client) {
      await client.close();
    }
  }

  /**
   * Perform a health check on the MongoDB connection.
   * @returns Whether the connection is healthy
   */
  async healthcheck(): Promise<boolean> {
    try {
      await this.getDb().command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a function within a MongoDB transaction.
   * @param fn - Function to execute within transaction
   * @param options - Transaction options
   * @returns Result of the transaction function
   * @throws MongoEasyError if transaction fails
   */
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

  /**
   * Retry a function with exponential backoff.
   * @param fn - Function to retry
   * @param options - Retry configuration
   * @returns Result of the function
   * @throws Error if all retries are exhausted
   */
  async retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      retries = 3,
      delayMs = 200,
      factor = 2,
      isRetryable = () => true,
      onRetry,
    } = options;

    // Validate retry options
    if (retries < 0) {
      throw new MongoEasyError("Retries must be non-negative");
    }
    if (delayMs < 0) {
      throw new MongoEasyError("Delay must be non-negative");
    }
    if (factor < 1) {
      throw new MongoEasyError("Factor must be at least 1");
    }

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

    throw new Error("Maximum retries exceeded");
  }

  /**
   * Sleep for the specified number of milliseconds.
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract database name from MongoDB URI.
   * @private
   */
  private extractDbName(uri: string): string | undefined {
    try {
      const pathname = new URL(uri).pathname.replace("/", "").trim();
      return pathname.length ? pathname : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Validate MongoDB configuration.
   * @private
   */
  private validateConfig(config: MongoEasyConfig): void {
    validateRequired(config.uri, "URI");
    sanitizeString(config.uri, "URI");
  }
}
