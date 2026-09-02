import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { terrainHexToWorld } from "./terrain-coordinates";
import { buildTerrainRoadSegments } from "./terrain-roads";
import { hexCellKey } from "./hex-cell-key";
import type { TerrainCellInput, TerrainRoadAnchor } from "./terrain-types";

describe("terrain road network", () => {
  it("deterministically connects nearby structures sharing one owner", () => {
    const cells = createLandCells(7, 5);
    const anchors: TerrainRoadAnchor[] = [
      { col: 1, owner: "1", row: 2, structureId: "alpha" },
      { col: 5, owner: "1", row: 2, structureId: "beta" },
      { col: 3, owner: "2", row: 4, structureId: "foreign" },
    ];

    const forward = buildTerrainRoadSegments({ anchors, cellsByKey: roadCellsByKey(cells) });
    const reversed = buildTerrainRoadSegments({
      anchors: [...anchors].reverse(),
      cellsByKey: roadCellsByKey([...cells].reverse()),
    });

    expect(reversed).toEqual(forward);
    expect(new Set(forward.map(({ routeId }) => routeId))).toEqual(new Set(["alpha:beta"]));
    expect(forward).toHaveLength(4);
  });

  it("routes around water and refuses to use unexplored cells", () => {
    const cells = createLandCells(7, 5).map((cell) =>
      cell.col === 3 && cell.row === 2 ? { ...cell, biome: BiomeType.Ocean, previewBiome: BiomeType.Ocean } : cell,
    );
    const anchors: TerrainRoadAnchor[] = [
      { col: 1, owner: "1", row: 2, structureId: "alpha" },
      { col: 5, owner: "1", row: 2, structureId: "beta" },
    ];
    const routed = buildTerrainRoadSegments({ anchors, cellsByKey: roadCellsByKey(cells) });
    const waterCenter = terrainHexToWorld(3, 2);

    expect(routed.length).toBeGreaterThan(4);
    expect(routed.every(({ start, end }) => !matchesPoint(start, waterCenter) && !matchesPoint(end, waterCenter))).toBe(
      true,
    );

    const concealed = cells.map((cell) =>
      cell.col === 3 ? { ...cell, biome: null, explored: false, occupied: false } : cell,
    );
    expect(buildTerrainRoadSegments({ anchors, cellsByKey: roadCellsByKey(concealed) })).toEqual([]);
  });
});

function matchesPoint(point: readonly [number, number], target: { x: number; z: number }): boolean {
  return point[0] === target.x && point[1] === target.z;
}

function createLandCells(columns: number, rows: number): TerrainCellInput[] {
  return Array.from({ length: columns * rows }, (_, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      biome: BiomeType.Grassland,
      col,
      explored: true,
      occupied: false,
      previewBiome: BiomeType.Grassland,
      row,
    };
  });
}

function roadCellsByKey(cells: readonly TerrainCellInput[]): Map<number, TerrainCellInput> {
  return new Map(cells.map((cell) => [hexCellKey(cell.col, cell.row), cell]));
}
