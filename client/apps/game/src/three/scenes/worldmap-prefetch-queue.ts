export interface PrefetchQueueItem {
  chunkKey: string;
  fetchKey: string;
  priority: number;
  fetchTiles: boolean;
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
