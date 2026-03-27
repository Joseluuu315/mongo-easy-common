/**
 * Custom error class for MongoEasy operations
 */
export class MongoEasyError extends Error {
  constructor(message: string) {
    super(`MongoEasyManager: ${message}`);
    this.name = "MongoEasyError";
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MongoEasyError);
    }
  }
}
