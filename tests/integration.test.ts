import { describe, expect, it } from "vitest";
import { createMongoManager } from "../src/index";

const uri = process.env.MONGO_URI;

const maybe = uri ? it : it.skip;

describe("integration", () => {
  maybe("connects, pings, writes and reads", async () => {
    const manager = createMongoManager({ uri, dbName: "testdb" });
    await manager.connect();

    const ok = await manager.healthcheck();
    expect(ok).toBe(true);

    const db = manager.getDb();
    const col = db.collection("items");

    await col.deleteMany({});
    await col.insertOne({ name: "hello" });

    const doc = await col.findOne({ name: "hello" });
    expect(doc?.name).toBe("hello");

    await manager.disconnect();
  });
});
