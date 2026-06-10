// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setupToriiSubscriptions,
  updateToriiSubscriptions,
  type ToriiCancelableSubscription,
} from "./torii-subscription-setup";

describe("setupToriiSubscriptions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts entity and event subscription setup concurrently", async () => {
    let resolveEntitySubscription!: (subscription: ToriiCancelableSubscription) => void;
    const createEntitySubscription = vi.fn(
      (): Promise<ToriiCancelableSubscription> =>
        new Promise<ToriiCancelableSubscription>((resolve) => {
          resolveEntitySubscription = resolve;
        }),
    );
    const createEventSubscription = vi.fn(async (): Promise<ToriiCancelableSubscription> => ({ cancel: vi.fn() }));

    const setupPromise = setupToriiSubscriptions({
      createEntitySubscription,
      createEventSubscription,
    });

    await Promise.resolve();
    expect(createEntitySubscription).toHaveBeenCalledTimes(1);
    expect(createEventSubscription).toHaveBeenCalledTimes(1);

    resolveEntitySubscription({ cancel: vi.fn() });
    await setupPromise;
  });

  it("cancels the entity subscription when the event subscription setup times out", async () => {
    vi.useFakeTimers();

    const cancelEntitySubscription = vi.fn();
    const onSubscriptionSetupTimeout = vi.fn();
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
      onSubscriptionSetupTimeout,
    });
    const rejectionAssertion = expect(setupPromise).rejects.toThrow(/event subscription/i);

    await vi.advanceTimersByTimeAsync(25);

    await rejectionAssertion;
    expect(cancelEntitySubscription).toHaveBeenCalledTimes(1);
    expect(onSubscriptionSetupTimeout).toHaveBeenCalledWith({
      label: "event subscription",
      timeoutMs: 25,
    });
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
  });

  it("cancels a slower subscription when the other setup fails first", async () => {
    const cancelLateEntitySubscription = vi.fn();
    let resolveEntitySubscription!: (subscription: ToriiCancelableSubscription) => void;
    const createEntitySubscription = vi.fn(
      (): Promise<ToriiCancelableSubscription> =>
        new Promise<ToriiCancelableSubscription>((resolve) => {
          resolveEntitySubscription = resolve;
        }),
    );
    const createEventSubscription = vi.fn(async (): Promise<ToriiCancelableSubscription> => {
      throw new Error("event setup failed");
    });

    const setupPromise = setupToriiSubscriptions({
      createEntitySubscription,
      createEventSubscription,
    });

    await expect(setupPromise).rejects.toThrow(/event setup failed/);

    resolveEntitySubscription({ cancel: cancelLateEntitySubscription });
    await Promise.resolve();
    await Promise.resolve();

    expect(cancelLateEntitySubscription).toHaveBeenCalledTimes(1);
  });
});

describe("updateToriiSubscriptions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("updates entity and event subscriptions concurrently", async () => {
    let resolveEntityUpdate!: () => void;
    const updateEntitySubscription = vi.fn(
      (): Promise<void> =>
        new Promise<void>((resolve) => {
          resolveEntityUpdate = resolve;
        }),
    );
    const updateEventSubscription = vi.fn(async (): Promise<void> => undefined);

    const updatePromise = updateToriiSubscriptions({
      updateEntitySubscription,
      updateEventSubscription,
    });

    await Promise.resolve();
    expect(updateEntitySubscription).toHaveBeenCalledTimes(1);
    expect(updateEventSubscription).toHaveBeenCalledTimes(1);

    resolveEntityUpdate();
    await updatePromise;
  });

  it("reports the timed out update side with a subscription update label", async () => {
    vi.useFakeTimers();

    const onSubscriptionSetupTimeout = vi.fn();
    const updateEntitySubscription = vi.fn(async (): Promise<void> => undefined);
    const updateEventSubscription = vi.fn((): Promise<void> => new Promise<void>(() => {}));

    const updatePromise = updateToriiSubscriptions({
      updateEntitySubscription,
      updateEventSubscription,
      subscriptionSetupTimeoutMs: 25,
      onSubscriptionSetupTimeout,
    });
    const rejectionAssertion = expect(updatePromise).rejects.toThrow(/event subscription update/i);

    await vi.advanceTimersByTimeAsync(25);

    await rejectionAssertion;
    expect(onSubscriptionSetupTimeout).toHaveBeenCalledWith({
      label: "event subscription update",
      timeoutMs: 25,
    });
  });
});
