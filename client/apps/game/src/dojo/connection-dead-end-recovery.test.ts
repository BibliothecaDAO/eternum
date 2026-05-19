import { describe, expect, it, vi } from "vitest";

import { runDeadEndRecovery } from "./connection-dead-end-recovery";

describe("runDeadEndRecovery", () => {
  it("warns and skips when no entry context can be resolved", async () => {
    const resetBootstrap = vi.fn();
    const bootstrapForContext = vi.fn(async () => undefined);
    const recordStreamReconnect = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    await runDeadEndRecovery({
      resolveContext: () => null,
      resetBootstrap,
      bootstrapForContext,
      recordStreamReconnect,
      onSuccess,
      onFailure,
    });

    expect(resetBootstrap).not.toHaveBeenCalled();
    expect(bootstrapForContext).not.toHaveBeenCalled();
    expect(recordStreamReconnect).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("runs resetBootstrap + bootstrap, records reconnect, and fires onSuccess", async () => {
    const calls: string[] = [];
    const context = { entry: "play" };
    const bootstrapResult = { setupResult: { network: { toriiClient: "fresh-client" } } };
    const resetBootstrap = vi.fn(() => calls.push("reset"));
    const bootstrapForContext = vi.fn(async () => {
      calls.push("bootstrap");
      return bootstrapResult;
    });
    const recordStreamReconnect = vi.fn(() => calls.push("recordReconnect"));
    const onSuccess = vi.fn(() => calls.push("onSuccess"));
    const onFailure = vi.fn();

    await runDeadEndRecovery({
      resolveContext: () => context,
      resetBootstrap,
      bootstrapForContext,
      recordStreamReconnect,
      onSuccess,
      onFailure,
    });

    expect(bootstrapForContext).toHaveBeenCalledWith(context);
    expect(onSuccess).toHaveBeenCalledWith(bootstrapResult);
    expect(calls).toEqual(["reset", "bootstrap", "onSuccess", "recordReconnect"]);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("records a stream reconnect even when bootstrap fails so subscribers still re-mount", async () => {
    const error = new Error("boom");
    const resetBootstrap = vi.fn();
    const bootstrapForContext = vi.fn(async () => {
      throw error;
    });
    const recordStreamReconnect = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    await runDeadEndRecovery({
      resolveContext: () => ({ entry: "play" }),
      resetBootstrap,
      bootstrapForContext,
      recordStreamReconnect,
      onSuccess,
      onFailure,
    });

    expect(recordStreamReconnect).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it("does not record a stream reconnect when there is no context to recover into", async () => {
    const recordStreamReconnect = vi.fn();
    await runDeadEndRecovery({
      resolveContext: () => null,
      resetBootstrap: vi.fn(),
      bootstrapForContext: vi.fn(async () => undefined),
      recordStreamReconnect,
    });
    expect(recordStreamReconnect).not.toHaveBeenCalled();
  });
});
