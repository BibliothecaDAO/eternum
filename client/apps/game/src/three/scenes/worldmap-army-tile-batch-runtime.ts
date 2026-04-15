import type { ExplorerTroopsTileSystemUpdate } from "@bibliothecadao/eternum";
import type { HexPosition, ID } from "@bibliothecadao/types";

export interface PendingArmyTileBatchEntry {
  entityId: ID;
  latestLiveUpdate?: ExplorerTroopsTileSystemUpdate;
  latestRemovedUpdate?: ExplorerTroopsTileSystemUpdate;
}

export interface ResolvedArmyTileBatchLiveUpdate {
  entityId: ID;
  update: ExplorerTroopsTileSystemUpdate;
}

export interface ResolvedArmyTileBatchRemoval {
  entityId: ID;
  update: ExplorerTroopsTileSystemUpdate;
}

export interface ResolvedArmyTileBatch {
  liveUpdates: ResolvedArmyTileBatchLiveUpdate[];
  removals: ResolvedArmyTileBatchRemoval[];
  hasWork: boolean;
}

export interface ArmyHexBatchMutation {
  entityId: ID;
  kind: "remove" | "upsert";
  oldPos?: HexPosition;
  newPos?: HexPosition;
  ownerAddress?: bigint;
  ownerStructureId?: ID | null;
}

export interface ArmyHexBatchApplyPlan {
  occupancyRemovals: Array<{
    entityId: ID;
    position: HexPosition;
  }>;
  trackedRemovals: ID[];
  upserts: Array<{
    entityId: ID;
    newPos: HexPosition;
    ownerAddress: bigint;
    ownerStructureId?: ID | null;
  }>;
}

export function enqueueArmyTileBatchUpdate(
  pendingEntries: Map<ID, PendingArmyTileBatchEntry>,
  update: ExplorerTroopsTileSystemUpdate,
): void {
  const entry = pendingEntries.get(update.entityId) ?? { entityId: update.entityId };

  if (update.removed) {
    entry.latestRemovedUpdate = update;
  } else {
    entry.latestLiveUpdate = update;
  }

  pendingEntries.set(update.entityId, entry);
}

export function resolveArmyTileBatch(entries: Iterable<PendingArmyTileBatchEntry>): ResolvedArmyTileBatch {
  const liveUpdates: ResolvedArmyTileBatchLiveUpdate[] = [];
  const removals: ResolvedArmyTileBatchRemoval[] = [];

  for (const entry of entries) {
    if (entry.latestLiveUpdate) {
      liveUpdates.push({
        entityId: entry.entityId,
        update: entry.latestLiveUpdate,
      });
      continue;
    }

    if (entry.latestRemovedUpdate) {
      removals.push({
        entityId: entry.entityId,
        update: entry.latestRemovedUpdate,
      });
    }
  }

  liveUpdates.sort((left, right) => Number(left.entityId) - Number(right.entityId));
  removals.sort((left, right) => Number(left.entityId) - Number(right.entityId));

  return {
    liveUpdates,
    removals,
    hasWork: liveUpdates.length > 0 || removals.length > 0,
  };
}

export function resolveArmyHexBatchApplyPlan(mutations: ArmyHexBatchMutation[]): ArmyHexBatchApplyPlan {
  const occupancyRemovals: ArmyHexBatchApplyPlan["occupancyRemovals"] = [];
  const trackedRemovals: ArmyHexBatchApplyPlan["trackedRemovals"] = [];
  const upserts: ArmyHexBatchApplyPlan["upserts"] = [];

  for (const mutation of mutations) {
    if (mutation.kind === "remove") {
      trackedRemovals.push(mutation.entityId);
      if (mutation.oldPos) {
        occupancyRemovals.push({
          entityId: mutation.entityId,
          position: mutation.oldPos,
        });
      }
      continue;
    }

    if (mutation.oldPos && mutation.newPos) {
      const changedPosition =
        mutation.oldPos.col !== mutation.newPos.col || mutation.oldPos.row !== mutation.newPos.row;
      if (changedPosition) {
        occupancyRemovals.push({
          entityId: mutation.entityId,
          position: mutation.oldPos,
        });
      }
    }

    if (mutation.newPos && mutation.ownerAddress !== undefined) {
      upserts.push({
        entityId: mutation.entityId,
        newPos: mutation.newPos,
        ownerAddress: mutation.ownerAddress,
        ownerStructureId: mutation.ownerStructureId,
      });
    }
  }

  return {
    occupancyRemovals,
    trackedRemovals,
    upserts,
  };
}
