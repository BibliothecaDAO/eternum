import { describe, expect, it } from "vitest";
import { collectMissingExplorerIdsInBounds } from "./worldmap-explorer-hydration";

const TileOccupier = {
  RealmRegularLevel1: 1,
  ExplorerKnightT1Regular: 15,
  ExplorerPaladinT1Regular: 18,
  ExplorerCrossbowmanT2Regular: 22,
  Chest: 34,
} as const;

type TileLike = {
  occupier_id: number;
  occupier_type: number;
};

const keyFor = (col: number, row: number) => `${col},${row}`;

describe("collectMissingExplorerIdsInBounds", () => {
  it("returns only missing explorer ids from tiles in bounds", () => {
    const tiles = new Map<string, TileLike>([
      [keyFor(10, 20), { occupier_id: 101, occupier_type: TileOccupier.ExplorerKnightT1Regular }],
      [keyFor(11, 20), { occupier_id: 202, occupier_type: TileOccupier.ExplorerCrossbowmanT2Regular }],
      [keyFor(12, 20), { occupier_id: 303, occupier_type: TileOccupier.RealmRegularLevel1 }],
      [keyFor(13, 20), { occupier_id: 404, occupier_type: TileOccupier.Chest }],
    ]);

    const missing = collectMissingExplorerIdsInBounds({
      bounds: { minCol: 10, maxCol: 13, minRow: 20, maxRow: 20 },
      readTile: (col, row) => tiles.get(keyFor(col, row)),
      hasExplorer: (entityId) => entityId === 202,
    });

    expect(missing).toEqual([101]);
  });

  it("deduplicates explorer ids found on multiple tiles", () => {
    const tiles = new Map<string, TileLike>([
      [keyFor(5, 5), { occupier_id: 777, occupier_type: TileOccupier.ExplorerPaladinT1Regular }],
      [keyFor(6, 5), { occupier_id: 777, occupier_type: TileOccupier.ExplorerPaladinT1Regular }],
    ]);

    const missing = collectMissingExplorerIdsInBounds({
      bounds: { minCol: 5, maxCol: 6, minRow: 5, maxRow: 5 },
      readTile: (col, row) => tiles.get(keyFor(col, row)),
      hasExplorer: () => false,
    });

    expect(missing).toEqual([777]);
  });
});
