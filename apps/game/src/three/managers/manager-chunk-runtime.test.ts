import { describe, expect, it, vi } from "vitest";

import {
  createManagerChunkRuntimeState,
  recoverManagerChunkRuntimeAfterStall,
  runManagerChunkUpdateRuntime,
  type ManagerChunkUpdateOptions,
} from "./manager-chunk-runtime";

describe("runManagerChunkUpdateRuntime", () => {
  const shouldAcceptRequest: Parameters<typeof runManagerChunkUpdateRuntime>[0]["shouldAcceptRequest"] = vi.fn(
    ({ chunkKey, knownChunkForToken }) => !knownChunkForToken || knownChunkForToken === chunkKey,
  );

  it("tracks a forced stride crossing without refreshing staying manager entities", async () => {
    const state = createManagerChunkRuntimeState("uncommitted");
    const executeChunkUpdate = vi.fn(async (chunkKey: string, options?: ManagerChunkUpdateOptions) => {
      expect(state.currentChunk).toBe(chunkKey);
      expect(options).toEqual({ force: true, refreshExisting: false, transitionToken: 3 });
    });

    await runManagerChunkUpdateRuntime({
      chunkKey: "24,24",
      executeChunkUpdate,
      isDestroyed: () => false,
      options: { force: true, transitionToken: 3 },
      shouldAcceptRequest,
      state,
      waitForSettle: vi.fn(async () => undefined),
    });

    expect(state.currentChunk).toBe("24,24");
    expect(state.latestTransitionToken).toBe(3);
    expect(state.transitionChunkByToken.get(3)).toBe("24,24");
    expect(executeChunkUpdate).toHaveBeenCalledTimes(1);
  });

  it("waits for the previous in-flight update and reports failures before continuing", async () => {
    const state = createManagerChunkRuntimeState("0,0");
    state.inFlightPromise = Promise.reject(new Error("previous failed"));
    const onPreviousUpdateFailed = vi.fn();
    const executeChunkUpdate = vi.fn(async () => undefined);

    await runManagerChunkUpdateRuntime({
      chunkKey: "24,24",
      executeChunkUpdate,
      isDestroyed: () => false,
      onPreviousUpdateFailed,
      options: { force: true },
      shouldAcceptRequest,
      state,
    });

    expect(onPreviousUpdateFailed).toHaveBeenCalledWith(expect.any(Error));
    expect(executeChunkUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips execution when the chunk is unchanged and the request is not forced", async () => {
    const state = createManagerChunkRuntimeState("24,24");
    const prepareForUpdate = vi.fn(async () => undefined);
    const executeChunkUpdate = vi.fn(async () => undefined);

    await runManagerChunkUpdateRuntime({
      chunkKey: "24,24",
      executeChunkUpdate,
      isDestroyed: () => false,
      options: { force: false, transitionToken: 5 },
      prepareForUpdate,
      shouldAcceptRequest,
      state,
    });

    expect(prepareForUpdate).toHaveBeenCalledTimes(1);
    expect(executeChunkUpdate).not.toHaveBeenCalled();
  });

  it("skips settle work when the update executor reports that no chunk update ran", async () => {
    const state = createManagerChunkRuntimeState("0,0");
    const waitForSettle = vi.fn(async () => undefined);

    await runManagerChunkUpdateRuntime({
      chunkKey: "24,24",
      executeChunkUpdate: vi.fn(async (): Promise<false> => false),
      isDestroyed: () => false,
      options: { force: true, transitionToken: 4 },
      shouldAcceptRequest,
      state,
      waitForSettle,
    });

    expect(waitForSettle).not.toHaveBeenCalled();
  });

  it("releases stale chunk ownership after a stalled manager update", async () => {
    const state = createManagerChunkRuntimeState("24,24");
    state.latestTransitionToken = 7;
    state.transitionChunkByToken.set(6, "0,0");
    state.transitionChunkByToken.set(7, "24,24");
    state.inFlightPromise = new Promise<void>(() => undefined);

    recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "24,24",
      transitionToken: 8,
    });

    expect(state.currentChunk).toBe("24,24");
    expect(state.inFlightPromise).toBeNull();
    expect(state.latestTransitionToken).toBe(8);
    expect(state.transitionChunkByToken.get(8)).toBe("24,24");
    expect(state.transitionChunkByToken.has(6)).toBe(false);
    expect(state.transitionChunkByToken.has(7)).toBe(false);
  });

  it("allows a forced same-chunk update after stalled ownership is released", async () => {
    const state = createManagerChunkRuntimeState("24,24");
    state.inFlightPromise = new Promise<void>(() => undefined);
    recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "24,24",
      transitionToken: 9,
    });

    const executeChunkUpdate = vi.fn(async (_chunkKey: string, options?: ManagerChunkUpdateOptions) => {
      expect(options?.refreshExisting).toBe(true);
    });

    await runManagerChunkUpdateRuntime({
      chunkKey: "24,24",
      executeChunkUpdate,
      isDestroyed: () => false,
      options: { force: true, transitionToken: 9 },
      shouldAcceptRequest,
      state,
    });

    expect(executeChunkUpdate).toHaveBeenCalledTimes(1);
  });

  it("clears stalled ownership without adopting an invalid recovery chunk", () => {
    const state = createManagerChunkRuntimeState("24,24");
    state.inFlightPromise = new Promise<void>(() => undefined);

    recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "null",
      transitionToken: 10,
    });

    expect(state.currentChunk).toBe("24,24");
    expect(state.inFlightPromise).toBeNull();
    expect(state.latestTransitionToken).toBe(10);
    expect(state.transitionChunkByToken.has(10)).toBe(false);
  });

  it("does not overwrite currentChunk when a newer transition has already advanced past the recovery token", () => {
    const state = createManagerChunkRuntimeState("0,0");
    state.latestTransitionToken = 9;
    state.currentChunk = "24,24";
    state.inFlightPromise = new Promise<void>(() => undefined);

    recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "0,0",
      transitionToken: 7,
    });

    expect(state.currentChunk).toBe("24,24");
    expect(state.latestTransitionToken).toBe(9);
  });

  it("preserves the in-flight promise of a newer transition when recovering a stale token", () => {
    const state = createManagerChunkRuntimeState("24,24");
    state.latestTransitionToken = 9;
    const newerPromise = new Promise<void>(() => undefined);
    state.inFlightPromise = newerPromise;

    recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "0,0",
      transitionToken: 7,
    });

    expect(state.inFlightPromise).toBe(newerPromise);
  });

  it("returns didApply=true when the recovery is non-stale", () => {
    const state = createManagerChunkRuntimeState("0,0");
    const result = recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "24,24",
      transitionToken: 5,
    });

    expect(result.didApply).toBe(true);
  });

  it("returns didApply=false when the recovery is stale", () => {
    const state = createManagerChunkRuntimeState("24,24");
    state.latestTransitionToken = 9;

    const result = recoverManagerChunkRuntimeAfterStall(state, {
      chunkKey: "0,0",
      transitionToken: 7,
    });

    expect(result.didApply).toBe(false);
  });
});
