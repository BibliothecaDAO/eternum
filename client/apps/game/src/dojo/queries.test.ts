/* @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import { ToriiQueryTimeoutError, createToriiTimedQuery } from "./torii-query-timeout";

describe("createToriiTimedQuery", () => {
  it("times out the observed query result without treating the underlying work as settled", async () => {
    vi.useFakeTimers();
    try {
      let resolveWork: ((value: string) => void) | null = null;
      const work = new Promise<string>((resolve) => {
        resolveWork = resolve;
      });

      const timedQuery = createToriiTimedQuery("worldmap exact tile fetch", 50, work);
      const completionSpy = vi.fn();
      void timedQuery.completion.then(completionSpy);
      const timedError = timedQuery.timed.catch((error) => error);

      await vi.advanceTimersByTimeAsync(50);

      await expect(timedError).resolves.toBeInstanceOf(ToriiQueryTimeoutError);
      expect(completionSpy).not.toHaveBeenCalled();

      resolveWork?.("done");
      await Promise.resolve();

      await expect(timedQuery.completion).resolves.toBeUndefined();
      expect(completionSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
