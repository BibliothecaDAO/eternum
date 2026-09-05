import { BiomeType } from "@bibliothecadao/types";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4 } from "three";
import { float, instanceIndex, positionGeometry, time, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

import { terrainHexToWorld } from "./terrain-coordinates";
import type { TerrainField } from "./terrain-field";
import { hashTerrainCoordinates } from "./terrain-hash";
import type { TerrainCellInput } from "./terrain-types";

const FOREST_BIOMES = new Set([
  BiomeType.Taiga,
  BiomeType.TemperateDeciduousForest,
  BiomeType.TemperateRainForest,
  BiomeType.TropicalSeasonalForest,
  BiomeType.TropicalRainForest,
]);

/** One small flock per presented forest page; no simulation, interaction, or per-frame CPU uploads. */
export function createTerrainWildlife(
  cells: readonly TerrainCellInput[],
  field: TerrainField,
  material: MeshBasicNodeMaterial,
): InstancedMesh | null {
  const habitat = selectForestHabitat(cells);
  if (!habitat) return null;

  const center = terrainHexToWorld(habitat.col, habitat.row);
  const surface = field.sampleSurface(center.x, center.z);
  const flock = new InstancedMesh(createBirdGeometry(), material, 3);
  flock.name = "terrain-wildlife";
  // The orbit and wing tips fit inside the known habitat hex, including at fog borders.
  const origin = new Matrix4().makeTranslation(center.x, surface.height + 1.6, center.z);
  for (let index = 0; index < flock.count; index++) flock.setMatrixAt(index, origin);
  flock.instanceMatrix.needsUpdate = true;
  flock.frustumCulled = false;
  flock.raycast = () => {};
  return flock;
}

export function createTerrainWildlifeMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ color: "#303936", side: DoubleSide });
  material.name = "terrain-wildlife";
  const phase = time.mul(0.65).add(float(instanceIndex).mul((Math.PI * 2) / 3));
  const flap = time.mul(7).add(float(instanceIndex).mul(1.7)).sin();
  const wing = positionGeometry.x.abs().mul(flap).mul(0.7);
  const radius = float(0.38).add(positionGeometry.x);
  const forward = positionGeometry.z;
  material.positionNode = vec3(
    phase.cos().mul(radius).sub(phase.sin().mul(forward)),
    positionGeometry.y.add(wing).add(float(instanceIndex).mul(0.09)),
    phase.sin().mul(radius).add(phase.cos().mul(forward)),
  );
  return material;
}

function selectForestHabitat(cells: readonly TerrainCellInput[]): TerrainCellInput | undefined {
  return cells
    .filter((cell) => cell.explored && !cell.occupied && cell.biome !== null && FOREST_BIOMES.has(cell.biome))
    .map((cell) => ({ cell, priority: habitatPriority(cell) }))
    .toSorted(
      (left, right) =>
        left.priority - right.priority || left.cell.row - right.cell.row || left.cell.col - right.cell.col,
    )[0]?.cell;
}

function habitatPriority(cell: TerrainCellInput): number {
  return hashTerrainCoordinates({
    col: cell.col,
    row: cell.row,
    elevationSeed: 0,
    moistureSeed: 0,
    salt: "forest-birds",
  });
}

function createBirdGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0, -0.055, -0.11, 0.01, 0.018, 0, 0, 0.025, 0.11, 0.01, 0.018, 0, 0.01, -0.075, 0.022, 0, 0.02],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 2, 5]);
  return geometry;
}
