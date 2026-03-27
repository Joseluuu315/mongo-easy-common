import { describe, it, expect } from "vitest";
import { MongoEasyError } from "../src/errors";

describe("MongoEasyError", () => {
  it("should create error with message", () => {
    const message = "Test error message";
    const error = new MongoEasyError(message);

    expect(error.name).toBe("MongoEasyError");
    expect(error.message).toBe(`MongoEasyManager: ${message}`);
  });

  it("should maintain stack trace", () => {
    const message = "Test error message";
    const error = new MongoEasyError(message);

    // Check that stack trace includes the error constructor
    expect(error.stack).toContain("MongoEasyError");
  });

  it("should be instance of Error", () => {
    const error = new MongoEasyError("Test");
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MongoEasyError);
  });

  it("should handle empty message", () => {
    const error = new MongoEasyError("");
    
    expect(error.message).toBe("MongoEasyManager: ");
  });

  it("should handle special characters in message", () => {
    const message = "Error with special chars: !@#$%^&*()";
    const error = new MongoEasyError(message);
    
    expect(error.message).toBe(`MongoEasyManager: ${message}`);
  });
});
