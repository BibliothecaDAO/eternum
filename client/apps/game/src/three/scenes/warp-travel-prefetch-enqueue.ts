import { insertPrefetchQueueItem, type PrefetchQueueItem } from "./worldmap-prefetch-queue";

interface EnqueueWarpTravelPrefetchInput {
  chunkKey: string;
  areaKey: string;
  priority: number;
  queue: PrefetchQueueItem[];
  queuedAreaKeys: Set<string>;
}

export function enqueueWarpTravelPrefetch(input: EnqueueWarpTravelPrefetchInput): {
  enqueued: boolean;
  skipped: boolean;
} {
  if (!input.chunkKey) {
    return { enqueued: false, skipped: true };
  }

  if (input.queuedAreaKeys.has(input.areaKey)) {
    return { enqueued: false, skipped: true };
  }

  input.queuedAreaKeys.add(input.areaKey);
  insertPrefetchQueueItem(input.queue, {
    chunkKey: input.chunkKey,
    areaKey: input.areaKey,
    priority: input.priority,
    syncTiles: true,
  });

  return { enqueued: true, skipped: false };
}
