import { describe, it, expect, vi, beforeEach } from "vitest";
import { EasyCollection } from "../src/collection";
import { MongoEasyError } from "../src/errors";
import { ObjectId } from "mongodb";

describe("EasyCollection", () => {
  let collection: EasyCollection<any>;
  let mockCollection: any;

  beforeEach(() => {
    mockCollection = {
      insertOne: vi.fn(),
      insertMany: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      countDocuments: vi.fn(),
      distinct: vi.fn(),
      updateOne: vi.fn(),
      updateMany: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      findOneAndDelete: vi.fn(),
      aggregate: vi.fn(),
      bulkWrite: vi.fn(),
      createIndex: vi.fn(),
      dropIndex: vi.fn(),
      listIndexes: vi.fn(),
    };

    collection = new EasyCollection(mockCollection);
  });

  describe("raw", () => {
    it("should return the underlying collection", () => {
      expect(collection.raw()).toBe(mockCollection);
    });
  });

  describe("insertOne", () => {
    it("should insert document and return with _id", async () => {
      const doc = { name: "Alice" };
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });

      const result = await collection.insertOne(doc);

      expect(mockCollection.insertOne).toHaveBeenCalledWith(doc, undefined);
      expect(result).toEqual({ ...doc, _id: insertedId });
    });
  });

  describe("insertMany", () => {
    it("should insert multiple documents", async () => {
      const docs = [{ name: "Alice" }, { name: "Bob" }];
      const result = { insertedIds: [new ObjectId(), new ObjectId()] };
      mockCollection.insertMany.mockResolvedValue(result);

      await collection.insertMany(docs);

      expect(mockCollection.insertMany).toHaveBeenCalledWith(docs, undefined);
    });
  });

  describe("findOne", () => {
    it("should find one document", async () => {
      const filter = { name: "Alice" };
      const doc = { _id: new ObjectId(), name: "Alice" };
      mockCollection.findOne.mockResolvedValue(doc);

      const result = await collection.findOne(filter);

      expect(mockCollection.findOne).toHaveBeenCalledWith(filter, undefined);
      expect(result).toBe(doc);
    });
  });

  describe("findById", () => {
    it("should find document by ObjectId", async () => {
      const id = new ObjectId();
      const doc = { _id: id, name: "Alice" };
      mockCollection.findOne.mockResolvedValue(doc);

      const result = await collection.findById(id);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: id }, undefined);
      expect(result).toBe(doc);
    });

    it("should find document by string ID", async () => {
      const id = new ObjectId();
      const doc = { _id: id, name: "Alice" };
      mockCollection.findOne.mockResolvedValue(doc);

      const result = await collection.findById(id.toHexString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: id }, undefined);
      expect(result).toBe(doc);
    });

    it("should throw error for invalid ID", async () => {
      await expect(collection.findById("invalid")).rejects.toThrow(MongoEasyError);
    });
  });

  describe("findMany", () => {
    it("should find multiple documents", async () => {
      const filter = { active: true };
      const docs = [{ _id: new ObjectId(), name: "Alice" }];
      const mockCursor = { toArray: vi.fn().mockResolvedValue(docs) };
      mockCollection.find.mockReturnValue(mockCursor);

      const result = await collection.findMany(filter);

      expect(mockCollection.find).toHaveBeenCalledWith(filter, undefined);
      expect(result).toBe(docs);
    });
  });

  describe("paginate", () => {
    it("should paginate results", async () => {
      const filter = { active: true };
      const docs = [{ _id: new ObjectId(), name: "Alice" }];
      const mockCursor = { 
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(docs)
      };
      mockCollection.find.mockReturnValue(mockCursor);
      mockCollection.countDocuments.mockResolvedValue(50);

      const result = await collection.paginate(filter, { page: 2, pageSize: 10 });

      expect(mockCursor.skip).toHaveBeenCalledWith(10);
      expect(mockCursor.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: docs,
        total: 50,
        page: 2,
        pageSize: 10,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it("should use default pagination values", async () => {
      const docs = [{ _id: new ObjectId(), name: "Alice" }];
      const mockCursor = { 
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(docs)
      };
      mockCollection.find.mockReturnValue(mockCursor);
      mockCollection.countDocuments.mockResolvedValue(5);

      const result = await collection.paginate();

      expect(mockCursor.skip).toHaveBeenCalledWith(0);
      expect(mockCursor.limit).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it("should throw error for invalid page number", async () => {
      await expect(collection.paginate({}, { page: 0 }))
        .rejects.toThrow(MongoEasyError);
    });

    it("should throw error for invalid page size", async () => {
      await expect(collection.paginate({}, { pageSize: 0 }))
        .rejects.toThrow(MongoEasyError);
      
      await expect(collection.paginate({}, { pageSize: 1001 }))
        .rejects.toThrow(MongoEasyError);
    });
  });

  describe("exists", () => {
    it("should return true if document exists", async () => {
      const filter = { name: "Alice" };
      mockCollection.findOne.mockResolvedValue({ _id: new ObjectId() });

      const result = await collection.exists(filter);

      expect(result).toBe(true);
      expect(mockCollection.findOne).toHaveBeenCalledWith(filter, {
        projection: { _id: 1 },
      });
    });

    it("should return false if document does not exist", async () => {
      const filter = { name: "Alice" };
      mockCollection.findOne.mockResolvedValue(null);

      const result = await collection.exists(filter);

      expect(result).toBe(false);
    });
  });

  describe("count", () => {
    it("should count documents", async () => {
      const filter = { active: true };
      mockCollection.countDocuments.mockResolvedValue(42);

      const result = await collection.count(filter);

      expect(result).toBe(42);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith(filter, undefined);
    });
  });

  describe("distinct", () => {
    it("should return distinct values", async () => {
      const key = "role";
      const filter = { active: true };
      const values = ["admin", "user"];
      mockCollection.distinct.mockResolvedValue(values);

      const result = await collection.distinct(key, filter);

      expect(result).toBe(values);
      expect(mockCollection.distinct).toHaveBeenCalledWith(key, filter);
    });
  });

  describe("updateOne", () => {
    it("should update one document", async () => {
      const filter = { name: "Alice" };
      const update = { $set: { age: 30 } };
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await collection.updateOne(filter, update);

      expect(result).toBe(true);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(filter, update, undefined);
    });

    it("should return false if no document modified", async () => {
      const filter = { name: "Alice" };
      const update = { $set: { age: 30 } };
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 0 });

      const result = await collection.updateOne(filter, update);

      expect(result).toBe(false);
    });
  });

  describe("updateById", () => {
    it("should update document by ID", async () => {
      const id = new ObjectId();
      const update = { $set: { age: 30 } };
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await collection.updateById(id, update);

      expect(result).toBe(true);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: id },
        update,
        undefined
      );
    });
  });

  describe("updateMany", () => {
    it("should update multiple documents", async () => {
      const filter = { active: true };
      const update = { $set: { status: "inactive" } };
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await collection.updateMany(filter, update);

      expect(result).toBe(5);
      expect(mockCollection.updateMany).toHaveBeenCalledWith(filter, update, undefined);
    });
  });

  describe("findOneAndUpdate", () => {
    it("should find and update document", async () => {
      const filter = { name: "Alice" };
      const update = { $set: { age: 30 } };
      const doc = { _id: new ObjectId(), name: "Alice", age: 30 };
      mockCollection.findOneAndUpdate.mockResolvedValue(doc);

      const result = await collection.findOneAndUpdate(filter, update);

      expect(result).toBe(doc);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        filter,
        update,
        { returnDocument: "after" }
      );
    });
  });

  describe("upsert", () => {
    it("should upsert document and return created flag", async () => {
      const filter = { name: "Alice" };
      const update = { $set: { email: "alice@example.com", age: 25 } };
      const doc = { _id: new ObjectId(), name: "Alice", email: "alice@example.com", age: 25, upsertedId: new ObjectId() };
      mockCollection.findOneAndUpdate.mockResolvedValue(doc);

      const result = await collection.upsert(filter, update);

      expect(result).toEqual({ doc, created: true });
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        filter,
        update,
        { upsert: true, returnDocument: "after" }
      );
    });

    it("should handle upsert without upsertedId", async () => {
      const filter = { email: "alice@example.com" };
      const update = { $set: { name: "Alice" } };
      const doc = { _id: new ObjectId(), name: "Alice", email: "alice@example.com" };
      mockCollection.findOneAndUpdate.mockResolvedValue(doc);

      const result = await collection.upsert(filter, update);

      expect(result).toEqual({ doc, created: false });
    });
  });

  describe("deleteOne", () => {
    it("should delete one document", async () => {
      const filter = { name: "Alice" };
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await collection.deleteOne(filter);

      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith(filter, undefined);
    });
  });

  describe("deleteById", () => {
    it("should delete document by ID", async () => {
      const id = new ObjectId();
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await collection.deleteById(id);

      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: id }, undefined);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple documents", async () => {
      const filter = { active: false };
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await collection.deleteMany(filter);

      expect(result).toBe(5);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith(filter, undefined);
    });
  });

  describe("findOneAndDelete", () => {
    it("should find and delete document", async () => {
      const filter = { name: "Alice" };
      const doc = { _id: new ObjectId(), name: "Alice" };
      mockCollection.findOneAndDelete.mockResolvedValue(doc);

      const result = await collection.findOneAndDelete(filter);

      expect(result).toBe(doc);
      expect(mockCollection.findOneAndDelete).toHaveBeenCalledWith(filter, {});
    });
  });

  describe("aggregate", () => {
    it("should run aggregation pipeline", async () => {
      const pipeline = [{ $group: { _id: null, count: { $sum: 1 } } }];
      const results = [{ _id: null, count: 42 }];
      const mockCursor = { toArray: vi.fn().mockResolvedValue(results) };
      mockCollection.aggregate.mockReturnValue(mockCursor);

      const result = await collection.aggregate(pipeline);

      expect(result).toBe(results);
      expect(mockCollection.aggregate).toHaveBeenCalledWith(pipeline, undefined);
    });
  });

  describe("bulkWrite", () => {
    it("should execute bulk write operations", async () => {
      const operations = [
        { insertOne: { document: { name: "Alice" } } },
        { updateOne: { filter: { name: "Bob" }, update: { $set: { active: false } } } },
      ];
      const result = { insertedCount: 1, modifiedCount: 1 };
      mockCollection.bulkWrite.mockResolvedValue(result);

      await collection.bulkWrite(operations);

      expect(mockCollection.bulkWrite).toHaveBeenCalledWith(operations, undefined);
    });
  });

  describe("createIndex", () => {
    it("should create index", async () => {
      const spec = { email: 1 };
      const options = { unique: true };
      mockCollection.createIndex.mockResolvedValue("email_1");

      const result = await collection.createIndex(spec, options);

      expect(result).toBe("email_1");
      expect(mockCollection.createIndex).toHaveBeenCalledWith(spec, options);
    });
  });

  describe("dropIndex", () => {
    it("should drop index", async () => {
      const name = "email_1";
      mockCollection.dropIndex.mockResolvedValue(undefined);

      await collection.dropIndex(name);

      expect(mockCollection.dropIndex).toHaveBeenCalledWith(name, {});
    });
  });

  describe("listIndexes", () => {
    it("should list indexes", async () => {
      const indexes = [{ name: "_id_" }, { name: "email_1" }];
      const mockCursor = { toArray: vi.fn().mockResolvedValue(indexes) };
      mockCollection.listIndexes.mockReturnValue(mockCursor);

      const result = await collection.listIndexes();

      expect(result).toBe(indexes);
    });
  });
});
