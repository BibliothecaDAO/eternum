// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { setupToriiSubscriptions, type ToriiCancelableSubscription } from "./torii-subscription-setup";

describe("setupToriiSubscriptions", () => {
  it("cancels the entity subscription when the event subscription setup times out", async () => {
    vi.useFakeTimers();

    const cancelEntitySubscription = vi.fn();
    const createEntitySubscription = vi.fn(
      async (): Promise<ToriiCancelableSubscription> => ({ cancel: cancelEntitySubscription }),
    );
    const createEventSubscription = vi.fn(
      (): Promise<ToriiCancelableSubscription> => new Promise<ToriiCancelableSubscription>(() => {}),
    );
    const setupPromise = setupToriiSubscriptions({
      createEntitySubscription,
      createEventSubscription,
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
    let resolveEventSubscription!: (subscription: ToriiCancelableSubscription) => void;
    const createEntitySubscription = vi.fn(async (): Promise<ToriiCancelableSubscription> => ({ cancel: vi.fn() }));
    const createEventSubscription = vi.fn(
      (): Promise<ToriiCancelableSubscription> =>
        new Promise<ToriiCancelableSubscription>((resolve) => {
          resolveEventSubscription = resolve;
        }),
    );

    const setupPromise = setupToriiSubscriptions({
      createEntitySubscription,
      createEventSubscription,
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
