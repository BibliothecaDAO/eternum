import { ChestModelPath } from "@/three/constants/scene-constants";
import { StructureType } from "@bibliothecadao/types";
import type { TerrainLabBuilding } from "./terrain-lab-buildings";
import type { BiomeType } from "@bibliothecadao/types";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import type { ModelType } from "@/three/types/army";

export interface TerrainLabPreview {
  biome: BiomeType | "fixture";
  fog: "fixture" | "clear" | "frontier" | "covered";
  selection: boolean;
  grid: boolean;
  army: ModelType | "none";
  spin: boolean;
  yaw: number;
}

export const DEFAULT_TERRAIN_LAB_PREVIEW: TerrainLabPreview = {
  biome: "fixture",
  fog: "fixture",
  selection: true,
  grid: false,
  army: "none",
  spin: false,
  yaw: 0,
};

export function buildTerrainLabRequest(
  request: TerrainPageRequest,
  preview: TerrainLabPreview,
  selected: { col: number; row: number },
  buildings: readonly TerrainLabBuilding[] = [],
): TerrainPageRequest {
  const structures = buildings.filter((building) => building.path !== ChestModelPath);
  const occupied = new Set(structures.map((building) => `${building.col}:${building.row}`));
  const cells = request.cells.map((cell) => {
    const explored =
      preview.fog === "fixture"
        ? cell.explored
        : preview.fog === "clear" || (preview.fog === "frontier" && cell.col <= selected.col);
    const biome = preview.biome === "fixture" ? (cell.biome ?? cell.previewBiome) : preview.biome;
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
    cells,
    settlementAnchors: [
      ...anchors,
      ...structures.map(({ col, row }) => ({
        col,
        row,
        level: 1,
        structureId: `lab-building:${col}:${row}`,
        structureType: StructureType.Village,
      })),
    ],
  };
}
