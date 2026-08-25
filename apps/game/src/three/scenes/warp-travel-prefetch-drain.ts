import {
  resolvePrefetchQueueProcessingPlan,
  shouldProcessPrefetchQueueItem,
  type PrefetchQueueItem,
} from "./worldmap-prefetch-queue";

interface DrainWarpTravelPrefetchQueueInput {
  isSwitchedOff: boolean;
  queue: PrefetchQueueItem[];
  queuedAreaKeys: Set<string>;
  activePrefetches: number;
  maxConcurrentPrefetches: number;
  desiredAreaKeys: Set<string>;
  pinnedAreaKeys: Set<string>;
}

export function drainWarpTravelPrefetchQueue(input: DrainWarpTravelPrefetchQueueInput): {
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

    if (item.syncTiles) {
      input.queuedAreaKeys.delete(item.areaKey);
    }

    if (
      !shouldProcessPrefetchQueueItem({
        item,
        isSwitchedOff: input.isSwitchedOff,
        desiredAreaKeys: input.desiredAreaKeys,
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
