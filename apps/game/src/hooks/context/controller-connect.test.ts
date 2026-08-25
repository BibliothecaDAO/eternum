import { afterEach, describe, expect, it, vi } from "vitest";

import {
  connectWithControllerRetry,
  createOwnedControllerReconnect,
  pickPrimaryConnector,
  type ControllerReconnectState,
  warmControllerConnector,
} from "./controller-connect";

const createDeferredConnection = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe("controller-connect", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers the controller connector when available", () => {
    const connectors = [{ id: "braavos" }, { id: "controller" }, { id: "argent" }] as any[];
    const picked = pickPrimaryConnector(connectors as any);
    expect(picked?.id).toBe("controller");
  });

  it("warms controller connector only when not ready", async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const connector = {
      id: "controller",
      isReady: vi.fn().mockReturnValue(false),
      controller: { probe },
    } as any;

    await warmControllerConnector(connector);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("retries once after a not-ready connect error", async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const connector = {
      id: "controller",
      isReady: vi.fn().mockReturnValue(false),
      controller: { probe },
    } as any;

    const connectAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error("Not ready to connect"))
      .mockResolvedValueOnce(undefined);

    await connectWithControllerRetry(connectAsync, connector);

    expect(probe).toHaveBeenCalledTimes(2);
    expect(connectAsync).toHaveBeenCalledTimes(2);
  });

  it("does not retry for non-readiness errors", async () => {
    const connector = {
      id: "controller",
      isReady: vi.fn().mockReturnValue(true),
      controller: { probe: vi.fn() },
    } as any;

    const connectAsync = vi.fn().mockRejectedValueOnce(new Error("user rejected"));

    await expect(connectWithControllerRetry(connectAsync, connector)).rejects.toThrow("user rejected");
    expect(connectAsync).toHaveBeenCalledTimes(1);
  });

  it("starts only one owned attempt for repeated connection actions", async () => {
    const states: ControllerReconnectState[] = [];
    const reconnect = createOwnedControllerReconnect({ onStateChange: (state) => states.push(state) });
    const connectAsync = vi.fn(() => new Promise<void>(() => {}));
    const attempt = {
      connectAsync,
      connectors: [{ id: "controller", isReady: () => true }] as any[],
    };

    expect(reconnect.start(attempt)).toBe(true);
    expect(reconnect.start(attempt)).toBe(false);
    await Promise.resolve();

    expect(connectAsync).toHaveBeenCalledTimes(1);
    expect(states).toEqual([{ error: null, status: "connecting" }]);
    reconnect.retire();
  });

  it("fails an owned attempt at its deadline", async () => {
    vi.useFakeTimers();
    const states: ControllerReconnectState[] = [];
    const reconnect = createOwnedControllerReconnect({
      onStateChange: (state) => states.push(state),
      timeoutMs: 15_000,
    });
    const connectAsync = vi.fn(() => new Promise<void>(() => {}));

    reconnect.start({
      connectAsync,
      connectors: [{ id: "controller", isReady: () => true }] as any[],
    });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(states.at(-1)).toEqual({
      error: "Controller connection timed out after 15 seconds. Check your keychain and try again.",
      status: "failed",
    });
  });

  it("reports a readable final connector rejection", async () => {
    const states: ControllerReconnectState[] = [];
    const reconnect = createOwnedControllerReconnect({ onStateChange: (state) => states.push(state) });
    const connectAsync = vi.fn().mockRejectedValue(new Error("user rejected"));

    reconnect.start({
      connectAsync,
      connectors: [{ id: "controller", isReady: () => true }] as any[],
    });
    await vi.waitFor(() => expect(states.at(-1)).toEqual({ error: "user rejected", status: "failed" }));
  });

  it("starts exactly one new attempt and clears the error after a successful retry", async () => {
    const states: ControllerReconnectState[] = [];
    const reconnect = createOwnedControllerReconnect({ onStateChange: (state) => states.push(state) });
    const connectAsync = vi.fn().mockRejectedValueOnce(new Error("user rejected")).mockResolvedValueOnce(undefined);
    const attempt = {
      connectAsync,
      connectors: [{ id: "controller", isReady: () => true }] as any[],
    };

    reconnect.start(attempt);
    await vi.waitFor(() => expect(states.at(-1)).toEqual({ error: "user rejected", status: "failed" }));

    expect(reconnect.start(attempt)).toBe(true);
    expect(reconnect.start(attempt)).toBe(false);
    await vi.waitFor(() => expect(states.at(-1)).toEqual({ error: null, status: "idle" }));
    expect(connectAsync).toHaveBeenCalledTimes(2);
  });

  it("ignores completion from an explicitly retired attempt", async () => {
    const states: ControllerReconnectState[] = [];
    const reconnect = createOwnedControllerReconnect({ onStateChange: (state) => states.push(state) });
    const firstAttempt = createDeferredConnection();
    const secondAttempt = createDeferredConnection();
    const connectAsync = vi
      .fn()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => secondAttempt.promise);
    const attempt = {
      connectAsync,
      connectors: [{ id: "controller", isReady: () => true }] as any[],
    };

    reconnect.start(attempt);
    await vi.waitFor(() => expect(connectAsync).toHaveBeenCalledTimes(1));
    reconnect.retire();
    reconnect.start(attempt);
    await vi.waitFor(() => expect(connectAsync).toHaveBeenCalledTimes(2));

    firstAttempt.resolve();
    await Promise.resolve();
    expect(states.at(-1)).toEqual({ error: null, status: "connecting" });

    secondAttempt.resolve();
    await vi.waitFor(() => expect(states.at(-1)).toEqual({ error: null, status: "idle" }));
  });
});
