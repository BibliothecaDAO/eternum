import { describe, expect, it, vi } from "vitest";

import {
  createManagerChunkRuntimeState,
  runManagerChunkUpdateRuntime,
  type ManagerChunkUpdateOptions,
} from "./manager-chunk-runtime";

describe("runManagerChunkUpdateRuntime", () => {
  const shouldAcceptRequest = vi.fn(
    ({
      chunkKey,
      knownChunkForToken,
    }: {
      chunkKey: string;
      knownChunkForToken: string | undefined;
      latestTransitionToken: number;
      transitionToken: number | undefined;
    }) => !knownChunkForToken || knownChunkForToken === chunkKey,
  );

  it("tracks accepted transition ownership and updates the current chunk before running the update", async () => {
    const state = createManagerChunkRuntimeState("uncommitted");
    const executeChunkUpdate = vi.fn(async (chunkKey: string, options?: ManagerChunkUpdateOptions) => {
      expect(state.currentChunk).toBe(chunkKey);
      expect(options).toEqual({ force: true, transitionToken: 3 });
    });

    await runManagerChunkUpdateRuntime({
      chunkKey: "24,24",
      executeChunkUpdate,
      isDestroyed: () => false,
      options: { force: false, transitionToken: 3 },
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
      executeChunkUpdate: vi.fn(async () => false),
      isDestroyed: () => false,
      options: { force: true, transitionToken: 4 },
      shouldAcceptRequest,
      state,
      waitForSettle,
    });

    expect(waitForSettle).not.toHaveBeenCalled();
  });
});
