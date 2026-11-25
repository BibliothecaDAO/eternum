import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, type AspectId, type HexPosition } from "@bibliothecadao/types";
import { type PerspectiveCamera, Vector3 } from "three";

import { latticeToWorld } from "@/three/utils/hex-lattice";
import { worldOrigin } from "@/three/world-origin";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import { buildWorldmapTerrainPageRequests } from "@/three/terrain/worldmap-procedural-terrain";

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
  { col: 19, row: 12 },
  { col: 21, row: 12 },
  { col: 23, row: 12 },
  { col: 25, row: 12 },
] as const;

export const RACE_DAYLIGHT_PROGRESS = 54;

const COLUMNS = 45;
const ROWS = 20;
const PAGE_COLUMNS = 15;
const PAGE_ROWS = 10;
const TOWER_ROW = RACE_TOWER_HEXES[0].row;
const TOWER_MIN_COL = RACE_TOWER_HEXES[0].col;
const TOWER_MAX_COL = RACE_TOWER_HEXES[RACE_TOWER_HEXES.length - 1].col;
const CAMERA_FOV = 30;
const CAMERA_PITCH_RAD = (38 * Math.PI) / 180;
const CAMERA_PITCH_SIN = Math.sin(CAMERA_PITCH_RAD);
const CAMERA_PITCH_COS = Math.cos(CAMERA_PITCH_RAD);
const MIN_VERTICAL_SPAN = 5.6;
const TOWER_TARGET_Y = 1.35;
const PLATE_Z_OFFSET = 1.05;

export function createAspectRaceTerrainRequests(origin: HexPosition = worldOrigin()): TerrainPageRequest[] {
  const towerCells = new Set(RACE_TOWER_HEXES.map(({ col, row }) => `${col}:${row}`));
  const sightlineCells = new Set(RACE_TOWER_HEXES.map(({ col, row }) => `${col}:${row + 1}`));
  const cells = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const key = `${col}:${row}`;
    return {
      biomeKey: raceBiomeAt(col, row),
      col: col + origin.col,
      occupied: towerCells.has(key) || sightlineCells.has(key),
      row: row + origin.row,
    };
  });
  return buildWorldmapTerrainPageRequests({
    cells,
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    mapCenter: 0,
    pageHeight: PAGE_ROWS,
    pageOrigin: { col: origin.col, row: origin.row },
    pageWidth: PAGE_COLUMNS,
    subdivisions: 3,
  });
}

function raceBiomeAt(col: number, row: number): BiomeType {
  const inHeroCorridor = col >= TOWER_MIN_COL - 1 && col <= TOWER_MAX_COL + 1;
  if (inHeroCorridor && row >= TOWER_ROW - 1 && row <= TOWER_ROW + 2) {
    return BiomeType.Grassland;
  }
  const wave = Math.sin(col * 0.42 + row * 0.27) + Math.cos(col * 0.19 - row * 0.51);
  if (row >= TOWER_ROW) {
    if (col < TOWER_MIN_COL - 3 || col > TOWER_MAX_COL + 3) {
      if (wave > 0.65) return BiomeType.TemperateDeciduousForest;
      return wave < -0.55 ? BiomeType.Shrubland : BiomeType.Grassland;
    }
    return wave < -0.45 ? BiomeType.Shrubland : BiomeType.Grassland;
  }
  if (row <= 4) {
    if (wave > 0.55) return BiomeType.Taiga;
    if (wave > -0.15) return BiomeType.TemperateDeciduousForest;
    return wave < -0.95 ? BiomeType.Shrubland : BiomeType.Grassland;
  }
  if (wave > 0.75) return BiomeType.TemperateDeciduousForest;
  if (wave < -0.85) return BiomeType.Shrubland;
  return BiomeType.Grassland;
}

export function frameAspectRaceCamera(camera: PerspectiveCamera): Vector3 {
  const first = latticeToWorld(RACE_TOWER_HEXES[0].col, RACE_TOWER_HEXES[0].row);
  const last = latticeToWorld(
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
  const idealHorizSpan = Math.abs(last.x - first.x) / 0.78;
  const vertSpan = Math.max(MIN_VERTICAL_SPAN, idealHorizSpan / aspect);
  const distance = vertSpan / (2 * Math.tan(halfFovRad));
  camera.position.set(center.x, center.y + distance * CAMERA_PITCH_SIN, center.z + distance * CAMERA_PITCH_COS);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  return center;
}

export function projectRacePlateAnchors(
  camera: PerspectiveCamera,
  entries: readonly RaceTowerEntry[],
  towerHeights: readonly number[],
): TowerPlateAnchor[] {
  const count = Math.min(entries.length, RACE_TOWER_HEXES.length);
  const point = new Vector3();
  const anchors: TowerPlateAnchor[] = [];
  for (let index = 0; index < count; index += 1) {
    const entry = entries[index]!;
    const hex = RACE_TOWER_HEXES[index]!;
    const { x, z } = latticeToWorld(hex.col, hex.row);
    const y = towerHeights[index] ?? 0;
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
