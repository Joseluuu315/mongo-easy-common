import { describe, expect, it, vi } from "vitest";
import { createMongoManager } from "../src/index";

describe("retry", () => {
  const manager = createMongoManager();

  it("retries and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValueOnce("ok");

    const result = await manager.retry(fn, { retries: 3, delayMs: 1 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately when isRetryable returns false", async () => {
    const err = new Error("fatal");
    const fn = vi.fn().mockRejectedValue(err);
    const isRetryable = vi.fn().mockReturnValue(false);

    await expect(
      manager.retry(fn, { retries: 3, delayMs: 1, isRetryable })
    ).rejects.toThrow("fatal");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(isRetryable).toHaveBeenCalledWith(err);
  });

  it("exhausts all retries and throws the last error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockRejectedValueOnce(new Error("fail-3"))
      .mockRejectedValueOnce(new Error("fail-4"));

    await expect(
      manager.retry(fn, { retries: 3, delayMs: 1 })
    ).rejects.toThrow("fail-4");

    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("succeeds on the first attempt without retrying", async () => {
    const fn = vi.fn().mockResolvedValueOnce("immediate");

    const result = await manager.retry(fn, { retries: 3, delayMs: 1 });

    expect(result).toBe("immediate");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects the delay between retries", async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");

    const promise = manager.retry(fn, { retries: 2, delayMs: 500 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    vi.useRealTimers();
  });

  it("passes the correct error to isRetryable on each attempt", async () => {
    const errors = [new Error("err-1"), new Error("err-2")];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(errors[0])
      .mockRejectedValueOnce(errors[1])
      .mockResolvedValueOnce("ok");

    const isRetryable = vi.fn().mockReturnValue(true);

    await manager.retry(fn, { retries: 3, delayMs: 1, isRetryable });

    expect(isRetryable).toHaveBeenNthCalledWith(1, errors[0]);
    expect(isRetryable).toHaveBeenNthCalledWith(2, errors[1]);
  });
});