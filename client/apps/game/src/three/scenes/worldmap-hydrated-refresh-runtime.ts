import { resolveHydratedChunkRefreshFlushPlan } from "./worldmap-chunk-transition";

export interface WorldmapHydratedRefreshQueueState {
  activeFlushPromise: Promise<void> | null;
  isScheduled: boolean;
  queuedChunkKeys: Set<string>;
}

interface QueueWorldmapHydratedChunkRefreshInput {
  chunkKey: string;
  scheduleFlush: () => void;
  state: WorldmapHydratedRefreshQueueState;
}

interface FlushWorldmapHydratedChunkRefreshQueueInput {
  awaitActiveChunkSwitch?: () => Promise<void>;
  currentChunk: string;
  isChunkTransitioning: boolean;
  onAfterRefresh: () => void;
  queueFlush: () => void;
  refreshCurrentChunk: () => Promise<void>;
  reportRefreshError?: (currentChunk: string, error: unknown) => void;
  state: WorldmapHydratedRefreshQueueState;
  warn?: (message: string, error: unknown) => void;
}

interface WaitForWorldmapHydratedRefreshQueueIdleInput {
  isSwitchedOff: () => boolean;
  setTimeoutFn: (callback: () => void, delayMs: number) => number;
  state: WorldmapHydratedRefreshQueueState;
}

export function createWorldmapHydratedRefreshQueueState(): WorldmapHydratedRefreshQueueState {
  return {
    activeFlushPromise: null,
    isScheduled: false,
    queuedChunkKeys: new Set<string>(),
  };
}

export function queueWorldmapHydratedChunkRefresh(
  input: QueueWorldmapHydratedChunkRefreshInput,
): WorldmapHydratedRefreshQueueState {
  input.state.queuedChunkKeys.add(input.chunkKey);
  if (input.state.isScheduled) {
    return input.state;
  }

  input.state.isScheduled = true;
  input.scheduleFlush();
  return input.state;
}

export async function flushWorldmapHydratedChunkRefreshQueue(
  input: FlushWorldmapHydratedChunkRefreshQueueInput,
): Promise<WorldmapHydratedRefreshQueueState> {
  input.state.isScheduled = false;

  if (input.awaitActiveChunkSwitch) {
    try {
      await input.awaitActiveChunkSwitch();
    } catch (error) {
      input.warn?.("Previous global chunk switch failed before hydrated refresh:", error);
    }
  }

  const refreshPlan = resolveHydratedChunkRefreshFlushPlan({
    queuedChunkKeys: Array.from(input.state.queuedChunkKeys),
    currentChunk: input.currentChunk,
    isChunkTransitioning: input.isChunkTransitioning,
  });
  input.state.queuedChunkKeys = new Set(refreshPlan.remainingQueuedChunkKeys);

  if (refreshPlan.shouldDefer) {
    input.state.isScheduled = true;
    input.queueFlush();
    return input.state;
  }

  if (!refreshPlan.shouldForceRefreshCurrentChunk) {
    return input.state;
  }

  try {
    await input.refreshCurrentChunk();
    input.onAfterRefresh();
  } catch (error) {
    input.reportRefreshError?.(input.currentChunk, error);
  }

  return input.state;
}

export function trackWorldmapHydratedRefreshQueueFlush(
  state: WorldmapHydratedRefreshQueueState,
  flush: () => Promise<void>,
): Promise<void> {
  if (state.activeFlushPromise) {
    return state.activeFlushPromise;
  }

  const flushPromise = Promise.resolve()
    .then(flush)
    .finally(() => {
      if (state.activeFlushPromise === flushPromise) {
        state.activeFlushPromise = null;
      }
    });
  state.activeFlushPromise = flushPromise;
  return flushPromise;
}

export async function waitForWorldmapHydratedRefreshQueueIdle(
  input: WaitForWorldmapHydratedRefreshQueueIdleInput,
): Promise<void> {
  while (!input.isSwitchedOff()) {
    if (input.state.activeFlushPromise) {
      await input.state.activeFlushPromise.catch(() => undefined);
      continue;
    }

    if (!input.state.isScheduled && input.state.queuedChunkKeys.size === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      input.setTimeoutFn(resolve, 0);
    });
  }
}
