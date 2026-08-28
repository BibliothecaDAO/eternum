import { getCurrentFrameWorkOwner, runWithFrameWorkOwner } from "./frame-work-owner";

export type FrameBudgetWorkLane = "critical" | "visible" | "prefetch";

export interface FrameBudgetWorkScheduler {
  schedule<T>(lane: FrameBudgetWorkLane, work: () => T | Promise<T>, owner?: string): Promise<T>;
}

export function scheduleFrameBudgetWork<T>(
  scheduler: FrameBudgetWorkScheduler | undefined,
  lane: FrameBudgetWorkLane,
  work: () => T | Promise<T>,
  owner?: string,
): Promise<T> {
  if (scheduler) {
    return scheduler.schedule(lane, work, owner);
  }

  try {
    return Promise.resolve(owner ? runWithFrameWorkOwner(owner, work) : work());
  } catch (error) {
    return Promise.reject(error);
  }
}

interface FrameBudgetWorkQueueOptions {
  frameBudgetMs?: number;
  loadingFrameBudgetMs?: number;
  isLoading?: () => boolean;
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  onLongTask?: (task: { durationMs: number; owner: string }) => void;
}

interface QueuedWork {
  owner: string;
  reject: (reason: unknown) => void;
  run: () => Promise<void>;
}

const DEFAULT_FRAME_BUDGET_MS = 6;
const LOADING_FRAME_BUDGET_MS = 24;
const CRITICAL_BURST_LIMIT = 8;
const VISIBLE_BURST_LIMIT = 4;
// A single task is never split, so one oversized task defeats the whole
// budget. Production callers name each domain task; the lane label is only a
// fallback for tests and future callers that have not yet supplied one.
const LONG_TASK_REPORT_MS = 33;

export class FrameBudgetWorkQueueDisposedError extends Error {
  constructor() {
    super("Frame-budget work queue was disposed");
    this.name = "FrameBudgetWorkQueueDisposedError";
  }
}

export function isFrameBudgetWorkQueueDisposedError(error: unknown): boolean {
  return error instanceof FrameBudgetWorkQueueDisposedError;
}

/**
 * One browser-frame queue for worldmap work that can be split into small units.
 * Priority is strict within normal bursts; bounded bursts guarantee that a
 * continuously busy critical lane cannot strand visible or prefetch work.
 */
export class FrameBudgetWorkQueue implements FrameBudgetWorkScheduler {
  private readonly queues: Record<FrameBudgetWorkLane, QueuedWork[]> = {
    critical: [],
    visible: [],
    prefetch: [],
  };
  private readonly frameBudgetMs: number;
  private readonly loadingFrameBudgetMs: number;
  private readonly isLoading: () => boolean;
  private readonly now: () => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly onLongTask?: (task: { durationMs: number; owner: string }) => void;
  private frameHandle: number | null = null;
  private isDraining = false;
  private isDisposed = false;
  private consecutiveCriticalTasks = 0;
  private consecutiveVisibleTasks = 0;

  constructor(options: FrameBudgetWorkQueueOptions = {}) {
    this.frameBudgetMs = options.frameBudgetMs ?? DEFAULT_FRAME_BUDGET_MS;
    this.loadingFrameBudgetMs = options.loadingFrameBudgetMs ?? LOADING_FRAME_BUDGET_MS;
    this.isLoading = options.isLoading ?? (() => false);
    this.now = options.now ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => window.requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => window.cancelAnimationFrame(handle));
    this.onLongTask = options.onLongTask;
  }

  schedule<T>(lane: FrameBudgetWorkLane, work: () => T | Promise<T>, requestedOwner?: string): Promise<T> {
    if (this.isDisposed) {
      return Promise.reject(new FrameBudgetWorkQueueDisposedError());
    }

    const owner = requestedOwner ?? getCurrentFrameWorkOwner() ?? `chunk-work:${lane}`;
    const result = new Promise<T>((resolve, reject) => {
      this.queues[lane].push({
        owner,
        reject,
        run: async () => {
          try {
            resolve(await runWithFrameWorkOwner(owner, work, this.now));
          } catch (error) {
            reject(error);
          }
        },
      });
    });
    this.requestDrain();
    return result;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    if (this.frameHandle !== null) {
      this.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }

    const error = new FrameBudgetWorkQueueDisposedError();
    for (const lane of ["critical", "visible", "prefetch"] as const) {
      this.queues[lane].splice(0).forEach((work) => work.reject(error));
    }
  }

  private requestDrain(): void {
    if (this.isDisposed || this.isDraining || this.frameHandle !== null || !this.hasPendingWork()) {
      return;
    }

    this.frameHandle = this.requestFrame(() => {
      this.frameHandle = null;
      void this.drainFrame();
    });
  }

  private async drainFrame(): Promise<void> {
    if (this.isDisposed || this.isDraining) {
      return;
    }

    this.isDraining = true;
    const frameStartedAt = this.now();
    const frameBudgetMs = this.isLoading() ? this.loadingFrameBudgetMs : this.frameBudgetMs;

    try {
      while (!this.isDisposed) {
        const work = this.takeNextWork();
        if (!work) {
          break;
        }

        const taskStartedAt = this.now();
        await work.run();
        const taskMs = this.now() - taskStartedAt;
        if (taskMs >= LONG_TASK_REPORT_MS) {
          this.onLongTask?.({ durationMs: taskMs, owner: work.owner });
        }
        if (this.now() - frameStartedAt >= frameBudgetMs) {
          break;
        }
      }
    } finally {
      this.isDraining = false;
      this.requestDrain();
    }
  }

  private takeNextWork(): QueuedWork | undefined {
    const hasCritical = this.queues.critical.length > 0;
    const hasVisible = this.queues.visible.length > 0;
    const hasPrefetch = this.queues.prefetch.length > 0;

    if (hasCritical && (this.consecutiveCriticalTasks < CRITICAL_BURST_LIMIT || (!hasVisible && !hasPrefetch))) {
      this.consecutiveCriticalTasks += 1;
      return this.queues.critical.shift();
    }

    if (hasVisible && (this.consecutiveVisibleTasks < VISIBLE_BURST_LIMIT || !hasPrefetch)) {
      this.consecutiveCriticalTasks = 0;
      this.consecutiveVisibleTasks += 1;
      return this.queues.visible.shift();
    }

    if (hasPrefetch) {
      this.consecutiveCriticalTasks = 0;
      this.consecutiveVisibleTasks = 0;
      return this.queues.prefetch.shift();
    }

    if (hasCritical) {
      this.consecutiveCriticalTasks = 1;
      return this.queues.critical.shift();
    }

    if (hasVisible) {
      this.consecutiveVisibleTasks = 1;
      return this.queues.visible.shift();
    }

    return undefined;
  }

  private hasPendingWork(): boolean {
    return this.queues.critical.length > 0 || this.queues.visible.length > 0 || this.queues.prefetch.length > 0;
  }
}
