import { TileOccupier } from "@bibliothecadao/types";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";
import { readMinimapTiles } from "./hex-minimap";

type Projection = Pick<WorldSpatialProjection, "getTiles" | "getStructures">;

const exploredTile = (col: number, row: number) => ({
  kind: "tile" as const,
  spatialId: `tile:0:${col}:${row}` as const,
  hexCoords: { alt: false, col, row },
  biome: 3,
  occupierId: 0,
  occupierType: TileOccupier.None,
  occupierIsStructure: false,
  rewardExtracted: false,
});

describe("minimap tiles", () => {
  it("marks a Frontier realm on the site it is raised on, where no tile carries it", () => {
    const projection: Projection = {
      getTiles: () => [exploredTile(2851, 8450)],
      getStructures: () => [
        {
          kind: "structure",
          spatialId: "entity:2784",
          entityId: 2784,
          reserved: false,
          hexCoords: { alt: false, col: 2850, row: 8450 },
          occupierType: TileOccupier.RealmRegularLevel1,
        },
      ],
    };

    expect(readMinimapTiles(projection, false)).toEqual([
      expect.objectContaining({ col: 2851, row: 8450, biome: 3, occupier_is_structure: false }),
      expect.objectContaining({
        col: 2850,
        row: 8450,
        occupier_id: "2784",
        occupier_type: TileOccupier.RealmRegularLevel1,
        occupier_is_structure: true,
      }),
    ]);
  });
});
