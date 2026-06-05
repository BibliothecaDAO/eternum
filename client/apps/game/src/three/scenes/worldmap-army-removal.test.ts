import { describe, expect, it } from "vitest";
import {
  findSupersededArmyRemoval,
  isStaleTrackedArmyTileRemoval,
  shouldRecoverPendingArmyRemovalFromExplorerTroops,
} from "./worldmap-army-removal";

describe("isStaleTrackedArmyTileRemoval", () => {
  it("treats a tile removal as stale when the tracked army already moved elsewhere", () => {
    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "tile",
        trackedPosition: { col: 12, row: 15 },
        removalPosition: { col: 10, row: 10 },
      }),
    ).toBe(true);
  });

  it("keeps matching tracked tile removals eligible for normal processing", () => {
    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "tile",
        trackedPosition: { col: 10, row: 10 },
        removalPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });

  it("ignores non-tile removals and missing positions", () => {
    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "zero",
        trackedPosition: { col: 10, row: 10 },
        removalPosition: { col: 12, row: 15 },
      }),
    ).toBe(false);

    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "tile",
        trackedPosition: undefined,
        removalPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });
});

describe("shouldRecoverPendingArmyRemovalFromExplorerTroops", () => {
  it("does not recover tile removals from troop updates still pointing at the removed tile", () => {
    expect(
      shouldRecoverPendingArmyRemovalFromExplorerTroops({
        reason: "tile",
        removalPosition: { col: 10, row: 10 },
        troopsPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });

  it("recovers tile removals when troops have moved away from the removed tile", () => {
    expect(
      shouldRecoverPendingArmyRemovalFromExplorerTroops({
        reason: "tile",
        removalPosition: { col: 10, row: 10 },
        troopsPosition: { col: 11, row: 10 },
      }),
    ).toBe(true);
  });

  it("requires explicit position evidence for tile removals", () => {
    expect(
      shouldRecoverPendingArmyRemovalFromExplorerTroops({
        reason: "tile",
        removalPosition: undefined,
        troopsPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });

  it("does not recover zero-count removals from later troop updates", () => {
    expect(
      shouldRecoverPendingArmyRemovalFromExplorerTroops({
        reason: "zero",
        removalPosition: { col: 10, row: 10 },
        troopsPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });
});

describe("findSupersededArmyRemoval", () => {
  it("returns undefined when incoming owner is missing", () => {
    const result = findSupersededArmyRemoval({
      incomingEntityId: 2,
      incomingOwnerAddress: undefined,
      incomingPosition: { col: 10, row: 10 },
      pending: [
        {
          entityId: 1,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
      ],
    });

    expect(result).toBeUndefined();
  });

  it("prefers matching owner-structure when multiple nearby candidates exist", () => {
    const result = findSupersededArmyRemoval({
      incomingEntityId: 2,
      incomingOwnerAddress: 123n,
      incomingOwnerStructureId: 99,
      incomingPosition: { col: 11, row: 10 },
      pending: [
        {
          entityId: 1,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          ownerStructureId: 88,
          position: { col: 10, row: 10 },
        },
        {
          entityId: 3,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          ownerStructureId: 99,
          position: { col: 11, row: 11 },
        },
      ],
    });

    expect(result).toBe(3);
  });

  it("supersedes on nearby-only match when there is exactly one candidate", () => {
    const result = findSupersededArmyRemoval({
      incomingEntityId: 2,
      incomingOwnerAddress: 123n,
      incomingPosition: { col: 11, row: 10 },
      pending: [
        {
          entityId: 1,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
      ],
    });

    expect(result).toBe(1);
  });

  it("does not supersede on nearby-only matches when multiple candidates are present", () => {
    const result = findSupersededArmyRemoval({
      incomingEntityId: 2,
      incomingOwnerAddress: 123n,
      incomingPosition: { col: 11, row: 10 },
      pending: [
        {
          entityId: 1,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
        {
          entityId: 4,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 11, row: 11 },
        },
      ],
    });

    expect(result).toBeUndefined();
  });

  it("does not supersede when multiple exact-position candidates are present", () => {
    const result = findSupersededArmyRemoval({
      incomingEntityId: 4,
      incomingOwnerAddress: 123n,
      incomingPosition: { col: 10, row: 10 },
      pending: [
        {
          entityId: 1,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
        {
          entityId: 3,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
      ],
    });

    expect(result).toBeUndefined();
  });

  it("ignores non-tile removals and same-entity updates", () => {
    const result = findSupersededArmyRemoval({
      incomingEntityId: 2,
      incomingOwnerAddress: 123n,
      incomingPosition: { col: 10, row: 10 },
      pending: [
        {
          entityId: 2,
          scheduledAt: Date.now(),
          reason: "tile",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
        {
          entityId: 3,
          scheduledAt: Date.now(),
          reason: "zero",
          chunkKey: "0,0",
          ownerAddress: 123n,
          position: { col: 10, row: 10 },
        },
      ],
    });

    expect(result).toBeUndefined();
  });
});
