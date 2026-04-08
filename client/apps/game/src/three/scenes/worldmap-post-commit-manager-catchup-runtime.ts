import {
  deferWarpTravelManagerFanout,
  drainMultiBudgetedDeferredManagerCatchUpQueue,
  type BudgetedDeferredManagerCatchUpTask,
} from "./warp-travel-manager-fanout";

export interface WorldmapPostCommitManagerCatchUpRuntimeState<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
> {
  frameHandle: number | null;
  queue: TTask[];
}

interface ScheduleWorldmapPostCommitManagerCatchUpDrainInput<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
> {
  onDrain: () => void;
  requestAnimationFrameFn?: (callback: () => void) => number;
  setTimeoutFn: (callback: () => void, delayMs: number) => number;
  state: WorldmapPostCommitManagerCatchUpRuntimeState<TTask>;
}

interface DrainWorldmapPostCommitManagerCatchUpQueueInput<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
> {
  budgetBytes: number;
  onHeadDeferred?: () => void;
  onImmediateTask: (task: TTask) => void;
  onTaskError: (task: TTask, error: unknown) => void;
  runTask: (task: TTask) => Promise<void>;
  scheduleDrain: () => void;
  shouldRunTask: (task: TTask) => boolean;
  state: WorldmapPostCommitManagerCatchUpRuntimeState<TTask>;
}

interface ClearWorldmapPostCommitManagerCatchUpStateInput<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
> {
  cancelAnimationFrameFn?: (handle: number) => void;
  clearTimeoutFn: (handle: number) => void;
  state: WorldmapPostCommitManagerCatchUpRuntimeState<TTask>;
  usesAnimationFrame: boolean;
}

export function createWorldmapPostCommitManagerCatchUpState<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
>(): WorldmapPostCommitManagerCatchUpRuntimeState<TTask> {
  return {
    frameHandle: null,
    queue: [],
  };
}

export function enqueueWorldmapPostCommitManagerCatchUpTask<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
>(input: { state: WorldmapPostCommitManagerCatchUpRuntimeState<TTask>; task: TTask }): void {
  input.state.queue.push(input.task);
}

export function scheduleWorldmapPostCommitManagerCatchUpDrain<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
>(input: ScheduleWorldmapPostCommitManagerCatchUpDrainInput<TTask>): void {
  if (input.state.frameHandle !== null) {
    return;
  }

  if (input.requestAnimationFrameFn) {
    input.state.frameHandle = input.requestAnimationFrameFn(() => {
      input.state.frameHandle = null;
      input.onDrain();
    });
    return;
  }

  input.state.frameHandle = input.setTimeoutFn(() => {
    input.state.frameHandle = null;
    input.onDrain();
  }, 0);
}

export async function drainWorldmapPostCommitManagerCatchUpQueue<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
>(input: DrainWorldmapPostCommitManagerCatchUpQueueInput<TTask>): Promise<void> {
  const drainResult = drainMultiBudgetedDeferredManagerCatchUpQueue({
    queue: input.state.queue,
    budgetBytes: input.budgetBytes,
  });
  input.state.queue = drainResult.remainingQueue;

  if (drainResult.didDeferHeadTask) {
    input.onHeadDeferred?.();
    input.scheduleDrain();
    return;
  }

  if (drainResult.tasksToRun.length === 0) {
    return;
  }

  for (const task of drainResult.tasksToRun) {
    if ((task.deferredCount ?? 0) === 0) {
      input.onImmediateTask(task);
    }

    try {
      await deferWarpTravelManagerFanout({
        shouldRun: () => input.shouldRunTask(task),
        run: () => input.runTask(task),
        schedule: (callback) => callback(),
      });
    } catch (error) {
      input.onTaskError(task, error);
    }
  }

  if (input.state.queue.length > 0) {
    input.scheduleDrain();
  }
}

export function clearWorldmapPostCommitManagerCatchUpState<
  TTask extends BudgetedDeferredManagerCatchUpTask = BudgetedDeferredManagerCatchUpTask,
>(input: ClearWorldmapPostCommitManagerCatchUpStateInput<TTask>): void {
  if (input.state.frameHandle !== null) {
    if (input.usesAnimationFrame) {
      input.cancelAnimationFrameFn?.(input.state.frameHandle);
    } else {
      input.clearTimeoutFn(input.state.frameHandle);
    }
  }

  input.state.frameHandle = null;
  input.state.queue = [];
}
