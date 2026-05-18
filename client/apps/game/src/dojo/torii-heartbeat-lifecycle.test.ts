import { describe, expect, it, vi } from "vitest";

import { createToriiHeartbeatLifecycle } from "./torii-heartbeat-lifecycle";

describe("createToriiHeartbeatLifecycle", () => {
  it("opens a heartbeat subscription on start", async () => {
    const subscribe = vi.fn(async () => ({ cancel: vi.fn() }));
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe });

    await lifecycle.start();

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("cancels the previous subscription and re-subscribes on reopen", async () => {
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    const subscribe = vi.fn().mockResolvedValueOnce({ cancel: cancelA }).mockResolvedValueOnce({ cancel: cancelB });
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe });

    await lifecycle.start();
    await lifecycle.reopen();

    expect(cancelA).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(cancelB).not.toHaveBeenCalled();
  });

  it("can reopen with an explicit fresh subscribe function", async () => {
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    const subscribe = vi.fn(async () => ({ cancel: cancelA }));
    const subscribeFresh = vi.fn(async () => ({ cancel: cancelB }));
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe });

    await lifecycle.start();
    await lifecycle.reopenWith(subscribeFresh);

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribeFresh).toHaveBeenCalledTimes(1);
    expect(cancelA).toHaveBeenCalledTimes(1);
    expect(cancelB).not.toHaveBeenCalled();
  });

  it("keeps the newest subscription when an older open resolves after reopen", async () => {
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    let resolveA: (subscription: { cancel: () => void }) => void = () => undefined;
    let resolveB: (subscription: { cancel: () => void }) => void = () => undefined;
    const subscribe = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ cancel: () => void }>((resolve) => {
            resolveA = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ cancel: () => void }>((resolve) => {
            resolveB = resolve;
          }),
      );
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe });

    const starting = lifecycle.start();
    const reopening = lifecycle.reopen();

    resolveB({ cancel: cancelB });
    await reopening;
    resolveA({ cancel: cancelA });
    await starting;

    expect(cancelA).toHaveBeenCalledTimes(1);
    expect(cancelB).not.toHaveBeenCalled();
  });

  it("cancels an in-flight subscribe if disposed before it resolves", async () => {
    const cancel = vi.fn();
    let resolveSub: (s: { cancel: () => void }) => void = () => undefined;
    const subscribe = vi.fn(
      () =>
        new Promise<{ cancel: () => void }>((resolve) => {
          resolveSub = resolve;
        }),
    );
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe });

    const starting = lifecycle.start();
    lifecycle.dispose();
    resolveSub({ cancel });
    await starting;

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("is safe to dispose more than once", async () => {
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe: vi.fn(async () => ({ cancel: vi.fn() })) });
    await lifecycle.start();
    lifecycle.dispose();
    lifecycle.dispose();
  });

  it("does not throw when subscribe resolves with null", async () => {
    const lifecycle = createToriiHeartbeatLifecycle({ subscribe: vi.fn(async () => null) });
    await lifecycle.start();
    await lifecycle.reopen();
    lifecycle.dispose();
  });
});
