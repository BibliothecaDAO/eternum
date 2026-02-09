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

  it("matches pending tile-removal with same owner on nearby hex", () => {
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
