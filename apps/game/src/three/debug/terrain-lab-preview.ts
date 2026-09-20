import type { SettlementRelationship } from "@/three/structures/settlement-appearance";
import { ChestModelPath, SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import type { BiomeType } from "@bibliothecadao/types";
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
  const spires = new Set(
    structures
      .filter((building) => building.path === SPIRE_MODEL_PATH)
      .map((building) => `${building.col}:${building.row}`),
  );
  const cells = request.cells.map((cell) => {
    const explored =
      preview.fog === "fixture"
        ? cell.explored
        : preview.fog === "clear" || (preview.fog === "frontier" && cell.col <= selected.col);
    // Ethereal changes presentation; retain fixture biomes for gameplay and exploration diagnostics.
    const biome =
      preview.biome === "fixture" || preview.biome === "ethereal" ? (cell.biome ?? cell.previewBiome) : preview.biome;
    if (explored && biome === null) throw new Error(`Lab tile ${cell.col},${cell.row} has no biome to reveal`);
    return {
      ...cell,
      biome: explored ? biome : null,
      previewBiome: biome,
      explored,
      occupied: cell.occupied || occupied.has(`${cell.col}:${cell.row}`),
      ...(spires.has(`${cell.col}:${cell.row}`) ? { surfacePresentation: "ethereal" as const } : {}),
    };
  });
  const anchors = request.settlementAnchors.filter((anchor) => !occupied.has(`${anchor.col}:${anchor.row}`));
  return {
    ...request,
    surfacePresentation: preview.biome === "ethereal" ? "ethereal" : "world",
    cells:
      localMode && preview.biome !== "ethereal"
        ? cells.map((cell) => (cell.surfacePresentation === "ethereal" ? cell : resolveSettlementLandCell(cell)))
        : cells,
    halo: request.halo.map((cell) =>
      spires.has(`${cell.col}:${cell.row}`)
        ? { ...cell, occupied: true, surfacePresentation: "ethereal" as const }
        : cell,
    ),
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
