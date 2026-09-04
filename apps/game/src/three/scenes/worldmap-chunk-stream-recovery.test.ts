import { describe, expect, it, vi } from "vitest";

import { runChunkStreamResubscribeThenRefresh } from "./worldmap-chunk-stream-recovery";

describe("runChunkStreamResubscribeThenRefresh", () => {
  it("waits for resubscribe to complete before scheduling refresh", async () => {
    const order: string[] = [];
    let resolveResub: () => void = () => undefined;
    const resubscribe = vi.fn(
      () =>
        new Promise<{ outcome: string } | null>((resolve) => {
          resolveResub = () => {
            order.push("resubscribe");
            resolve({ outcome: "applied" });
          };
        }),
    );
    const scheduleRefresh = vi.fn(() => {
      order.push("refresh");
    });

    const run = runChunkStreamResubscribeThenRefresh({ resubscribe, scheduleRefresh });
    expect(scheduleRefresh).not.toHaveBeenCalled();
    resolveResub();
    await run;

    expect(order).toEqual(["resubscribe", "refresh"]);
  });

  it("still schedules refresh if resubscribe rejects", async () => {
    const resubscribe = vi.fn(async () => {
      throw new Error("resub failed");
    });
    const scheduleRefresh = vi.fn();
    const onError = vi.fn();

    await runChunkStreamResubscribeThenRefresh({ resubscribe, scheduleRefresh, onError });

    expect(scheduleRefresh).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("schedules refresh when no resubscribe handle is provided", async () => {
    const scheduleRefresh = vi.fn();
    await runChunkStreamResubscribeThenRefresh({ resubscribe: null, scheduleRefresh });
    expect(scheduleRefresh).toHaveBeenCalledTimes(1);
  });

  it("forwards the resubscribe result to the caller via onResubscribed", async () => {
    const onResubscribed = vi.fn();
    const resubscribe = vi.fn(async () => ({ outcome: "applied" }));
    await runChunkStreamResubscribeThenRefresh({
      resubscribe,
      scheduleRefresh: vi.fn(),
      onResubscribed,
    });
    expect(onResubscribed).toHaveBeenCalledWith({ outcome: "applied" });
  });
});
