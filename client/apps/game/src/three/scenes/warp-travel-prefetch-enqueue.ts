import {
  insertPrefetchQueueItem,
  type PrefetchFetchKeyLookup,
  type PrefetchQueueItem,
} from "./worldmap-prefetch-queue";

interface EnqueueWarpTravelPrefetchInput {
  chunkKey: string;
  fetchKey: string;
  priority: number;
  queue: PrefetchQueueItem[];
  queuedFetchKeys: Set<string>;
  fetchedFetchKeys: Set<string>;
  pendingFetchKeys: PrefetchFetchKeyLookup;
}

export function enqueueWarpTravelPrefetch(
  input: EnqueueWarpTravelPrefetchInput,
): { enqueued: boolean; skipped: boolean } {
  if (!input.chunkKey) {
    return { enqueued: false, skipped: true };
  }

  const tilesAlreadyHandled =
    input.fetchedFetchKeys.has(input.fetchKey) ||
    input.pendingFetchKeys.has(input.fetchKey) ||
    input.queuedFetchKeys.has(input.fetchKey);

  if (tilesAlreadyHandled) {
    return { enqueued: false, skipped: true };
  }

  input.queuedFetchKeys.add(input.fetchKey);
  insertPrefetchQueueItem(input.queue, {
    chunkKey: input.chunkKey,
    fetchKey: input.fetchKey,
    priority: input.priority,
    fetchTiles: true,
  });

  return { enqueued: true, skipped: false };
}
