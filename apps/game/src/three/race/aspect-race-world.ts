import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, type AspectId } from "@bibliothecadao/types";
import { type PerspectiveCamera, Vector3 } from "three";

import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";

export interface RaceTowerEntry {
  aspectId: AspectId;
  height: number;
  finished: boolean;
}

export interface TowerPlateAnchor {
  aspectId: AspectId;
  leftPercent: number;
  topPercent: number;
}

export const ASPECT_HYPERSTRUCTURE_SEEDS = {
  1: 1,
  2: 2,
  3: 4,
  4: 23,
} as const satisfies Record<AspectId, number>;

export const RACE_TOWER_HEXES = [
  { col: 8, row: 5 },
  { col: 10, row: 5 },
  { col: 12, row: 5 },
  { col: 14, row: 5 },
] as const;

export const RACE_DAYLIGHT_PROGRESS = 54;

const COLUMNS = 23;
const ROWS = 11;
const CAMERA_FOV = 30;
const TOWER_TARGET_Y = 1.75;
const PLATE_Z_OFFSET = 1.15;

export function createAspectRaceTerrainRequest(): TerrainPageRequest {
  const occupied = new Set(RACE_TOWER_HEXES.map(({ col, row }) => `${col}:${row}`));
  const cells: TerrainCellInput[] = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const biome = raceBiomeAt(col, row);
    return {
      col,
      row,
      biome,
      previewBiome: biome,
      explored: true,
      occupied: occupied.has(`${col}:${row}`),
    };
  });
  return {
    cells,
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    halo: [],
    mapCenter: 0,
    pageKey: "aspect-race-stage",
    roadSegments: [],
    settlementAnchors: [],
    strictBiomeParity: false,
    subdivisions: 3,
  };
}

function raceBiomeAt(col: number, row: number): BiomeType {
  if (row >= 4 && row <= 6 && col >= 5 && col <= 17) return BiomeType.TemperateDesert;
  if (row <= 2) return (col + row) % 3 === 0 ? BiomeType.TemperateDeciduousForest : BiomeType.Grassland;
  if (row >= 8) return (col + row) % 2 === 0 ? BiomeType.SubtropicalDesert : BiomeType.Shrubland;
  return (col + row) % 3 === 0 ? BiomeType.Shrubland : BiomeType.Grassland;
}

export function frameAspectRaceCamera(camera: PerspectiveCamera): Vector3 {
  const first = terrainHexToWorld(RACE_TOWER_HEXES[0].col, RACE_TOWER_HEXES[0].row);
  const last = terrainHexToWorld(
    RACE_TOWER_HEXES[RACE_TOWER_HEXES.length - 1].col,
    RACE_TOWER_HEXES[RACE_TOWER_HEXES.length - 1].row,
  );
  const center = new Vector3((first.x + last.x) / 2, TOWER_TARGET_Y, (first.z + last.z) / 2);
  if (camera.fov !== CAMERA_FOV) {
    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
  }
  const halfFovRad = (camera.fov * Math.PI) / 360;
  const aspect = Math.max(camera.aspect, 0.5);
  const idealHorizSpan = Math.abs(last.x - first.x) / 0.72;
  const vertSpan = Math.max(5.4, idealHorizSpan / aspect);
  const distance = vertSpan / (2 * Math.tan(halfFovRad));
  camera.position.set(center.x, center.y + distance * 0.26, center.z + distance * 0.96);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  return center;
}

export function projectRacePlateAnchors(
  camera: PerspectiveCamera,
  entries: readonly RaceTowerEntry[],
  sampleHeight: (x: number, z: number) => number,
): TowerPlateAnchor[] {
  const count = Math.min(entries.length, RACE_TOWER_HEXES.length);
  const point = new Vector3();
  const anchors: TowerPlateAnchor[] = [];
  for (let index = 0; index < count; index += 1) {
    const entry = entries[index]!;
    const hex = RACE_TOWER_HEXES[index]!;
    const { x, z } = terrainHexToWorld(hex.col, hex.row);
    const y = sampleHeight(x, z);
    point.set(x, y, z + PLATE_Z_OFFSET).project(camera);
    anchors.push({
      aspectId: entry.aspectId,
      leftPercent: clamp(((point.x + 1) / 2) * 100, 5, 95),
      topPercent: clamp(((1 - point.y) / 2) * 100, 58, 90),
    });
  }
  return anchors;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
