import { describe, expect, it } from "vitest";
import { findSupersededArmyRemoval } from "./worldmap-army-removal";

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
