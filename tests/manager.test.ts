import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MongoEasyManager } from "../src/manager";
import { MongoEasyError } from "../src/errors";

// Mock MongoDB
vi.mock("mongodb", () => ({
  MongoClient: vi.fn(),
}));

describe("MongoEasyManager", () => {
  let manager: MongoEasyManager;
  let mockClient: any;
  let mockDb: any;
  let MongoClient: any;

  beforeEach(() => {
    // Get the mocked MongoClient
    const { MongoClient: MockedMongoClient } = require("mongodb");
    MongoClient = MockedMongoClient;
    
    manager = new MongoEasyManager();
    
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      db: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
      startSession: vi.fn().mockReturnValue({
        withTransaction: vi.fn(),
        endSession: vi.fn().mockResolvedValue(undefined),
      }),
    };

    mockDb = {
      command: vi.fn().mockResolvedValue({ ok: 1 }),
      collection: vi.fn().mockReturnThis(),
    };

    MongoClient.mockImplementation(() => mockClient);
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

    it("should throw error when trying to set config while connected", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      // Mock connection
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      const newConfig = { uri: "mongodb://localhost:27017/other" };
      expect(() => manager.setConfig(newConfig)).toThrow(MongoEasyError);
    });

    it("should validate config", () => {
      expect(() => manager.setConfig({ uri: "" })).toThrow(MongoEasyError);
      expect(() => manager.setConfig({ uri: "   " })).toThrow(MongoEasyError);
    });
  });

  describe("connect", () => {
    it("should connect with valid config", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      
      const result = await manager.connect();
      
      expect(MongoClient).toHaveBeenCalledWith(config.uri, undefined);
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.db).toHaveBeenCalledWith("test");
      expect(result.client).toBe(mockClient);
      expect(result.db).toBe(mockDb);
    });

    it("should throw error without config", async () => {
      await expect(manager.connect()).rejects.toThrow(MongoEasyError);
    });

    it("should extract database name from URI", async () => {
      const config = { uri: "mongodb://localhost:27017/mydb" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      
      await manager.connect();
      
      expect(mockClient.db).toHaveBeenCalledWith("mydb");
    });

    it("should handle connection errors", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      const error = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(error);
      
      await expect(manager.connect()).rejects.toThrow("Connection failed");
    });
  });

  describe("getClient and getDb", () => {
    it("should throw error when not connected", () => {
      expect(() => manager.getClient()).toThrow(MongoEasyError);
      expect(() => manager.getDb()).toThrow(MongoEasyError);
    });

    it("should return client and db when connected", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      expect(manager.getClient()).toBe(mockClient);
      expect(manager.getDb()).toBe(mockDb);
    });
  });

  describe("disconnect", () => {
    it("should disconnect gracefully", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      await manager.disconnect();
      
      expect(mockClient.close).toHaveBeenCalled();
      expect(manager.isConnected()).toBe(false);
    });

    it("should handle disconnect when not connected", async () => {
      await expect(manager.disconnect()).resolves.not.toThrow();
    });
  });

  describe("healthcheck", () => {
    it("should return true on successful ping", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      const result = await manager.healthcheck();
      
      expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 });
      expect(result).toBe(true);
    });

    it("should return false on failed ping", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockDb.command.mockRejectedValue(new Error("Ping failed"));
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      const result = await manager.healthcheck();
      
      expect(result).toBe(false);
    });
  });

  describe("retry", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      
      const result = await manager.retry(fn);
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValue("success");
      
      const result = await manager.retry(fn, { retries: 2, delayMs: 10 });
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Permanent failure"));
      
      await expect(manager.retry(fn, { retries: 2, delayMs: 10 }))
        .rejects.toThrow("Permanent failure");
      
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should validate retry options", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      
      await expect(manager.retry(fn, { retries: -1 })).rejects.toThrow(MongoEasyError);
      await expect(manager.retry(fn, { delayMs: -1 })).rejects.toThrow(MongoEasyError);
      await expect(manager.retry(fn, { factor: 0.5 })).rejects.toThrow(MongoEasyError);
    });
  });

  describe("withTransaction", () => {
    it("should execute transaction successfully", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      const mockSession = mockClient.startSession();
      const transactionFn = vi.fn().mockResolvedValue("transaction result");
      
      mockSession.withTransaction.mockImplementation(async (fn) => {
        await fn();
      });
      
      const result = await manager.withTransaction(transactionFn);
      
      expect(result).toBe("transaction result");
      expect(transactionFn).toHaveBeenCalledWith(mockSession);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it("should handle transaction errors", async () => {
      const config = { uri: "mongodb://localhost:27017/test" };
      manager.setConfig(config);
      
      mockClient.db.mockReturnValue(mockDb);
      await manager.connect();
      
      const mockSession = mockClient.startSession();
      const error = new Error("Transaction failed");
      
      mockSession.withTransaction.mockRejectedValue(error);
      
      await expect(manager.withTransaction(() => Promise.resolve("result" as any)))
        .rejects.toThrow("Transaction failed");
      
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
