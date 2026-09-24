import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForEntitySubscriptionState } from "./selected-world-entity-wait";

describe("waitForEntitySubscriptionState", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses the deadline as an alarm and resolves only after a pushed change matches", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let onChange = () => {};
    let value = 0;
    const unsubscribe = vi.fn();

    const result = waitForEntitySubscriptionState({
      description: "test state",
      isTarget: (current) => current >= 2,
      read: async () => value,
      slowAfterMs: 100,
      subscribe: async (listener) => {
        onChange = listener;
        return unsubscribe;
      },
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(warn).toHaveBeenCalledWith("[GameEntry] test state is still waiting after 100ms");
    expect(unsubscribe).not.toHaveBeenCalled();

    value = 2;
    onChange();

    await expect(result).resolves.toBe(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("cancels the subscription when its owning flow is abandoned", async () => {
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    const result = waitForEntitySubscriptionState({
      description: "test state",
      isTarget: () => false,
      read: async () => 0,
      signal: controller.signal,
      slowAfterMs: 10_000,
      subscribe: async () => unsubscribe,
    });

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
