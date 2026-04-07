import { afterEach, describe, expect, it, vi } from "vitest";

import { settleWorldmapAsyncStage } from "./worldmap-async-timeout";

describe("settleWorldmapAsyncStage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the resolved value before the timeout expires", async () => {
    const result = await settleWorldmapAsyncStage({
      label: "tile_fetch",
      promise: Promise.resolve("ok"),
      timeoutMs: 25,
    });

    expect(result).toEqual({
      status: "resolved",
      value: "ok",
    });
  });

  it("reports a timed out stage when the promise never settles", async () => {
    vi.useFakeTimers();

    const onTimeout = vi.fn();
    const stalledPromise = new Promise<string>(() => {});
    const resultPromise = settleWorldmapAsyncStage({
      label: "bounds_ready",
      promise: stalledPromise,
      timeoutMs: 25,
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(25);

    await expect(resultPromise).resolves.toEqual({
      status: "timed_out",
    });
    expect(onTimeout).toHaveBeenCalledWith({
      label: "bounds_ready",
      timeoutMs: 25,
    });
  });

  it("waits for the original promise when the timeout is disabled", async () => {
    const result = await settleWorldmapAsyncStage({
      label: "asset_prewarm",
      promise: Promise.resolve("ready"),
      timeoutMs: 0,
    });

    expect(result).toEqual({
      status: "resolved",
      value: "ready",
    });
  });
});
