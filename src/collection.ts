import {
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
  FindOneAndUpdateOptions,
  FindOneAndDeleteOptions,
  IndexSpecification,
  CreateIndexesOptions,
  DropIndexesOptions,
  ObjectId,
} from "./types";
import { MongoEasyError } from "./errors";
import { toObjectId } from "./utils";
import { PaginateOptions, PaginateResult, UpsertResult } from "./types";

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
   * @param doc - Document to insert
   * @param options - Insert options
   * @returns The inserted document with its generated `_id`
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
   * @param docs - Array of documents to insert
   * @param options - Bulk write options
   * @returns MongoDB InsertManyResult with inserted IDs
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
   * @param filter - MongoDB filter query
   * @param options - Find options
   * @returns The document or `null` if not found
   */
  async findOne(
    filter: Filter<T>,
    options?: FindOptions<T>
  ): Promise<WithId<T> | null> {
    return this.collection.findOne(filter, options);
  }

  /**
   * Find a document by its `_id` (accepts string or ObjectId).
   * @param id - Document ID (string or ObjectId)
   * @param options - Find options
   * @returns The document or `null` if not found
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
   * @param filter - MongoDB filter query
   * @param options - Find options
   * @returns Array of matching documents
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
   * @param filter - MongoDB filter query
   * @param options - Pagination options
   * @returns Paginated result with metadata
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
    
    // Validate pagination parameters
    if (page < 1) {
      throw new MongoEasyError("Page number must be greater than 0");
    }
    if (pageSize < 1 || pageSize > 1000) {
      throw new MongoEasyError("Page size must be between 1 and 1000");
    }
    
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
   * @param filter - MongoDB filter query
   * @returns Whether any document matches the filter
   */
  async exists(filter: Filter<T>): Promise<boolean> {
    const doc = await this.collection.findOne(filter, {
      projection: { _id: 1 },
    });
    return doc !== null;
  }

  /**
   * Count documents matching the filter.
   * @param filter - MongoDB filter query
   * @param options - Count options
   * @returns Number of matching documents
   */
  async count(
    filter: Filter<T> = {},
    options?: CountDocumentsOptions
  ): Promise<number> {
    return this.collection.countDocuments(filter, options);
  }

  /**
   * Return distinct values for a field.
   * @param key - Field name to get distinct values for
   * @param filter - Optional filter to limit results
   * @returns Array of distinct values
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
   * @param filter - MongoDB filter query
   * @param update - Update operation
   * @param options - Update options
   * @returns `true` if a document was modified
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
   * @param id - Document ID (string or ObjectId)
   * @param update - Update operation
   * @param options - Update options
   * @returns `true` if a document was modified
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
   * @param filter - MongoDB filter query
   * @param update - Update operation
   * @param options - Update options
   * @returns Number of modified documents
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
   * @param filter - MongoDB filter query
   * @param update - Update operation
   * @param options - Find and update options
   * @returns The updated document or `null` if not found
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
   * @param filter - MongoDB filter query
   * @param update - Update operation
   * @param options - Update options
   * @returns Upsert result with document and creation flag
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
   * @param filter - MongoDB filter query
   * @param options - Delete options
   * @returns `true` if a document was deleted
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
   * @param id - Document ID (string or ObjectId)
   * @param options - Delete options
   * @returns `true` if a document was deleted
   */
  async deleteById(
    id: string | ObjectId,
    options?: DeleteOptions
  ): Promise<boolean> {
    return this.deleteOne({ _id: toObjectId(id) } as Filter<T>, options);
  }

  /**
   * Delete all documents matching the filter.
   * @param filter - MongoDB filter query
   * @param options - Delete options
   * @returns Number of deleted documents
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
   * @param filter - MongoDB filter query
   * @param options - Find and delete options
   * @returns The deleted document or `null` if not found
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
   * @param pipeline - Aggregation pipeline stages
   * @param options - Aggregation options
   * @returns Array of aggregation results
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
   * @param operations - Array of bulk write operations
   * @param options - Bulk write options
   * @returns Bulk write result
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
   * @param spec - Index specification
   * @param options - Create index options
   * @returns Index name
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
   * @param nameOrSpec - Index name or specification
   * @param options - Drop index options
   */
  async dropIndex(
    nameOrSpec: string | IndexSpecification,
    options?: DropIndexesOptions
  ): Promise<void> {
    await this.collection.dropIndex(nameOrSpec as string, options ?? {});
  }

  /**
   * List all indexes on the collection.
   * @returns Array of index specifications
   */
  async listIndexes(): Promise<Document[]> {
    return this.collection.listIndexes().toArray();
  }
}
