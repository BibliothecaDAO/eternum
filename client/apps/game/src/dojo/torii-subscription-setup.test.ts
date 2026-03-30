// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { setupToriiSubscriptions } from "./torii-subscription-setup";

describe("setupToriiSubscriptions", () => {
  it("cancels the entity subscription when the event subscription setup times out", async () => {
    vi.useFakeTimers();

    const cancelEntitySubscription = vi.fn();
    const setupPromise = setupToriiSubscriptions({
      createEntitySubscription: vi.fn().mockResolvedValue({ cancel: cancelEntitySubscription }),
      createEventSubscription: vi.fn(() => new Promise(() => {})),
      subscriptionSetupTimeoutMs: 25,
    });
    const rejectionAssertion = expect(setupPromise).rejects.toThrow(/event subscription/i);

    await vi.advanceTimersByTimeAsync(25);

    await rejectionAssertion;
    expect(cancelEntitySubscription).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("cancels a subscription that resolves after timing out", async () => {
    vi.useFakeTimers();

    const cancelLateEventSubscription = vi.fn();
    let resolveEventSubscription!: (subscription: { cancel: () => void }) => void;

    const setupPromise = setupToriiSubscriptions({
      createEntitySubscription: vi.fn().mockResolvedValue({ cancel: vi.fn() }),
      createEventSubscription: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveEventSubscription = resolve;
          }),
      ),
      subscriptionSetupTimeoutMs: 25,
    });
    const rejectionAssertion = expect(setupPromise).rejects.toThrow(/event subscription/i);

    await vi.advanceTimersByTimeAsync(25);
    await rejectionAssertion;

    resolveEventSubscription({ cancel: cancelLateEventSubscription });
    await Promise.resolve();

    expect(cancelLateEventSubscription).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
