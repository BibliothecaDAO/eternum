import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/sync/game-scope", () => ({ gameEntityKey: (keys: bigint[]) => keys[0].toString() }));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: unknown, entity: unknown) =>
    component instanceof Map ? component.get(entity) : undefined,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Position: class {
    constructor(private readonly coords: { x: number; y: number }) {}

    getNormalized() {
      return this.coords;
    }
  },
}));

import { buildExplorationSnapshot } from "./map-cache";

describe("buildExplorationSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([false, true])("builds the automation view on the exploring army layer (alt=%s)", async (alt) => {
    const explorerOwnerStructureId = 2001;
    const structureId = 201;
    const armyId = 301;
    const structureOwner = 0xabcden;
    const armyOwner = 0x98765n;
    const components = {
      ExplorerTroops: new Map([
        ["1", { coord: { alt, x: 10, y: 10 } }],
        [armyId.toString(), { owner: explorerOwnerStructureId }],
      ]),
      Structure: new Map([
        [structureId.toString(), { owner: structureOwner }],
        [explorerOwnerStructureId.toString(), { owner: armyOwner }],
      ]),
    };
    const worldSpatialProjection = {
      getTilesInBounds: vi.fn(() => [
        {
          hexCoords: { alt, col: 10, row: 10 },
          biome: 1,
          occupierId: 0,
          occupierType: 0,
        },
      ]),
      getStructuresInBounds: vi.fn(() => [{ entityId: structureId, hexCoords: { alt, col: 10, row: 11 } }]),
      getArmiesInBounds: vi.fn(() => [{ entityId: armyId, hexCoords: { alt, col: 11, row: 10 } }]),
    };

    const snapshot = await buildExplorationSnapshot({
      components: components as never,
      explorerId: 1,
      scopeRadius: 1,
      worldSpatialProjection: worldSpatialProjection as never,
    });

    expect(snapshot?.alt).toBe(alt);
    for (const query of [
      worldSpatialProjection.getTilesInBounds,
      worldSpatialProjection.getStructuresInBounds,
      worldSpatialProjection.getArmiesInBounds,
    ])
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ alt }));
    expect(snapshot?.structureHexes.get(10)?.get(11)?.owner).toBe(structureOwner);
    expect(snapshot?.armyHexes.get(11)?.get(10)?.owner).toBe(armyOwner);
    expect(snapshot?.exploredTiles.get(10)?.get(10)).toBe(1);
  });
});
