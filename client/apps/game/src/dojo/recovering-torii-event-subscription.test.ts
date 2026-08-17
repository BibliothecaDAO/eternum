// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecoveringToriiEventSubscription } from "./recovering-torii-event-subscription";

afterEach(() => vi.useRealTimers());

describe("createRecoveringToriiEventSubscription", () => {
  it("re-subscribes with backoff after an observable stream failure", async () => {
    vi.useFakeTimers();
    const handlers: Record<string, (error?: unknown) => void> = {};
    const first = {
      cancel: vi.fn(),
      on: (event: string, handler: (error?: unknown) => void) => {
        handlers[event] = handler;
      },
      off: vi.fn(),
    };
    const second = { cancel: vi.fn(), on: vi.fn(), off: vi.fn() };
    const createSubscription = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const replaySince = vi.fn(async () => 2);
    const onGapFillReplayed = vi.fn();
    const subscription = await createRecoveringToriiEventSubscription({
      createSubscription,
      establishReplayBaseline: vi.fn(async () => undefined),
      captureReplayWatermark: () => ({ timestamp: 10n }),
      replaySince,
      onGapFillReplayed,
      onLost,
      onRestored,
      retryDelayMs: () => 10,
    });

    handlers.error?.(new Error("HTTP2 stream failed"));
    expect(onLost).toHaveBeenCalledWith("HTTP2 stream failed");
    await vi.advanceTimersByTimeAsync(10);

    expect(createSubscription).toHaveBeenCalledTimes(2);
    expect(replaySince).toHaveBeenCalledWith({ timestamp: 10n });
    expect(onGapFillReplayed).toHaveBeenCalledWith(2);
    expect(onRestored).toHaveBeenCalledOnce();
    expect(first.cancel).toHaveBeenCalledOnce();
    subscription.cancel();
    expect(second.cancel).toHaveBeenCalledOnce();
  });

  it("renews cancel-only streams and recovers a failed lease attempt", async () => {
    vi.useFakeTimers();
    const first = { cancel: vi.fn() };
    const second = { cancel: vi.fn() };
    const createSubscription = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error("route unavailable"))
      .mockResolvedValueOnce(second);
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const replaySince = vi.fn(async () => 1);
    const subscription = await createRecoveringToriiEventSubscription({
      createSubscription,
      establishReplayBaseline: vi.fn(async () => undefined),
      captureReplayWatermark: () => ({ timestamp: 12n }),
      replaySince,
      onLost,
      onRestored,
      leaseMs: 20,
      retryDelayMs: () => 10,
    });

    await vi.advanceTimersByTimeAsync(20);
    expect(onLost).toHaveBeenCalledWith("route unavailable");
    await vi.advanceTimersByTimeAsync(10);

    expect(onRestored).toHaveBeenCalledOnce();
    expect(replaySince).toHaveBeenCalledOnce();
    expect(first.cancel).toHaveBeenCalledOnce();
    subscription.cancel();
    expect(second.cancel).toHaveBeenCalledOnce();
  });
});
