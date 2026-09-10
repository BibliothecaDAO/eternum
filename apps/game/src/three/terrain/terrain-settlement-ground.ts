import { BiomeType, StructureType } from "@bibliothecadao/types/terrain";

import { hexCellKey } from "./hex-cell-key";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";
import { isTerrainWaterBiome } from "./terrain-water";

/** Presentation only: settlements reclaim sand from water without changing the game's biome rows. */
export function applySettlementIslands(request: TerrainPageRequest): TerrainPageRequest {
  const sites = new Set(
    request.settlementAnchors
      .filter(
        ({ structureType }) =>
          structureType === StructureType.Camp ||
          structureType === StructureType.Village ||
          structureType === StructureType.Realm,
      )
      .map(({ col, row }) => hexCellKey(col, row)),
  );
  if (sites.size === 0) return request;
  const resolveGround = (cell: TerrainCellInput) =>
    sites.has(hexCellKey(cell.col, cell.row)) ? resolveSettlementLandCell(cell) : cell;
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
