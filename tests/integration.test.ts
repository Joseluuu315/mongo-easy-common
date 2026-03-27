import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMongoManager, EasyCollection } from "../src/index";

const uri = process.env.MONGO_URI;
const maybe = uri ? it : it.skip;

describe("integration", () => {
  const manager = createMongoManager({ uri: uri || "mongodb://localhost:27017/test", dbName: "testdb" });
  let collection: EasyCollection<{ name: string; age?: number; active?: boolean }>;

  beforeAll(async () => {
    // Skip connection if no MongoDB URI is provided
    if (!uri) {
      console.log("Skipping integration tests - no MONGO_URI provided");
      return;
    }
    
    try {
      await manager.connect();
      collection = manager.col<{ name: string; age?: number; active?: boolean }>("items");
    } catch {
      console.log("Failed to connect to MongoDB, skipping integration tests");
    }
  });

  afterAll(async () => {
    await manager.disconnect();
  });

  maybe("healthcheck returns true when connected", async () => {
    const ok = await manager.healthcheck();
    expect(ok).toBe(true);
  });

  maybe("inserts and retrieves a document", async () => {
    await collection.deleteMany({});
    await collection.insertOne({ name: "hello" });

    const doc = await collection.findOne({ name: "hello" });
    expect(doc).not.toBeNull();
    expect(doc?.name).toBe("hello");
  });

  maybe("returns null for non-existent document", async () => {
    const doc = await collection.findOne({ name: "__does_not_exist__" });
    expect(doc).toBeNull();
  });

  maybe("inserts multiple documents and retrieves all", async () => {
    await collection.deleteMany({});
    await collection.insertMany([{ name: "a" }, { name: "b" }, { name: "c" }]);

    const docs = await collection.findMany({});
    expect(docs).toHaveLength(3);
    expect(docs.map((d) => d.name)).toEqual(
      expect.arrayContaining(["a", "b", "c"])
    );
  });

  maybe("should perform full CRUD cycle with EasyCollection", async () => {
    await collection.deleteMany({});

    // Create
    const user = { name: "Alice", age: 30, active: true };
    const inserted = await collection.insertOne(user);
    expect(inserted._id).toBeDefined();
    expect(inserted.name).toBe(user.name);

    // Read by ID
    const found = await collection.findById(inserted._id);
    expect(found).toEqual(inserted);

    // Update
    const updated = await collection.updateById(inserted._id, { $set: { age: 31 } });
    expect(updated).toBe(true);

    const afterUpdate = await collection.findById(inserted._id);
    expect(afterUpdate?.age).toBe(31);

    // Delete
    const deleted = await collection.deleteById(inserted._id);
    expect(deleted).toBe(true);

    const afterDelete = await collection.findById(inserted._id);
    expect(afterDelete).toBeNull();
  });

  maybe("should handle pagination", async () => {
    await collection.deleteMany({});

    // Insert test data
    const users = Array.from({ length: 25 }, (_, i) => ({
      name: `User ${i + 1}`,
      age: 20 + (i % 10),
      active: i % 2 === 0,
    }));

    await collection.insertMany(users);

    // Test pagination
    const page1 = await collection.paginate({}, { page: 1, pageSize: 10 });
    expect(page1.data).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(10);
    expect(page1.totalPages).toBe(3);
    expect(page1.hasNext).toBe(true);
    expect(page1.hasPrev).toBe(false);

    const page2 = await collection.paginate({}, { page: 2, pageSize: 10 });
    expect(page2.data).toHaveLength(10);
    expect(page2.hasPrev).toBe(true);

    const page3 = await collection.paginate({}, { page: 3, pageSize: 10 });
    expect(page3.data).toHaveLength(5);
    expect(page3.hasNext).toBe(false);
  });

  maybe("should handle transactions", async () => {
    await collection.deleteMany({});

    const user1 = { name: "Transaction User 1", age: 25 };
    const user2 = { name: "Transaction User 2", age: 30 };

    try {
      const result = await manager.withTransaction(async (session) => {
        const inserted1 = await collection.insertOne(user1, { session });
        const inserted2 = await collection.insertOne(user2, { session });
        return { user1: inserted1, user2: inserted2 };
      });

      expect(result.user1._id).toBeDefined();
      expect(result.user2._id).toBeDefined();

      // Verify both users exist
      const found1 = await collection.findById(result.user1._id);
      const found2 = await collection.findById(result.user2._id);
      expect(found1).toBeTruthy();
      expect(found2).toBeTruthy();
    } catch (e) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      if (msg.includes("Transaction numbers are only allowed")) {
        // Standalone MongoDB (not replica set) doesn't support transactions.
        return;
      }
      throw e;
    }
  });

  maybe("should handle aggregation", async () => {
    await collection.deleteMany({});

    // Insert test data
    await collection.insertMany([
      { name: "Alice", age: 25, active: true },
      { name: "Bob", age: 30, active: false },
      { name: "Charlie", age: 35, active: true },
    ]);

    const results = await collection.aggregate<{ _id: string; count: number }>([
      { $match: { active: true } },
      { $group: { _id: "$active", count: { $sum: 1 } } },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]._id).toBe(true);
    expect(results[0].count).toBe(2);
  });

  maybe("should handle upsert operations", async () => {
    await collection.deleteMany({});

    const name = "Test User";

    // First upsert should create
    const result1 = await collection.upsert(
      { name },
      { $set: { age: 25 } }
    );
    expect(result1.created).toBe(true);
    expect(result1.doc.age).toBe(25);

    // Second upsert should update
    const result2 = await collection.upsert(
      { name },
      { $set: { age: 26 } }
    );
    expect(result2.created).toBe(false);
    expect(result2.doc.age).toBe(26);
  });

  maybe("should handle bulk operations", async () => {
    await collection.deleteMany({});

    const operations = [
      { insertOne: { document: { name: "Bulk User 1", age: 20 } } },
      { insertOne: { document: { name: "Bulk User 2", age: 25 } } },
      { updateOne: { filter: { name: "Bulk User 1" }, update: { $set: { age: 21 } } } },
    ];

    const result = await collection.bulkWrite(operations);
    expect(result.insertedCount).toBe(2);
    expect(result.modifiedCount).toBe(1);

    // Verify data
    const users = await collection.findMany({ name: { $regex: /^Bulk User/ } });
    expect(users).toHaveLength(2);

    const user1 = await collection.findOne({ name: "Bulk User 1" });
    expect(user1?.age).toBe(21);
  });
});