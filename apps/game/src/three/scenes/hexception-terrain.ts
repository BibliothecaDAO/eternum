import { StructureType, getNeighborHexes } from "@bibliothecadao/types";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";
import { resolveSettlementLandCell } from "@/three/terrain/terrain-settlement-ground";

export function getLocalHexDisk(center: { col: number; row: number }, radius: number) {
  const cells = new Map([[`${center.col}:${center.row}`, { ...center, isBorder: false }]]);
  let frontier = [center];
  for (let ring = 1; ring <= radius; ring++) {
    const next: typeof frontier = [];
    for (const cell of frontier) {
      for (const neighbor of getNeighborHexes(cell.col, cell.row)) {
        const key = `${neighbor.col}:${neighbor.row}`;
        if (cells.has(key)) continue;
        const coordinate = { col: neighbor.col, row: neighbor.row };
        cells.set(key, { ...coordinate, isBorder: ring === radius });
        next.push(coordinate);
      }
    }
    frontier = next;
  }
  return [...cells.values()];
}

/** Local buildable cells share one ground and settlement treatment in the game and lab. */
export function createHexceptionTerrainRequest(
  cells: Iterable<TerrainCellInput>,
  climate: TerrainPageRequest["climate"],
  pageKey: string,
): TerrainPageRequest {
  const ordered = [...cells]
    .map(resolveSettlementLandCell)
    .sort((left, right) => left.row - right.row || left.col - right.col);
  return {
    cells: ordered,
    climate,
    halo: [],
    mapCenter: 0,
    pageKey,
    roadSegments: [],
    settlementAnchors: ordered
      .filter((cell) => cell.occupied)
      .map(({ col, row }) => ({
        col,
        row,
        level: 1,
        structureId: `hexception:${col}:${row}`,
        structureType: StructureType.Village,
      })),
    strictBiomeParity: false,
    subdivisions: 2,
  };
}
