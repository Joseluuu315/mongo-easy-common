import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { toObjectId, setFields, timestamps, touch, validateRequired, sanitizeString } from "../src/utils";
import { MongoEasyError } from "../src/errors";

describe("Utils", () => {
  describe("toObjectId", () => {
    it("should return ObjectId if input is already ObjectId", () => {
      const oid = new ObjectId();
      expect(toObjectId(oid)).toBe(oid);
    });

    it("should convert valid string to ObjectId", () => {
      const oid = new ObjectId();
      const result = toObjectId(oid.toHexString());
      expect(result).toEqual(oid);
    });

    it("should throw MongoEasyError for invalid string", () => {
      expect(() => toObjectId("invalid-id")).toThrow(MongoEasyError);
      expect(() => toObjectId("")).toThrow(MongoEasyError);
      expect(() => toObjectId("123")).toThrow(MongoEasyError);
    });
  });

  describe("setFields", () => {
    it("should create $set update from partial object", () => {
      const partial = { name: "Alice", age: 30 };
      const result = setFields(partial);
      expect(result).toEqual({ $set: partial });
    });

    it("should filter out undefined values", () => {
      const partial = { name: "Alice", age: undefined, active: true };
      const result = setFields(partial);
      expect(result).toEqual({ $set: { name: "Alice", active: true } });
    });

    it("should handle empty object", () => {
      const result = setFields({});
      expect(result).toEqual({ $set: {} });
    });
  });

  describe("timestamps", () => {
    it("should return object with createdAt and updatedAt", () => {
      const result = timestamps();
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("updatedAt");
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.createdAt).toEqual(result.updatedAt);
    });
  });

  describe("touch", () => {
    it("should return $set update with updatedAt", () => {
      const result = touch();
      expect(result).toHaveProperty("$set");
      expect(result.$set).toHaveProperty("updatedAt");
      expect(result.$set.updatedAt).toBeInstanceOf(Date);
    });

    it("should merge extra fields with updatedAt", () => {
      const extra = { name: "Alice", active: true };
      const result = touch(extra);
      expect(result.$set).toHaveProperty("updatedAt");
      expect(result.$set).toHaveProperty("name", "Alice");
      expect(result.$set).toHaveProperty("active", true);
    });
  });

  describe("validateRequired", () => {
    it("should return value if not null or undefined", () => {
      expect(validateRequired("test", "field")).toBe("test");
      expect(validateRequired(0, "field")).toBe(0);
      expect(validateRequired(false, "field")).toBe(false);
    });

    it("should throw MongoEasyError for null", () => {
      expect(() => validateRequired(null, "testField")).toThrow(
        "testField is required"
      );
    });

    it("should throw MongoEasyError for undefined", () => {
      expect(() => validateRequired(undefined, "testField")).toThrow(
        "testField is required"
      );
    });
  });

  describe("sanitizeString", () => {
    it("should trim whitespace", () => {
      expect(sanitizeString("  hello  ", "field")).toBe("hello");
    });

    it("should throw MongoEasyError for empty string", () => {
      expect(() => sanitizeString("", "field")).toThrow("field cannot be empty");
      expect(() => sanitizeString("   ", "field")).toThrow("field cannot be empty");
    });

    it("should return trimmed string for valid input", () => {
      expect(sanitizeString("valid", "field")).toBe("valid");
    });
  });
});
