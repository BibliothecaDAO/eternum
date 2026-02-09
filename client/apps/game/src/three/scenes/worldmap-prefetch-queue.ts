export interface PrefetchQueueItem {
  chunkKey: string;
  fetchKey: string;
  priority: number;
  fetchTiles: boolean;
}

export interface ShouldProcessPrefetchQueueItemInput {
  item: PrefetchQueueItem;
  isSwitchedOff: boolean;
  desiredFetchKeys: Set<string>;
  fetchedFetchKeys: Set<string>;
  pendingFetchKeys: Set<string>;
  pinnedAreaKeys: Set<string>;
}

/**
 * Inserts prefetch work while keeping stable ascending priority ordering.
 * Equal-priority items keep FIFO ordering.
 */
export function insertPrefetchQueueItem(queue: PrefetchQueueItem[], item: PrefetchQueueItem): void {
  let left = 0;
  let right = queue.length;

  // Upper-bound insertion so equal priorities stay in arrival order.
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (queue[mid].priority <= item.priority) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  queue.splice(left, 0, item);
}

/**
 * Remove queued prefetch work that is no longer relevant.
 */
export function prunePrefetchQueueByFetchKey(queue: PrefetchQueueItem[], allowedFetchKeys: Set<string>): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (!allowedFetchKeys.has(queue[i].fetchKey)) {
      queue.splice(i, 1);
    }
  }
}

/**
 * Guard whether a queued prefetch item should still execute.
 */
export function shouldProcessPrefetchQueueItem(input: ShouldProcessPrefetchQueueItemInput): boolean {
  const { item, isSwitchedOff, desiredFetchKeys, fetchedFetchKeys, pendingFetchKeys, pinnedAreaKeys } = input;

  if (isSwitchedOff) {
    return false;
  }

  if (!desiredFetchKeys.has(item.fetchKey)) {
    return false;
  }

  if (fetchedFetchKeys.has(item.fetchKey)) {
    return false;
  }

  if (pendingFetchKeys.has(item.fetchKey)) {
    return false;
  }

  if (pinnedAreaKeys.has(item.fetchKey)) {
    return false;
  }

  return true;
}
