export interface WarpTravelManagerFanoutOptions {
  force?: boolean;
  transitionToken?: number;
}

export interface WarpTravelChunkManager {
  label: string;
  updateChunk: (chunkKey: string, options?: WarpTravelManagerFanoutOptions) => Promise<void>;
}

export interface WarpTravelManagerFanoutFailure {
  label: string;
  reason: unknown;
}

export interface BudgetedDeferredManagerCatchUpTask {
  chunkKey: string;
  estimatedUploadBytes: number;
  deferredCount?: number;
}

export function deferWarpTravelManagerFanout(input: {
  shouldRun?: () => boolean;
  run: () => Promise<void>;
  schedule?: (callback: () => void) => void;
}): Promise<{ status: "scheduled" | "skipped" }> {
  return new Promise((resolve, reject) => {
    const schedule = input.schedule ?? ((callback: () => void) => void setTimeout(callback, 0));
    schedule(() => {
      if (input.shouldRun && !input.shouldRun()) {
        resolve({ status: "skipped" });
        return;
      }

      void input.run().then(
        () => resolve({ status: "scheduled" }),
        (error) => reject(error),
      );
    });
  });
}

export function drainBudgetedDeferredManagerCatchUpQueue<T extends BudgetedDeferredManagerCatchUpTask>(input: {
  queue: T[];
  budgetBytes: number;
}): {
  taskToRun: T | null;
  remainingQueue: T[];
  didDeferHeadTask: boolean;
} {
  const [headTask, ...remainingQueue] = input.queue;
  if (!headTask) {
    return {
      taskToRun: null,
      remainingQueue: [],
      didDeferHeadTask: false,
    };
  }

  if (headTask.estimatedUploadBytes > input.budgetBytes && (headTask.deferredCount ?? 0) === 0) {
    return {
      taskToRun: null,
      remainingQueue: [{ ...headTask, deferredCount: 1 }, ...remainingQueue],
      didDeferHeadTask: true,
    };
  }

  return {
    taskToRun: headTask,
    remainingQueue,
    didDeferHeadTask: false,
  };
}

export function drainMultiBudgetedDeferredManagerCatchUpQueue<T extends BudgetedDeferredManagerCatchUpTask>(input: {
  queue: T[];
  budgetBytes: number;
}): {
  tasksToRun: T[];
  remainingQueue: T[];
  didDeferHeadTask: boolean;
} {
  if (input.queue.length === 0) {
    return { tasksToRun: [], remainingQueue: [], didDeferHeadTask: false };
  }

  // Check if the head task needs deferral (oversized, first encounter)
  const headTask = input.queue[0];
  if (headTask.estimatedUploadBytes > input.budgetBytes && (headTask.deferredCount ?? 0) === 0) {
    return {
      tasksToRun: [],
      remainingQueue: [{ ...headTask, deferredCount: 1 }, ...input.queue.slice(1)],
      didDeferHeadTask: true,
    };
  }

  const tasksToRun: T[] = [];
  let budgetRemaining = input.budgetBytes;
  let idx = 0;

  while (idx < input.queue.length) {
    const task = input.queue[idx];

    // Previously-deferred oversized tasks always run (they already waited one frame)
    const isDeferred = (task.deferredCount ?? 0) > 0;

    if (!isDeferred && task.estimatedUploadBytes > budgetRemaining) {
      // No more budget for non-deferred tasks
      break;
    }

    tasksToRun.push(task);
    budgetRemaining -= task.estimatedUploadBytes;
    idx++;

    // After running a deferred oversized task, stop to avoid frame hitching
    if (isDeferred) {
      break;
    }
  }

  return {
    tasksToRun,
    remainingQueue: input.queue.slice(idx),
    didDeferHeadTask: false,
  };
}

export function trimPostCommitManagerCatchUpQueue<T extends BudgetedDeferredManagerCatchUpTask>(input: {
  queue: T[];
  maxQueueLength: number;
}): T[] {
  if (input.queue.length <= input.maxQueueLength) {
    return input.queue;
  }
  // Trim oldest entries from the front
  return input.queue.slice(input.queue.length - input.maxQueueLength);
}

export async function runWarpTravelManagerFanout(input: {
  chunkKey: string;
  options?: WarpTravelManagerFanoutOptions;
  managers: WarpTravelChunkManager[];
  onManagerFailed?: (label: string, reason: unknown) => void;
}): Promise<{ failedManagers: WarpTravelManagerFanoutFailure[] }> {
  const results = await Promise.allSettled(
    input.managers.map((manager) => manager.updateChunk(input.chunkKey, input.options)),
  );

  const failedManagers: WarpTravelManagerFanoutFailure[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const label = input.managers[index].label;
      failedManagers.push({
        label,
        reason: result.reason,
      });
      input.onManagerFailed?.(label, result.reason);
    }
  });

  return {
    failedManagers,
  };
}
