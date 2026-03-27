import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MongoEasyManager } from "../src/manager";
import { MongoEasyError } from "../src/errors";

// Mock MongoDB - simplified approach
vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor(...args: unknown[]) {
      void args;
    }
    connect = vi.fn().mockResolvedValue(undefined);
    db = vi.fn().mockReturnValue({
      command: vi.fn().mockResolvedValue({ ok: 1 }),
      collection: vi.fn().mockReturnThis(),
    });
    close = vi.fn().mockResolvedValue(undefined);
    startSession = vi.fn().mockReturnValue({
      withTransaction: vi.fn(),
      endSession: vi.fn().mockResolvedValue(undefined),
    });
  },
}));

describe("MongoEasyManager", () => {
  let manager: MongoEasyManager;

  beforeEach(() => {
    manager = new MongoEasyManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create manager without config", () => {
      expect(manager.isConnected()).toBe(false);
    });

    it("should create manager with config", () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      const managerWithConfig = new MongoEasyManager(config);
      expect(managerWithConfig.isConnected()).toBe(false);
    });
  });

  describe("setConfig", () => {
    it("should set config when not connected", () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      expect(() => manager.setConfig(config)).not.toThrow();
    });

    it("should validate config", () => {
      expect(() => manager.setConfig({ uri: "" })).toThrow(MongoEasyError);
      expect(() => manager.setConfig({ uri: "   " })).toThrow(MongoEasyError);
    });
  });

  describe("connect", () => {
    it("should throw error without config", async () => {
      await expect(manager.connect()).rejects.toThrow(MongoEasyError);
    });

    it("should connect with valid config", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      const result = await manager.connect();
      
      expect(result).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.db).toBeDefined();
    });
  });

  describe("getClient and getDb", () => {
    it("should throw error when not connected", () => {
      expect(() => manager.getClient()).toThrow(MongoEasyError);
      expect(() => manager.getDb()).toThrow(MongoEasyError);
    });
  });

  describe("disconnect", () => {
    it("should handle disconnect when not connected", async () => {
      await expect(manager.disconnect()).resolves.not.toThrow();
    });
  });

  describe("retry", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      
      const result = await manager.retry(fn);
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should validate retry options", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      
      await expect(manager.retry(fn, { retries: -1 })).rejects.toThrow(MongoEasyError);
      await expect(manager.retry(fn, { delayMs: -1 })).rejects.toThrow(MongoEasyError);
      await expect(manager.retry(fn, { factor: 0.5 })).rejects.toThrow(MongoEasyError);
    });
  });
});
