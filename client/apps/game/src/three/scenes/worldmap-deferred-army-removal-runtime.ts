interface ArmyHexPosition {
  col: number;
  row: number;
}

export interface DeferredWorldmapArmyRemoval {
  reason: "tile" | "zero";
  scheduledAt: number;
  ownerAddress?: bigint;
  ownerStructureId?: number | null;
  position?: ArmyHexPosition;
}

interface RetryDeferredWorldmapArmyRemovalsInput<TEntityId> {
  deferredChunkRemovals: Map<TEntityId, DeferredWorldmapArmyRemoval>;
  onRecoveredArmy: (entityId: TEntityId) => void;
  onRetryRemoval: (entityId: TEntityId, reason: "tile" | "zero", context?: DeferredWorldmapArmyRemovalContext) => void;
  resolveLastTileSyncAt: (entityId: TEntityId) => number;
}

interface DeferredWorldmapArmyRemovalContext {
  ownerAddress?: bigint;
  ownerStructureId?: number | null;
  position?: ArmyHexPosition;
}

export function retryDeferredWorldmapArmyRemovals<TEntityId>(
  input: RetryDeferredWorldmapArmyRemovalsInput<TEntityId>,
): number {
  if (input.deferredChunkRemovals.size === 0) {
    return 0;
  }

  const deferred = Array.from(input.deferredChunkRemovals.entries());
  input.deferredChunkRemovals.clear();

  deferred.forEach(([entityId, removal]) => {
    const { reason, scheduledAt } = removal;
    const lastUpdate = input.resolveLastTileSyncAt(entityId);
    if (lastUpdate > scheduledAt) {
      input.onRecoveredArmy(entityId);
      return;
    }

    retryDeferredRemoval(input, entityId, removal);
  });

  return deferred.length;
}

function retryDeferredRemoval<TEntityId>(
  input: RetryDeferredWorldmapArmyRemovalsInput<TEntityId>,
  entityId: TEntityId,
  removal: DeferredWorldmapArmyRemoval,
): void {
  const context = buildDeferredRemovalRetryContext(removal);
  if (context) {
    input.onRetryRemoval(entityId, removal.reason, context);
    return;
  }

  input.onRetryRemoval(entityId, removal.reason);
}

function buildDeferredRemovalRetryContext(
  removal: DeferredWorldmapArmyRemoval,
): DeferredWorldmapArmyRemovalContext | undefined {
  const { ownerAddress, ownerStructureId, position } = removal;
  if (ownerAddress === undefined && ownerStructureId === undefined && position === undefined) {
    return undefined;
  }

  return { ownerAddress, ownerStructureId, position };
}
