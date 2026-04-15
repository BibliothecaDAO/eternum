import { describe, expect, it } from "vitest";

import type { ExplorerTroopsTileSystemUpdate } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";

import {
  enqueueArmyTileBatchUpdate,
  resolveArmyHexBatchApplyPlan,
  resolveArmyTileBatch,
  type PendingArmyTileBatchEntry,
} from "./worldmap-army-tile-batch-runtime";

function createArmyTileUpdate(
  entityId: number,
  input: {
    col: number;
    row: number;
    removed?: boolean;
  },
): ExplorerTroopsTileSystemUpdate {
  return {
    entityId,
    hexCoords: { col: input.col, row: input.row },
    troopType: TroopType.Knight,
    troopTier: TroopTier.T1,
    isDaydreamsAgent: false,
    ownerName: "",
    guildName: "",
    ownerAddress: 123n,
    ownerStructureId: 77,
    troopCount: input.removed ? 0 : 10,
    currentStamina: 10,
    maxStamina: 10,
    removed: input.removed ?? false,
  };
}

describe("worldmap army tile batch runtime", () => {
  it("keeps only the last live update for an entity", () => {
    const pendingEntries = new Map<number, PendingArmyTileBatchEntry>();

    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(7, { col: 10, row: 10 }));
    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(7, { col: 11, row: 10 }));

    const resolvedBatch = resolveArmyTileBatch(pendingEntries.values());

    expect(resolvedBatch.liveUpdates).toHaveLength(1);
    expect(resolvedBatch.liveUpdates[0].update.hexCoords).toEqual({ col: 11, row: 10 });
    expect(resolvedBatch.removals).toHaveLength(0);
  });

  it("drops a same-batch removed update when a live update exists for that entity", () => {
    const pendingEntries = new Map<number, PendingArmyTileBatchEntry>();

    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(9, { col: 10, row: 10, removed: true }));
    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(9, { col: 11, row: 10 }));

    const resolvedBatch = resolveArmyTileBatch(pendingEntries.values());

    expect(resolvedBatch.liveUpdates).toHaveLength(1);
    expect(resolvedBatch.liveUpdates[0].entityId).toBe(9);
    expect(resolvedBatch.removals).toHaveLength(0);
  });

  it("preserves true removals when no live update exists in the same batch", () => {
    const pendingEntries = new Map<number, PendingArmyTileBatchEntry>();

    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(11, { col: 14, row: 10, removed: true }));

    const resolvedBatch = resolveArmyTileBatch(pendingEntries.values());

    expect(resolvedBatch.liveUpdates).toHaveLength(0);
    expect(resolvedBatch.removals).toHaveLength(1);
    expect(resolvedBatch.removals[0].entityId).toBe(11);
  });

  it("keeps distinct convoy live updates for adjacent same-tx movers", () => {
    const pendingEntries = new Map<number, PendingArmyTileBatchEntry>();

    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(1, { col: 11, row: 10 }));
    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(2, { col: 12, row: 10 }));
    enqueueArmyTileBatchUpdate(pendingEntries, createArmyTileUpdate(3, { col: 13, row: 10 }));

    const resolvedBatch = resolveArmyTileBatch(pendingEntries.values());

    expect(resolvedBatch.liveUpdates.map((entry) => entry.entityId)).toEqual([1, 2, 3]);
    expect(resolvedBatch.removals).toHaveLength(0);
  });

  it("plans remove-then-add application for moved armies", () => {
    const plan = resolveArmyHexBatchApplyPlan([
      {
        entityId: 1,
        kind: "upsert",
        oldPos: { col: 10, row: 10 },
        newPos: { col: 11, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
      {
        entityId: 2,
        kind: "upsert",
        oldPos: { col: 11, row: 10 },
        newPos: { col: 12, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
    ]);

    expect(plan.occupancyRemovals).toEqual([
      { entityId: 1, position: { col: 10, row: 10 } },
      { entityId: 2, position: { col: 11, row: 10 } },
    ]);
    expect(plan.upserts).toEqual([
      {
        entityId: 1,
        newPos: { col: 11, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
      {
        entityId: 2,
        newPos: { col: 12, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
    ]);
  });
});
