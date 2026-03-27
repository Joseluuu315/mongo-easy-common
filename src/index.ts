// Re-export all types and interfaces
export * from "./types";

// Re-export error classes
export * from "./errors";

// Re-export utilities
export * from "./utils";

// Re-export main classes
export { EasyCollection } from "./collection";
export { MongoEasyManager } from "./manager";

// Import for default instance setup
import { MongoEasyManager } from "./manager";
import {
  MongoEasyConfig,
  ConnectResult,
  TransactionFn,
  RetryOptions,
  Collection,
  MongoClient,
  Db,
  TransactionOptions,
} from "./types";
import { EasyCollection } from "./collection";

// ─── Default singleton ────────────────────────────────────────────────────────

/**
 * Default manager instance for convenience
 * @private
 */
const defaultManager = new MongoEasyManager();

/**
 * Set configuration for the default manager instance
 * @param config - MongoDB configuration
 */
export const setConfig = (config: MongoEasyConfig): void =>
  defaultManager.setConfig(config);

/**
 * Check if the default manager is connected
 * @returns Whether connected to MongoDB
 */
export const isConnected = (): boolean => defaultManager.isConnected();

/**
 * Connect the default manager to MongoDB
 * @param config - Optional configuration override
 * @returns Connection result
 */
export const connect = (config?: MongoEasyConfig): Promise<ConnectResult> =>
  defaultManager.connect(config);

/**
 * Get the MongoDB client from the default manager
 * @returns MongoClient instance
 */
export const getClient = (): MongoClient => defaultManager.getClient();

/**
 * Get the database instance from the default manager
 * @returns Database instance
 */
export const getDb = (): Db => defaultManager.getDb();

/**
 * Get a raw collection from the default manager
 * @param name - Collection name
 * @returns MongoDB Collection instance
 */
export const getCollection = <T extends Document>(
  name: string
): Collection<T> => defaultManager.getCollection<T>(name);

/**
 * Get an EasyCollection from the default manager
 * @param name - Collection name
 * @returns EasyCollection instance with enhanced methods
 */
export const col = <T extends Document>(name: string): EasyCollection<T> =>
  defaultManager.col<T>(name);

/**
 * Disconnect the default manager
 * @returns Promise that resolves when disconnected
 */
export const disconnect = (): Promise<void> => defaultManager.disconnect();

/**
 * Perform health check on the default manager connection
 * @returns Whether the connection is healthy
 */
export const healthcheck = (): Promise<boolean> => defaultManager.healthcheck();

/**
 * Execute a function within a transaction using the default manager
 * @param fn - Function to execute within transaction
 * @param options - Transaction options
 * @returns Result of the transaction function
 */
export const withTransaction = <T>(
  fn: TransactionFn<T>,
  options?: TransactionOptions
): Promise<T> => defaultManager.withTransaction(fn, options);

/**
 * Retry a function using the default manager
 * @param fn - Function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 */
export const retry = <T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> => defaultManager.retry(fn, options);

/**
 * Create a new MongoEasyManager instance
 * @param config - Optional configuration
 * @returns New manager instance
 */
export const createMongoManager = (
  config?: MongoEasyConfig
): MongoEasyManager => new MongoEasyManager(config);
