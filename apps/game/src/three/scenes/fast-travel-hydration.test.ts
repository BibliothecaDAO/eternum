import { describe, expect, it } from "vitest";

import {
  hydrateFastTravelChunkState,
  type FastTravelArmyHydrationInput,
  type FastTravelSpireHydrationInput,
} from "./fast-travel-hydration";

const armies: FastTravelArmyHydrationInput[] = [
  {
    entityId: "army-1",
    hexCoords: { col: 10, row: 10 },
    ownerName: "Aurora",
  },
  {
    entityId: "army-2",
    hexCoords: { col: 30, row: 30 },
    ownerName: "Bastion",
  },
];

const spires: FastTravelSpireHydrationInput[] = [
  {
    entityId: "spire-1",
    worldHexCoords: { col: 400, row: 120 },
    travelHexCoords: { col: 12, row: 11 },
    label: "North Spire",
  },
  {
    entityId: "spire-2",
    worldHexCoords: { col: 520, row: 240 },
    travelHexCoords: { col: 41, row: 38 },
    label: "South Spire",
  },
];

describe("hydrateFastTravelChunkState", () => {
  it("keeps manager payloads stable for empty chunks", () => {
    const result = hydrateFastTravelChunkState({
      chunkKey: "0,0",
      startCol: 0,
      startRow: 0,
      width: 8,
      height: 8,
      armies: [],
      spires: [],
    });

    expect(result.armies).toEqual([]);
    expect(result.spireAnchors).toEqual([]);
    expect(result.managerPayload).toEqual({
      armyEntities: [],
      spireAnchors: [],
    });
    expect(result.hexEntityLookup.size).toBe(0);
  });

  it("hydrates visible armies into the chunk entity lookup and manager payload", () => {
    const result = hydrateFastTravelChunkState({
      chunkKey: "8,8",
      startCol: 8,
      startRow: 8,
      width: 8,
      height: 8,
      armies,
      spires: [],
    });

    expect(result.armies).toEqual([
      {
        entityId: "army-1",
        hexCoords: { col: 10, row: 10 },
        ownerName: "Aurora",
      },
    ]);
    expect(result.managerPayload.armyEntities).toEqual(result.armies);
    expect(result.hexEntityLookup.get("10,10")).toEqual([
      {
        entityId: "army-1",
        kind: "army",
      },
    ]);
  });

  it("hydrates visible stubbed Spire anchors into scene state", () => {
    const result = hydrateFastTravelChunkState({
      chunkKey: "8,8",
      startCol: 8,
      startRow: 8,
      width: 8,
      height: 8,
      armies,
      spires,
    });

    expect(result.spireAnchors).toEqual([
      {
        entityId: "spire-1",
        label: "North Spire",
        worldHexCoords: { col: 400, row: 120 },
        travelHexCoords: { col: 12, row: 11 },
      },
    ]);
    expect(result.managerPayload.spireAnchors).toEqual(result.spireAnchors);
    expect(result.hexEntityLookup.get("12,11")).toEqual([
      {
        entityId: "spire-1",
        kind: "spire",
      },
    ]);
  });
});
