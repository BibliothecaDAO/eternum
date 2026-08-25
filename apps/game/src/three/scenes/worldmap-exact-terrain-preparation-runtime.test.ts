import { afterEach, describe, expect, it, vi } from "vitest";

import { WorldmapExactTerrainPreparationRuntime } from "./worldmap-exact-terrain-preparation-runtime";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

interface ExactPreparationResult {
  preparedTerrain: { chunkKey: string } | null;
  projectionSyncSucceeded: boolean;
}

const isExactReady = (result: ExactPreparationResult) =>
  result.projectionSyncSucceeded && result.preparedTerrain !== null;

describe("WorldmapExactTerrainPreparationRuntime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shares one exact preparation between same-key callers", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const prepare = vi.fn(async () => ({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    }));

    const first = runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare });
    const second = runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare });

    expect(second).toBe(first);
    expect(second.promise).toBe(first.promise);
    expect(prepare).toHaveBeenCalledTimes(1);
    await expect(first.promise).resolves.toEqual({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
  });

  it("lets a shell observe exact success without receiving the owned terrain", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const preparation = createControlledAsyncCall<[], ExactPreparationResult>();
    runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare: preparation.fn });

    const join = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 4,
      timeoutMs: 16,
      isExactReady,
    });
    preparation.resolveNext({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });

    await expect(join).resolves.toEqual({ status: "exact_ready" });
  });

  it("falls back when exact preparation fails and releases the failed owner", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const preparation = createControlledAsyncCall<[], ExactPreparationResult>();
    const owner = runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare: preparation.fn });
    const join = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 4,
      timeoutMs: 16,
      isExactReady,
    });

    preparation.rejectNext(new Error("projection unavailable"));

    await expect(join).resolves.toEqual({ status: "fallback_required", reason: "failed" });
    await expect(owner.promise).rejects.toThrow("projection unavailable");
    runtime.release(owner);
    await expect(
      runtime.waitForExact({ chunkKey: "24,24", transitionToken: 4, timeoutMs: 16, isExactReady }),
    ).resolves.toEqual({ status: "fallback_required", reason: "missing" });
  });

  it("wakes a waiting shell when exact ownership is cancelled", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const preparation = createControlledAsyncCall<[], ExactPreparationResult>();
    const owner = runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare: preparation.fn });
    const join = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 4,
      timeoutMs: 16,
      isExactReady,
    });

    runtime.release(owner);

    await expect(join).resolves.toEqual({ status: "fallback_required", reason: "cancelled" });
    await expect(
      runtime.waitForExact({ chunkKey: "24,24", transitionToken: 4, timeoutMs: 16, isExactReady }),
    ).resolves.toEqual({ status: "fallback_required", reason: "missing" });
  });

  it("falls back after one frame while the exact owner continues", async () => {
    vi.useFakeTimers();
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const preparation = createControlledAsyncCall<[], ExactPreparationResult>();
    const owner = runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare: preparation.fn });
    const join = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 4,
      timeoutMs: 16,
      isExactReady,
    });

    await vi.advanceTimersByTimeAsync(16);

    await expect(join).resolves.toEqual({ status: "fallback_required", reason: "timed_out" });
    preparation.resolveNext({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
    await expect(owner.promise).resolves.toEqual({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
  });

  it("cancels superseded ownership without letting the old owner release its replacement", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const firstPreparation = createControlledAsyncCall<[], ExactPreparationResult>();
    const secondPreparation = createControlledAsyncCall<[], ExactPreparationResult>();
    const firstOwner = runtime.start({
      chunkKey: "24,24",
      transitionToken: 4,
      prepare: firstPreparation.fn,
    });
    const staleJoin = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 4,
      timeoutMs: 16,
      isExactReady,
    });

    runtime.start({ chunkKey: "24,24", transitionToken: 5, prepare: secondPreparation.fn });
    runtime.release(firstOwner);
    const winningJoin = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 5,
      timeoutMs: 16,
      isExactReady,
    });
    secondPreparation.resolveNext({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
    await flushMicrotasks();

    await expect(staleJoin).resolves.toEqual({ status: "fallback_required", reason: "cancelled" });
    await expect(winningJoin).resolves.toEqual({ status: "exact_ready" });
  });

  it("falls back when exact preparation resolves without usable terrain", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    runtime.start({
      chunkKey: "24,24",
      transitionToken: 4,
      prepare: async () => ({ projectionSyncSucceeded: false, preparedTerrain: null }),
    });

    await expect(
      runtime.waitForExact({ chunkKey: "24,24", transitionToken: 4, timeoutMs: 16, isExactReady }),
    ).resolves.toEqual({ status: "fallback_required", reason: "unavailable" });
  });

  it("clears all exact ownership on switch-off", async () => {
    const runtime = new WorldmapExactTerrainPreparationRuntime<ExactPreparationResult>();
    const preparation = createControlledAsyncCall<[], ExactPreparationResult>();
    runtime.start({ chunkKey: "24,24", transitionToken: 4, prepare: preparation.fn });
    const pendingJoin = runtime.waitForExact({
      chunkKey: "24,24",
      transitionToken: 4,
      timeoutMs: 16,
      isExactReady,
    });

    runtime.clear();

    await expect(pendingJoin).resolves.toEqual({ status: "fallback_required", reason: "cancelled" });
    await expect(
      runtime.waitForExact({ chunkKey: "24,24", transitionToken: 4, timeoutMs: 16, isExactReady }),
    ).resolves.toEqual({ status: "fallback_required", reason: "missing" });
  });
});
