import { BiomeType, StructureType } from "@bibliothecadao/types/terrain";

import { hexCellKey } from "./hex-cell-key";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";
import { isTerrainWaterBiome } from "./terrain-water";
import { isEtherealTerrainCell } from "./terrain-surface-presentation";

// Which structures stand on dry ground. Built settlements do, Frontier's ruin (a fallen realm) and beasts (a camp)
// among them; the rest stand on the tile as it is. A new category fails typecheck here until it is placed.
const RECLAIMS_LAND_FROM_WATER: Record<StructureType, boolean> = {
  [StructureType.Realm]: true,
  [StructureType.Village]: true,
  [StructureType.Camp]: true,
  [StructureType.Ruin]: true,
  [StructureType.Beasts]: true,
  [StructureType.Hyperstructure]: false,
  [StructureType.Bank]: false,
  [StructureType.Mine]: false,
  [StructureType.BitcoinMine]: false,
  [StructureType.Rift]: false,
};

/** Presentation only: settlements reclaim sand from water without changing the game's biome rows. */
export function applySettlementIslands(request: TerrainPageRequest): TerrainPageRequest {
  const sites = new Set(
    request.settlementAnchors
      .filter(({ structureType }) => RECLAIMS_LAND_FROM_WATER[structureType])
      .map(({ col, row }) => hexCellKey(col, row)),
  );
  if (sites.size === 0) return request;
  const resolveGround = (cell: TerrainCellInput) =>
    sites.has(hexCellKey(cell.col, cell.row)) && !isEtherealTerrainCell(request, cell)
      ? resolveSettlementLandCell(cell)
      : cell;
  return { ...request, cells: request.cells.map(resolveGround), halo: request.halo.map(resolveGround) };
}

/** The local settlement view uses dry ground everywhere, including unbuilt water hexes. */
export function resolveSettlementLandCell(cell: TerrainCellInput): TerrainCellInput {
  if (!isTerrainWaterBiome(cell.biome) && !isTerrainWaterBiome(cell.previewBiome)) return cell;
  return {
    ...cell,
    biome: isTerrainWaterBiome(cell.biome) ? BiomeType.Beach : cell.biome,
    previewBiome: isTerrainWaterBiome(cell.previewBiome) ? BiomeType.Beach : cell.previewBiome,
  };
}
