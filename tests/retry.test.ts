import { describe, expect, it, vi } from "vitest";
import { createMongoManager } from "../src/index";

describe("retry", () => {
  it("retries and eventually succeeds", async () => {
    const manager = createMongoManager();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValueOnce("ok");

    const result = await manager.retry(fn, { retries: 3, delayMs: 1 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops when isRetryable returns false", async () => {
    const manager = createMongoManager();
    const err = new Error("fatal");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      manager.retry(fn, {
        retries: 3,
        delayMs: 1,
        isRetryable: () => false,
      }),
    ).rejects.toThrow("fatal");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
