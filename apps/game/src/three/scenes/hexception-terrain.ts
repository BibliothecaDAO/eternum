import { LOCAL_VIEW_REACH } from "@bibliothecadao/eternum/expeditions";
import { StructureType, getNeighborHexes } from "@bibliothecadao/types";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";
import { resolveSettlementLandCell } from "@/three/terrain/terrain-settlement-ground";
import { worldOrigin } from "@/three/world-origin";

const axialColumn = (hex: { col: number; row: number }) => hex.col - Math.floor((hex.row + 1) / 2);

/**
 * The map hex a local-view hex shows: the one standing to the realm's map site as the local hex stands to the view's
 * centre. A Frontier realm's local centre is a fixed reference off the map while its site moves each day, so a local
 * hex's own coordinates name no tile; elsewhere the two centres are the same hex and this is the identity.
 */
export function resolveLocalHexOnMap(
  localCenter: { col: number; row: number },
  localHex: { col: number; row: number },
  mapSite: { col: number; row: number },
): { col: number; row: number } {
  const row = mapSite.row + (localHex.row - localCenter.row);
  const q = axialColumn(mapSite) + (axialColumn(localHex) - axialColumn(localCenter));
  return { col: q + Math.floor((row + 1) / 2), row };
}

/** Tile the local view with the selected world hex and two complete neighboring rings. */
export function getLocalTerrainRegions(worldCenter: { col: number; row: number }, regionRadius: number) {
  const originQ = axialColumn(worldCenter);
  return getLocalHexDisk(worldCenter, LOCAL_VIEW_REACH).map((targetHex) => {
    const q = axialColumn(targetHex) - originQ;
    const r = targetHex.row - worldCenter.row;
    // Axial basis vectors pack radius-N disks without gaps or overlapping cells.
    const localQ = q * (2 * regionRadius + 1) + r * (regionRadius + 1);
    const localRow = -q * (regionRadius + 1) + r * regionRadius;
    return {
      center: [localQ + Math.floor((localRow + 1) / 2), localRow],
      isMainHex: q === 0 && r === 0,
      targetHex,
    };
  });
}

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

/**
 * Local buildable cells share one ground and settlement treatment in the game and lab. The terrain draws world hexes
 * around the floating origin, so the local disk is handed over as the hexes that land on the local lattice; the origin
 * keeps an even row, so every cell lands exactly under its building.
 */
export function createHexceptionTerrainRequest(
  cells: Iterable<TerrainCellInput>,
  climate: TerrainPageRequest["climate"],
  pageKey: string,
): TerrainPageRequest {
  const origin = worldOrigin();
  const ordered = [...cells]
    .map((cell) => resolveSettlementLandCell({ ...cell, col: cell.col + origin.col, row: cell.row + origin.row }))
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
