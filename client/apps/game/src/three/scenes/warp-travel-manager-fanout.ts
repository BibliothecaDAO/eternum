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
