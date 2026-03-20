import { describe, expect, it, vi } from "vitest";

import {
  deferWarpTravelManagerFanout,
  drainBudgetedDeferredManagerCatchUpQueue,
  runWarpTravelManagerFanout,
} from "./warp-travel-manager-fanout";

describe("runWarpTravelManagerFanout", () => {
  it("runs all manager updates concurrently and reports no failures when all succeed", async () => {
    const calls: string[] = [];

    const result = await runWarpTravelManagerFanout({
      chunkKey: "24,24",
      options: { force: true, transitionToken: 7 },
      managers: [
        { label: "army", updateChunk: async () => void calls.push("army") },
        { label: "structure", updateChunk: async () => void calls.push("structure") },
        { label: "chest", updateChunk: async () => void calls.push("chest") },
      ],
    });

    expect(calls).toEqual(["army", "structure", "chest"]);
    expect(result).toEqual({
      failedManagers: [],
    });
  });

  it("collects failed labels and reports the corresponding error reasons", async () => {
    const failure = new Error("manager failed");
    const onManagerFailed = vi.fn();

    const result = await runWarpTravelManagerFanout({
      chunkKey: "24,24",
      options: { force: false, transitionToken: 8 },
      managers: [
        { label: "army", updateChunk: async () => undefined },
        {
          label: "structure",
          updateChunk: async () => {
            throw failure;
          },
        },
        { label: "chest", updateChunk: async () => undefined },
      ],
      onManagerFailed,
    });

    expect(result).toEqual({
      failedManagers: [{ label: "structure", reason: failure }],
    });
    expect(onManagerFailed).toHaveBeenCalledTimes(1);
    expect(onManagerFailed).toHaveBeenCalledWith("structure", failure);
  });
});

describe("deferWarpTravelManagerFanout", () => {
  it("drops deferred manager work when ownership is stale by the time the scheduler runs", async () => {
    let shouldRun = true;
    const run = vi.fn(async () => undefined);

    const resultPromise = deferWarpTravelManagerFanout({
      shouldRun: () => shouldRun,
      run,
      schedule: (callback) => {
        shouldRun = false;
        callback();
      },
    });

    await expect(resultPromise).resolves.toEqual({ status: "skipped" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("drainBudgetedDeferredManagerCatchUpQueue", () => {
  it("defers an oversized head task for one frame before allowing it to run", () => {
    const firstPass = drainBudgetedDeferredManagerCatchUpQueue({
      queue: [{ chunkKey: "24,24", estimatedUploadBytes: 4096 }],
      budgetBytes: 1024,
    });

    expect(firstPass).toEqual({
      taskToRun: null,
      remainingQueue: [{ chunkKey: "24,24", estimatedUploadBytes: 4096, deferredCount: 1 }],
      didDeferHeadTask: true,
    });

    const secondPass = drainBudgetedDeferredManagerCatchUpQueue({
      queue: firstPass.remainingQueue,
      budgetBytes: 1024,
    });

    expect(secondPass).toEqual({
      taskToRun: { chunkKey: "24,24", estimatedUploadBytes: 4096, deferredCount: 1 },
      remainingQueue: [],
      didDeferHeadTask: false,
    });
  });

  it("keeps manager catch-up ordering deterministic under budgeting", () => {
    const result = drainBudgetedDeferredManagerCatchUpQueue({
      queue: [
        { chunkKey: "24,24", estimatedUploadBytes: 512 },
        { chunkKey: "48,24", estimatedUploadBytes: 512 },
      ],
      budgetBytes: 1024,
    });

    expect(result.taskToRun).toEqual({
      chunkKey: "24,24",
      estimatedUploadBytes: 512,
    });
    expect(result.remainingQueue).toEqual([
      {
        chunkKey: "48,24",
        estimatedUploadBytes: 512,
      },
    ]);
  });
});
