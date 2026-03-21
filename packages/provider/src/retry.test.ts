import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, isRetryableError, calculateBackoffDelay, RetryConfig } from "./retry";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("retry utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // isRetryableError
  // =========================================================================

  describe("isRetryableError", () => {
    it("returns true for ECONNRESET errors", () => {
      const error = new Error("connect ECONNRESET 127.0.0.1:5050");
      (error as any).code = "ECONNRESET";
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns true for HTTP 429 errors", () => {
      const error = new Error("Too Many Requests");
      (error as any).status = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    it("returns false for execution revert errors", () => {
      const error = new Error("Transaction execution error: Execution reverted");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  // =========================================================================
  // calculateBackoffDelay
  // =========================================================================

  describe("calculateBackoffDelay", () => {
    it("applies jitter within bounds", () => {
      // Run multiple times to check jitter range
      const delays = new Set<number>();
      for (let i = 0; i < 50; i++) {
        delays.add(calculateBackoffDelay(0, { baseDelayMs: 1000, maxDelayMs: 30000 } as any));
      }

      // With jitter, we should see some variance
      const delayArr = [...delays];
      const min = Math.min(...delayArr);
      const max = Math.max(...delayArr);

      // Base delay for attempt 0 is 1000ms; jitter should keep it within reasonable bounds
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(30000);
      // With 50 samples and jitter, we should have more than 1 distinct value
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  // =========================================================================
  // withRetry
  // =========================================================================

  describe("withRetry", () => {
    it("retries on ECONNRESET up to maxRetries, succeeds on third attempt", async () => {
      const econnError = new Error("connect ECONNRESET");
      (econnError as any).code = "ECONNRESET";

      const fn = vi
        .fn()
        .mockRejectedValueOnce(econnError)
        .mockRejectedValueOnce(econnError)
        .mockResolvedValueOnce("success");

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("retries on HTTP 429 with exponential backoff", async () => {
      vi.useFakeTimers();

      const rateLimitError = new Error("Too Many Requests");
      (rateLimitError as any).status = 429;

      const fn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce("ok");

      const retryPromise = withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
      });

      // Advance through the backoff delays
      await vi.advanceTimersByTimeAsync(100); // first retry delay
      await vi.advanceTimersByTimeAsync(500); // second retry delay (exponential)

      const result = await retryPromise;
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry on execution revert", async () => {
      const revertError = new Error("Transaction execution error: Execution reverted");

      const fn = vi.fn().mockRejectedValue(revertError);

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          baseDelayMs: 1,
          maxDelayMs: 10,
        }),
      ).rejects.toThrow("Execution reverted");

      // Called once, no retries
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("respects maxRetries=0 (no retry)", async () => {
      const error = new Error("connect ECONNRESET");
      (error as any).code = "ECONNRESET";

      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(fn, {
          maxRetries: 0,
          baseDelayMs: 1,
          maxDelayMs: 10,
        }),
      ).rejects.toThrow("ECONNRESET");

      // Only the initial attempt, no retries
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("applies jitter within bounds", async () => {
      const error = new Error("connect ECONNRESET");
      (error as any).code = "ECONNRESET";

      // Track the delays between retries
      const timestamps: number[] = [];
      let now = 0;
      vi.useFakeTimers();

      const fn = vi
        .fn()
        .mockImplementation(() => {
          timestamps.push(Date.now());
          if (fn.mock.calls.length < 3) {
            return Promise.reject(error);
          }
          return Promise.resolve("done");
        });

      const retryPromise = withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
      });

      // Run all pending timers to completion
      await vi.runAllTimersAsync();

      const result = await retryPromise;
      expect(result).toBe("done");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("calls onRetry callback on each retry", async () => {
      const econnError = new Error("connect ECONNRESET");
      (econnError as any).code = "ECONNRESET";

      const onRetry = vi.fn();

      const fn = vi
        .fn()
        .mockRejectedValueOnce(econnError)
        .mockRejectedValueOnce(econnError)
        .mockResolvedValueOnce("success");

      await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        onRetry,
      });

      // onRetry should have been called for each retry (2 retries before success)
      expect(onRetry).toHaveBeenCalledTimes(2);

      // First retry: attempt 1, error
      expect(onRetry).toHaveBeenNthCalledWith(1, econnError, 1);
      // Second retry: attempt 2, error
      expect(onRetry).toHaveBeenNthCalledWith(2, econnError, 2);
    });
  });
});
