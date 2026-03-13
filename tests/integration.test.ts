import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMongoManager } from "../src/index";

const uri = process.env.MONGO_URI;
const maybe = uri ? it : it.skip;

describe("integration", () => {
  const manager = createMongoManager({ uri, dbName: "testdb" });

  beforeAll(async () => {
    await manager.connect();
  });

  afterAll(async () => {
    await manager.disconnect();
  });

  maybe("healthcheck returns true when connected", async () => {
    const ok = await manager.healthcheck();
    expect(ok).toBe(true);
  });

  maybe("inserts and retrieves a document", async () => {
    const col = manager.getDb().collection("items");

    await col.deleteMany({});
    await col.insertOne({ name: "hello" });

    const doc = await col.findOne({ name: "hello" });
    expect(doc).not.toBeNull();
    expect(doc?.name).toBe("hello");
  });

  maybe("returns null for non-existent document", async () => {
    const col = manager.getDb().collection("items");

    const doc = await col.findOne({ name: "__does_not_exist__" });
    expect(doc).toBeNull();
  });

  maybe("inserts multiple documents and retrieves all", async () => {
    const col = manager.getDb().collection("items");

    await col.deleteMany({});
    await col.insertMany([{ name: "a" }, { name: "b" }, { name: "c" }]);

    const docs = await col.find({}).toArray();
    expect(docs).toHaveLength(3);
    expect(docs.map((d) => d.name)).toEqual(
      expect.arrayContaining(["a", "b", "c"])
    );
  });
});