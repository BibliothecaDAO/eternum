import type { SettlementRelationship } from "@/three/structures/settlement-appearance";
import { ChestModelPath } from "@/three/constants/scene-constants";
import { BiomeType } from "@bibliothecadao/types";
import { resolveTerrainLabStructureType, type TerrainLabBuilding } from "./terrain-lab-buildings";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import type { ModelType } from "@/three/types/army";
import { resolveSettlementLandCell } from "@/three/terrain/terrain-settlement-ground";

export interface TerrainLabPreview {
  biome: BiomeType | "fixture" | "ethereal";
  fog: "fixture" | "clear" | "frontier" | "covered";
  selection: boolean;
  army: ModelType | "none";
  spin: boolean;
  yaw: number;
  relationship: SettlementRelationship;
  realmOrderId: number;
}

export const DEFAULT_TERRAIN_LAB_PREVIEW: TerrainLabPreview = {
  biome: "fixture",
  fog: "fixture",
  selection: true,
  army: "none",
  spin: false,
  yaw: 0,
  relationship: "owned",
  realmOrderId: 1,
};

export function buildTerrainLabRequest(
  request: TerrainPageRequest,
  preview: TerrainLabPreview,
  selected: { col: number; row: number },
  buildings: readonly TerrainLabBuilding[] = [],
  localMode = false,
): TerrainPageRequest {
  const structures = buildings.filter((building) => building.path !== ChestModelPath);
  const occupied = new Set(structures.map((building) => `${building.col}:${building.row}`));
  const cells = request.cells.map((cell) => {
    const explored =
      preview.fog === "fixture"
        ? cell.explored
        : preview.fog === "clear" || (preview.fog === "frontier" && cell.col <= selected.col);
    // Ethereal is a visual layer, not a gameplay biome. Bare supplies its shared terrain geometry.
    const biome =
      preview.biome === "fixture"
        ? (cell.biome ?? cell.previewBiome)
        : preview.biome === "ethereal"
          ? BiomeType.Bare
          : preview.biome;
    if (explored && biome === null) throw new Error(`Lab tile ${cell.col},${cell.row} has no biome to reveal`);
    return {
      ...cell,
      biome: explored ? biome : null,
      previewBiome: biome,
      explored,
      occupied: cell.occupied || occupied.has(`${cell.col}:${cell.row}`),
    };
  });
  const anchors = request.settlementAnchors.filter((anchor) => !occupied.has(`${anchor.col}:${anchor.row}`));
  return {
    ...request,
    ...(preview.biome === "ethereal" ? { flatSurface: true } : {}),
    cells: localMode ? cells.map(resolveSettlementLandCell) : cells,
    halo:
      preview.biome === "ethereal"
        ? request.halo.map((cell) => ({
            ...cell,
            biome: cell.explored ? BiomeType.Bare : null,
            previewBiome: BiomeType.Bare,
          }))
        : request.halo,
    settlementAnchors: [
      ...anchors,
      ...structures.flatMap(({ col, row, path }) => {
        const structureType = resolveTerrainLabStructureType(path);
        return structureType === undefined
          ? []
          : [
              {
                col,
                row,
                level: 1,
                structureId: `lab-building:${col}:${row}`,
                structureType,
              },
            ];
      }),
    ],
  };
}
