import { describe, expect, it } from "vitest";

import {
  drainBudgetedDeferredManagerCatchUpQueue,
  drainMultiBudgetedDeferredManagerCatchUpQueue,
  trimPostCommitManagerCatchUpQueue,
  type BudgetedDeferredManagerCatchUpTask,
} from "./warp-travel-manager-fanout";

describe("drainMultiBudgetedDeferredManagerCatchUpQueue", () => {
  it("drains all N small tasks in a single call when total size is within budget", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = [
      { chunkKey: "0,0", estimatedUploadBytes: 100 },
      { chunkKey: "24,24", estimatedUploadBytes: 100 },
      { chunkKey: "48,48", estimatedUploadBytes: 100 },
    ];

    const result = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue,
      budgetBytes: 1024,
    });

    expect(result.tasksToRun).toHaveLength(3);
    expect(result.tasksToRun.map((t) => t.chunkKey)).toEqual(["0,0", "24,24", "48,48"]);
    expect(result.remainingQueue).toEqual([]);
  });

  it("drains up to the budget and leaves the remainder when tasks exceed the frame budget", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = [
      { chunkKey: "0,0", estimatedUploadBytes: 400 },
      { chunkKey: "24,24", estimatedUploadBytes: 400 },
      { chunkKey: "48,48", estimatedUploadBytes: 400 },
    ];

    const result = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue,
      budgetBytes: 900,
    });

    expect(result.tasksToRun).toHaveLength(2);
    expect(result.tasksToRun.map((t) => t.chunkKey)).toEqual(["0,0", "24,24"]);
    expect(result.remainingQueue).toHaveLength(1);
    expect(result.remainingQueue[0].chunkKey).toBe("48,48");
  });

  it("defers a single oversized head task on first encounter then runs it on the next pass", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = [
      { chunkKey: "0,0", estimatedUploadBytes: 4096 },
      { chunkKey: "24,24", estimatedUploadBytes: 100 },
    ];

    const firstPass = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue,
      budgetBytes: 1024,
    });

    expect(firstPass.tasksToRun).toHaveLength(0);
    expect(firstPass.didDeferHeadTask).toBe(true);
    expect(firstPass.remainingQueue[0].deferredCount).toBe(1);

    // Second pass: previously-deferred task runs regardless of budget
    const secondPass = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue: firstPass.remainingQueue,
      budgetBytes: 1024,
    });

    expect(secondPass.tasksToRun).toHaveLength(1);
    expect(secondPass.tasksToRun[0].chunkKey).toBe("0,0");
    // The small task behind it should also be drained if budget allows
    expect(secondPass.remainingQueue).toHaveLength(1);
    expect(secondPass.remainingQueue[0].chunkKey).toBe("24,24");
  });

  it("maintains FIFO drain ordering", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = [
      { chunkKey: "A", estimatedUploadBytes: 100 },
      { chunkKey: "B", estimatedUploadBytes: 100 },
      { chunkKey: "C", estimatedUploadBytes: 100 },
      { chunkKey: "D", estimatedUploadBytes: 100 },
    ];

    const result = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue,
      budgetBytes: 250,
    });

    expect(result.tasksToRun.map((t) => t.chunkKey)).toEqual(["A", "B"]);
    expect(result.remainingQueue.map((t) => t.chunkKey)).toEqual(["C", "D"]);
  });

  it("returns empty results for an empty queue", () => {
    const result = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue: [],
      budgetBytes: 1024,
    });

    expect(result.tasksToRun).toEqual([]);
    expect(result.remainingQueue).toEqual([]);
    expect(result.didDeferHeadTask).toBe(false);
  });

  it("handles queue where first task fits exactly at the budget boundary", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = [
      { chunkKey: "0,0", estimatedUploadBytes: 1024 },
      { chunkKey: "24,24", estimatedUploadBytes: 100 },
    ];

    const result = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue,
      budgetBytes: 1024,
    });

    // First task fits exactly, second would exceed
    expect(result.tasksToRun).toHaveLength(1);
    expect(result.tasksToRun[0].chunkKey).toBe("0,0");
    expect(result.remainingQueue).toHaveLength(1);
  });
});

describe("trimPostCommitManagerCatchUpQueue", () => {
  it("trims oldest entries when queue exceeds maxQueueLength", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = Array.from({ length: 40 }, (_, i) => ({
      chunkKey: `chunk-${i}`,
      estimatedUploadBytes: 100,
    }));

    const trimmed = trimPostCommitManagerCatchUpQueue({ queue, maxQueueLength: 32 });

    expect(trimmed).toHaveLength(32);
    // Oldest entries (0-7) are trimmed, newest (8-39) remain
    expect(trimmed[0].chunkKey).toBe("chunk-8");
    expect(trimmed[trimmed.length - 1].chunkKey).toBe("chunk-39");
  });

  it("leaves the queue unchanged when within the cap", () => {
    const queue: BudgetedDeferredManagerCatchUpTask[] = [
      { chunkKey: "0,0", estimatedUploadBytes: 100 },
      { chunkKey: "24,24", estimatedUploadBytes: 100 },
    ];

    const trimmed = trimPostCommitManagerCatchUpQueue({ queue, maxQueueLength: 32 });

    expect(trimmed).toHaveLength(2);
    expect(trimmed).toEqual(queue);
  });
});

describe("backward compatibility with single-task drainBudgetedDeferredManagerCatchUpQueue", () => {
  it("single-task drain still works identically for existing callers", () => {
    const result = drainBudgetedDeferredManagerCatchUpQueue({
      queue: [
        { chunkKey: "24,24", estimatedUploadBytes: 512 },
        { chunkKey: "48,24", estimatedUploadBytes: 512 },
      ],
      budgetBytes: 1024,
    });

    expect(result.taskToRun).toEqual({ chunkKey: "24,24", estimatedUploadBytes: 512 });
    expect(result.remainingQueue).toEqual([{ chunkKey: "48,24", estimatedUploadBytes: 512 }]);
  });
});
