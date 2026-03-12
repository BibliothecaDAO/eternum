import {
  resolvePrefetchQueueProcessingPlan,
  shouldProcessPrefetchQueueItem,
  type PrefetchFetchKeyLookup,
  type PrefetchQueueItem,
} from "./worldmap-prefetch-queue";

interface DrainWarpTravelPrefetchQueueInput {
  isSwitchedOff: boolean;
  queue: PrefetchQueueItem[];
  queuedFetchKeys: Set<string>;
  activePrefetches: number;
  maxConcurrentPrefetches: number;
  desiredFetchKeys: Set<string>;
  fetchedFetchKeys: Set<string>;
  pendingFetchKeys: PrefetchFetchKeyLookup;
  pinnedAreaKeys: Set<string>;
}

export function drainWarpTravelPrefetchQueue(
  input: DrainWarpTravelPrefetchQueueInput,
): {
  shouldClearQueuedState: boolean;
  startedItems: PrefetchQueueItem[];
  skippedItems: PrefetchQueueItem[];
} {
  const initialPlan = resolvePrefetchQueueProcessingPlan({
    isSwitchedOff: input.isSwitchedOff,
    queueLength: input.queue.length,
    activePrefetches: input.activePrefetches,
    maxConcurrentPrefetches: input.maxConcurrentPrefetches,
  });

  if (initialPlan.shouldClearQueuedPrefetchState) {
    return {
      shouldClearQueuedState: true,
      startedItems: [],
      skippedItems: [],
    };
  }

  const startedItems: PrefetchQueueItem[] = [];
  const skippedItems: PrefetchQueueItem[] = [];
  let activePrefetches = input.activePrefetches;

  while (
    resolvePrefetchQueueProcessingPlan({
      isSwitchedOff: input.isSwitchedOff,
      queueLength: input.queue.length,
      activePrefetches,
      maxConcurrentPrefetches: input.maxConcurrentPrefetches,
    }).shouldProcessNextQueueItem
  ) {
    const item = input.queue.shift();
    if (!item) {
      break;
    }

    if (item.fetchTiles) {
      input.queuedFetchKeys.delete(item.fetchKey);
    }

    if (
      !shouldProcessPrefetchQueueItem({
        item,
        isSwitchedOff: input.isSwitchedOff,
        desiredFetchKeys: input.desiredFetchKeys,
        fetchedFetchKeys: input.fetchedFetchKeys,
        pendingFetchKeys: input.pendingFetchKeys,
        pinnedAreaKeys: input.pinnedAreaKeys,
      })
    ) {
      skippedItems.push(item);
      continue;
    }

    startedItems.push(item);
    activePrefetches += 1;
  }

  return {
    shouldClearQueuedState: false,
    startedItems,
    skippedItems,
  };
}
