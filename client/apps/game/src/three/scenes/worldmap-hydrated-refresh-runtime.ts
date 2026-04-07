import { resolveHydratedChunkRefreshFlushPlan } from "./worldmap-chunk-transition";

export interface WorldmapHydratedRefreshQueueState {
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

export function createWorldmapHydratedRefreshQueueState(): WorldmapHydratedRefreshQueueState {
  return {
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
