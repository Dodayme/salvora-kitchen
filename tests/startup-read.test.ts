import { afterEach, describe, expect, it, vi } from "vitest";
import { readWithStartupRetry } from "../src/lib/http/startup-read";
import { ApiClientError } from "../src/lib/http/client";
afterEach(() => vi.useRealTimers());
describe("public catalog startup recovery", () => {
  it("recovers a transient server error", async () => {
    vi.useFakeTimers(); const read = vi.fn().mockRejectedValueOnce(new ApiClientError(500, "INTERNAL_ERROR", "", "http")).mockResolvedValue("product");
    const result = readWithStartupRetry(read, new AbortController().signal); await vi.runAllTimersAsync();
    expect(await result).toBe("product"); expect(read).toHaveBeenCalledTimes(2);
  });
  it("stops after three total attempts", async () => {
    vi.useFakeTimers(); const error = new ApiClientError(503, "UNAVAILABLE", "", "http"), read = vi.fn().mockRejectedValue(error);
    const result = expect(readWithStartupRetry(read, new AbortController().signal)).rejects.toBe(error);
    await vi.runAllTimersAsync(); await result; expect(read).toHaveBeenCalledTimes(3);
  });
  it("does not retry missing products or invalid responses", async () => {
    for (const error of [new ApiClientError(404, "NOT_FOUND", "", "http"), new ApiClientError(200, "INVALID_RESPONSE", "", "protocol")]) {
      const read = vi.fn().mockRejectedValue(error); await expect(readWithStartupRetry(read, new AbortController().signal)).rejects.toBe(error); expect(read).toHaveBeenCalledOnce();
    }
  });
  it("cancels retries when leaving the page", async () => {
    vi.useFakeTimers(); const controller = new AbortController(), read = vi.fn().mockRejectedValue(new ApiClientError(500, "INTERNAL_ERROR", "", "http"));
    const result = expect(readWithStartupRetry(read, controller.signal)).rejects.toMatchObject({ kind: "aborted" });
    await vi.advanceTimersByTimeAsync(0); controller.abort(); await result; await vi.runAllTimersAsync(); expect(read).toHaveBeenCalledOnce();
  });
});
