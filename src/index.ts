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

export type PaginateOptions<T extends Document> = FindOptions<T> & {
  page?: number;
  pageSize?: number;
};

export type PaginateResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type UpsertResult<T> = {
  doc: WithId<T>;
  created: boolean;
};

// ─── Errors ───────────────────────────────────────────────────────────────────

export class MongoEasyError extends Error {
  constructor(message: string) {
    super(`MongoEasyManager: ${message}`);
    this.name = "MongoEasyError";
  }
}

// ─── Collection Helper ────────────────────────────────────────────────────────

/**
 * Fluent wrapper around a MongoDB Collection with ready-to-use CRUD helpers.
 *
 * @example
 * const users = mongo.col<User>("users");
 * const user  = await users.findById("64a1f...");
 * await users.updateById("64a1f...", { $set: { name: "Alice" } });
 */
export class EasyCollection<T extends Document> {
  constructor(private readonly collection: Collection<T>) {}

  // ── Raw access ──────────────────────────────────────────────────────────────

  /** Returns the underlying MongoDB Collection for advanced operations. */
  raw(): Collection<T> {
    return this.collection;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  /**
   * Insert a single document.
   * @returns The inserted document with its generated `_id`.
   */
  async insertOne(
    doc: OptionalUnlessRequiredId<T>,
    options?: InsertOneOptions
  ): Promise<WithId<T>> {
    const result = await this.collection.insertOne(doc, options);
    return { ...doc, _id: result.insertedId } as unknown as WithId<T>;
  }

  /**
   * Insert multiple documents.
   * @returns MongoDB InsertManyResult with inserted IDs.
   */
  async insertMany(
    docs: OptionalUnlessRequiredId<T>[],
    options?: BulkWriteOptions
  ): Promise<InsertManyResult<T>> {
    return this.collection.insertMany(docs, options);
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /**
   * Find a single document matching the filter.
   * @returns The document or `null` if not found.
   */
  async findOne(
    filter: Filter<T>,
    options?: FindOptions<T>
  ): Promise<WithId<T> | null> {
    return this.collection.findOne(filter, options);
  }

  /**
   * Find a document by its `_id` (accepts string or ObjectId).
   */
  async findById(
    id: string | ObjectId,
    options?: FindOptions<T>
  ): Promise<WithId<T> | null> {
    return this.collection.findOne(
      { _id: toObjectId(id) } as Filter<T>,
      options
    );
  }

  /**
   * Find all documents matching the filter.
   */
  async findMany(
    filter: Filter<T> = {},
    options?: FindOptions<T>
  ): Promise<WithId<T>[]> {
    return this.collection.find(filter, options).toArray();
  }

  /**
   * Paginate documents matching the filter.
   *
   * @example
   * const page = await users.paginate({}, { page: 2, pageSize: 20 });
   * console.log(page.data, page.totalPages);
   */
  async paginate(
    filter: Filter<T> = {},
    options: PaginateOptions<T> = {}
  ): Promise<PaginateResult<WithId<T>>> {
    const { page = 1, pageSize = 20, ...findOptions } = options;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.collection
        .find(filter, findOptions)
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Returns `true` if at least one document matches the filter.
   */
  async exists(filter: Filter<T>): Promise<boolean> {
    const doc = await this.collection.findOne(filter, {
      projection: { _id: 1 },
    });
    return doc !== null;
  }

  /**
   * Count documents matching the filter.
   */
  async count(
    filter: Filter<T> = {},
    options?: CountDocumentsOptions
  ): Promise<number> {
    return this.collection.countDocuments(filter, options);
  }

  /**
   * Return distinct values for a field.
   *
   * @example
   * const roles = await users.distinct("role");
   */
  async distinct<K extends keyof T & string>(
    key: K,
    filter?: Filter<T>
  ): Promise<T[K][]> {
    return this.collection.distinct(key, filter ?? {}) as Promise<T[K][]>;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  /**
   * Update a single document matching the filter.
   * @returns `true` if a document was modified.
   */
  async updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<boolean> {
    const result = await this.collection.updateOne(filter, update, options);
    return result.modifiedCount > 0;
  }

  /**
   * Update a document by its `_id`.
   */
  async updateById(
    id: string | ObjectId,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<boolean> {
    return this.updateOne({ _id: toObjectId(id) } as Filter<T>, update, options);
  }

  /**
   * Update all documents matching the filter.
   * @returns Number of modified documents.
   */
  async updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<number> {
    const result = await this.collection.updateMany(filter, update, options);
    return result.modifiedCount;
  }

  /**
   * Find a document matching the filter, apply an update, and return the
   * updated document.
   */
  async findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options: FindOneAndUpdateOptions = { returnDocument: "after" }
  ): Promise<WithId<T> | null> {
    return this.collection.findOneAndUpdate(filter, update, options);
  }

  /**
   * Insert or update a single document by filter.
   * Equivalent to `updateOne` with `upsert: true` but also returns the
   * resulting document and whether it was newly created.
   */
  async upsert(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<UpsertResult<T>> {
    const result = await this.collection.findOneAndUpdate(
      filter,
      update,
      { upsert: true, returnDocument: "after", ...options } as FindOneAndUpdateOptions
    );

    if (!result) {
      throw new MongoEasyError("Upsert did not return a document.");
    }

    const created =
      "upsertedId" in result ? result.upsertedId !== null : false;

    return { doc: result as WithId<T>, created };
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  /**
   * Delete a single document matching the filter.
   * @returns `true` if a document was deleted.
   */
  async deleteOne(
    filter: Filter<T>,
    options?: DeleteOptions
  ): Promise<boolean> {
    const result = await this.collection.deleteOne(filter, options);
    return result.deletedCount > 0;
  }

  /**
   * Delete a document by its `_id`.
   */
  async deleteById(
    id: string | ObjectId,
    options?: DeleteOptions
  ): Promise<boolean> {
    return this.deleteOne({ _id: toObjectId(id) } as Filter<T>, options);
  }

  /**
   * Delete all documents matching the filter.
   * @returns Number of deleted documents.
   */
  async deleteMany(
    filter: Filter<T>,
    options?: DeleteOptions
  ): Promise<number> {
    const result = await this.collection.deleteMany(filter, options);
    return result.deletedCount;
  }

  /**
   * Find a document and delete it atomically, returning the deleted document.
   */
  async findOneAndDelete(
    filter: Filter<T>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<T> | null> {
    return this.collection.findOneAndDelete(filter, options ?? {});
  }

  // ── Aggregation ─────────────────────────────────────────────────────────────

  /**
   * Run an aggregation pipeline and return all results.
   *
   * @example
   * const stats = await orders.aggregate<{ total: number }>([
   *   { $group: { _id: null, total: { $sum: "$amount" } } },
   * ]);
   */
  async aggregate<R extends Document = Document>(
    pipeline: Document[],
    options?: AggregateOptions
  ): Promise<R[]> {
    return this.collection.aggregate<R>(pipeline, options).toArray();
  }

  // ── Bulk ────────────────────────────────────────────────────────────────────

  /**
   * Execute multiple write operations in a single round-trip.
   *
   * @example
   * await users.bulkWrite([
   *   { insertOne: { document: { name: "Alice" } } },
   *   { updateOne: { filter: { name: "Bob" }, update: { $set: { active: false } } } },
   * ]);
   */
  async bulkWrite(
    operations: AnyBulkWriteOperation<T>[],
    options?: BulkWriteOptions
  ) {
    return this.collection.bulkWrite(operations, options);
  }

  // ── Indexes ─────────────────────────────────────────────────────────────────

  /**
   * Create one or more indexes on the collection.
   *
   * @example
   * await users.createIndex({ email: 1 }, { unique: true });
   */
  async createIndex(
    spec: IndexSpecification,
    options?: CreateIndexesOptions
  ): Promise<string> {
    return this.collection.createIndex(spec, options ?? {});
  }

  /**
   * Drop an index by name or specification.
   */
  async dropIndex(
    nameOrSpec: string | IndexSpecification,
    options?: DropIndexesOptions
  ): Promise<void> {
    await this.collection.dropIndex(nameOrSpec as string, options ?? {});
  }

  /**
   * List all indexes on the collection.
   */
  async listIndexes(): Promise<Document[]> {
    return this.collection.listIndexes().toArray();
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

    if (this.client && this.db) {
      return { client: this.client, db: this.db };
    }

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

  /**
   * Get a raw MongoDB Collection.
   */
  getCollection<T extends Document>(name: string): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  /**
   * Get an `EasyCollection` wrapper with all CRUD helpers.
   *
   * @example
   * const users = mongo.col<User>("users");
   * const alice = await users.findOne({ name: "Alice" });
   */
  col<T extends Document>(name: string): EasyCollection<T> {
    return new EasyCollection<T>(this.getCollection<T>(name));
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

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Safely convert a string or ObjectId to ObjectId.
 * Throws `MongoEasyError` if the string is not a valid ObjectId.
 */
export function toObjectId(id: string | ObjectId): ObjectId {
  if (id instanceof ObjectId) return id;
  if (!ObjectId.isValid(id)) {
    throw new MongoEasyError(`Invalid ObjectId: "${id}"`);
  }
  return new ObjectId(id);
}

/**
 * Build a `$set`-only update from a partial object, ignoring `undefined`
 * values so they don't overwrite existing fields.
 *
 * @example
 * await users.updateById(id, setFields({ name: "Alice", age: undefined }));
 * // => { $set: { name: "Alice" } }
 */
export function setFields<T extends Document>(
  partial: Partial<T>
): UpdateFilter<T> {
  const clean = Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== undefined)
  );
  return { $set: clean } as UpdateFilter<T>;
}

/**
 * Build a standard `createdAt` / `updatedAt` timestamp object to spread
 * into insert payloads.
 */
export function timestamps(): { createdAt: Date; updatedAt: Date } {
  const now = new Date();
  return { createdAt: now, updatedAt: now };
}

/**
 * Return a `$set` update that bumps `updatedAt` to now, merged with any
 * additional fields.
 */
export function touch<T extends Document>(
  extra: Partial<T> = {}
): UpdateFilter<T> {
  return setFields<T>({ ...extra, updatedAt: new Date() } as Partial<T>);
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
export const getCollection = <T extends Document>(
  name: string
): Collection<T> => defaultManager.getCollection<T>(name);
/** Shorthand to get an `EasyCollection` from the default manager. */
export const col = <T extends Document>(name: string): EasyCollection<T> =>
  defaultManager.col<T>(name);
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

export const createMongoManager = (
  config?: MongoEasyConfig
): MongoEasyManager => new MongoEasyManager(config);

export type {
  Db,
  MongoClient,
  MongoClientOptions,
  ClientSession,
  TransactionOptions,
  Collection,
  WithId,
  ObjectId,
};