import {
  Db,
  MongoClient,
  MongoClientOptions,
  ClientSession,
  TransactionOptions,
  Collection,
  Filter,
  UpdateFilter,
  FindOptions,
  InsertOneOptions,
  InsertManyResult,
  UpdateOptions,
  DeleteOptions,
  CountDocumentsOptions,
  AggregateOptions,
  BulkWriteOptions,
  AnyBulkWriteOperation,
  OptionalUnlessRequiredId,
  WithId,
  Document,
  ObjectId,
  FindOneAndUpdateOptions,
  FindOneAndDeleteOptions,
  IndexSpecification,
  CreateIndexesOptions,
  DropIndexesOptions,
} from "mongodb";

/**
 * Configuration options for MongoDB connection
 */
export type MongoEasyConfig = {
  /** MongoDB connection URI */
  uri: string;
  /** Database name (optional, extracted from URI if not provided) */
  dbName?: string;
  /** Additional MongoDB client options */
  options?: MongoClientOptions;
};

/**
 * Transaction function type
 */
export type TransactionFn<T> = (session: ClientSession) => Promise<T>;

/**
 * Retry configuration options
 */
export type RetryOptions = {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Initial delay in milliseconds (default: 200) */
  delayMs?: number;
  /** Backoff multiplier (default: 2) */
  factor?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called on each retry attempt */
  onRetry?: (error: unknown, attempt: number) => void;
};

/**
 * Connection result containing client and database instances
 */
export type ConnectResult = { client: MongoClient; db: Db };

/**
 * Pagination options extending MongoDB FindOptions
 */
export type PaginateOptions<T extends Document> = FindOptions<T> & {
  /** Page number (default: 1) */
  page?: number;
  /** Number of items per page (default: 20) */
  pageSize?: number;
};

/**
 * Pagination result with metadata
 */
export type PaginateResult<T> = {
  /** Array of documents for the current page */
  data: T[];
  /** Total number of documents matching the filter */
  total: number;
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
};

/**
 * Upsert operation result
 */
export type UpsertResult<T> = {
  /** The resulting document */
  doc: WithId<T>;
  /** Whether the document was newly created */
  created: boolean;
};

// Re-export MongoDB types for convenience
export {
  Db,
  MongoClient,
  MongoClientOptions,
  ClientSession,
  TransactionOptions,
  Collection,
  Filter,
  UpdateFilter,
  FindOptions,
  InsertOneOptions,
  InsertManyResult,
  UpdateOptions,
  DeleteOptions,
  CountDocumentsOptions,
  AggregateOptions,
  BulkWriteOptions,
  AnyBulkWriteOperation,
  OptionalUnlessRequiredId,
  WithId,
  Document,
  ObjectId,
  FindOneAndUpdateOptions,
  FindOneAndDeleteOptions,
  IndexSpecification,
  CreateIndexesOptions,
  DropIndexesOptions,
};
