import { ObjectId } from "mongodb";
import { MongoEasyError } from "./errors";
import { UpdateFilter, Document } from "./types";

/**
 * Safely convert a string or ObjectId to ObjectId.
 * Throws `MongoEasyError` if the string is not a valid ObjectId.
 * 
 * @param id - The ID to convert (string or ObjectId)
 * @returns ObjectId instance
 * @throws MongoEasyError if the ID is invalid
 */
export function toObjectId(id: string | ObjectId): ObjectId {
  if (id instanceof ObjectId) return id;
  
  if (!ObjectId.isValid(id)) {
    throw new MongoEasyError(`Invalid ObjectId: "${id}"`);
  }
  
  return new ObjectId(id);
}

/**
 * Build a `$set`-only update from a partial object, ignoring `undefined`
 * values so they don't overwrite existing fields.
 * 
 * @param partial - Partial object with fields to set
 * @returns MongoDB update filter with $set operator
 * 
 * @example
 * await users.updateById(id, setFields({ name: "Alice", age: undefined }));
 * // => { $set: { name: "Alice" } }
 */
export function setFields<T extends Document>(
  partial: Partial<T>
): UpdateFilter<T> {
  const clean = Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== undefined)
  );
  return { $set: clean } as UpdateFilter<T>;
}

/**
 * Build a standard `createdAt` / `updatedAt` timestamp object to spread
 * into insert payloads.
 * 
 * @returns Object with current timestamp for both fields
 */
export function timestamps(): { createdAt: Date; updatedAt: Date } {
  const now = new Date();
  return { createdAt: now, updatedAt: now };
}

/**
 * Return a `$set` update that bumps `updatedAt` to now, merged with any
 * additional fields.
 * 
 * @param extra - Additional fields to include in the update
 * @returns MongoDB update filter with updatedAt and additional fields
 */
export function touch<T extends Document>(
  extra: Partial<T> = {}
): UpdateFilter<T> {
  return setFields<T>({ ...extra, updatedAt: new Date() } as Partial<T>);
}

/**
 * Validates that a value is not null or undefined
 * 
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws MongoEasyError if value is null or undefined
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined) {
    throw new MongoEasyError(`${fieldName} is required`);
  }
  return value;
}

/**
 * Sanitizes a string value by trimming and validating it's not empty
 * 
 * @param value - String value to sanitize
 * @param fieldName - Name of the field for error messages
 * @returns Sanitized string
 * @throws MongoEasyError if value is empty after trimming
 */
export function sanitizeString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MongoEasyError(`${fieldName} cannot be empty`);
  }
  return trimmed;
}
