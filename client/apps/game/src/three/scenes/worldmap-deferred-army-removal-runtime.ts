interface RetryDeferredWorldmapArmyRemovalsInput<TEntityId> {
  deferredChunkRemovals: Map<TEntityId, { reason: "tile" | "zero"; scheduledAt: number }>;
  onRecoveredArmy: (entityId: TEntityId) => void;
  onRetryRemoval: (entityId: TEntityId, reason: "tile" | "zero") => void;
  resolveLastTileSyncAt: (entityId: TEntityId) => number;
}

export function retryDeferredWorldmapArmyRemovals<TEntityId>(
  input: RetryDeferredWorldmapArmyRemovalsInput<TEntityId>,
): number {
  if (input.deferredChunkRemovals.size === 0) {
    return 0;
  }

  const deferred = Array.from(input.deferredChunkRemovals.entries());
  input.deferredChunkRemovals.clear();

  deferred.forEach(([entityId, { reason, scheduledAt }]) => {
    const lastUpdate = input.resolveLastTileSyncAt(entityId);
    if (lastUpdate > scheduledAt) {
      input.onRecoveredArmy(entityId);
      return;
    }

    input.onRetryRemoval(entityId, reason);
  });

  return deferred.length;
}
