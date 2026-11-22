import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, type AspectId } from "@bibliothecadao/types";
import { Matrix4, Vector3 } from "three";

import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import { HYPERSTRUCTURE_MODEL_PATH } from "@/three/structures/hyperstructure-design";
import { HyperstructureModel } from "@/three/structures/hyperstructure-model";
import { resolveStructureRotationY } from "@/three/structures/structure-orientation";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";

export interface RaceTowerEntry {
  aspectId: AspectId;
  height: number;
  finished: boolean;
}

export const ASPECT_HYPERSTRUCTURE_SEEDS = {
  1: 1,
  2: 2,
  3: 4,
  4: 23,
} as const satisfies Record<AspectId, number>;

export const RACE_TOWER_HEXES = [
  { col: 4, row: 4 },
  { col: 6, row: 4 },
  { col: 8, row: 4 },
  { col: 10, row: 4 },
] as const;

const COLUMNS = 15;
const ROWS = 9;

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
  if (row >= 3 && row <= 5 && col >= 2 && col <= 12) return BiomeType.TemperateDesert;
  return (col + row) % 3 === 0 ? BiomeType.Shrubland : BiomeType.SubtropicalDesert;
}

export class AspectRaceStage implements LabStage {
  readonly request = createAspectRaceTerrainRequest();
  private context: LabStageContext | null = null;
  private hyperstructures: HyperstructureModel | null = null;
  private entries: readonly RaceTowerEntry[];
  private finishHeight: number;
  private lastAspect = 0;
  private disposed = false;

  constructor(entries: readonly RaceTowerEntry[], finishHeight: number) {
    this.entries = entries;
    this.finishHeight = finishHeight;
  }

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    const { scene, compile, camera, controls } = context;
    const model = new HyperstructureModel(RACE_TOWER_HEXES.length);
    await compile(model.group, scene);
    if (this.disposed) {
      model.dispose();
      return;
    }
    scene.add(model.group);
    this.hyperstructures = model;
    this.applyEntries();
    this.frameCamera(camera, controls);
  }

  setStandings(entries: readonly RaceTowerEntry[], finishHeight: number): void {
    this.entries = entries;
    this.finishHeight = finishHeight;
    if (this.hyperstructures && this.context) this.applyEntries();
  }

  update(delta: number): void {
    this.hyperstructures?.updateAnimations(delta);
    if (this.context && Math.abs(this.context.camera.aspect - this.lastAspect) > 0.01) {
      this.frameCamera(this.context.camera, this.context.controls);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.hyperstructures?.group.removeFromParent();
    this.hyperstructures?.dispose();
    this.hyperstructures = null;
    this.context = null;
  }

  private applyEntries(): void {
    const model = this.hyperstructures;
    const context = this.context;
    if (!model || !context) return;
    const count = Math.min(this.entries.length, RACE_TOWER_HEXES.length);
    model.setCount(count);
    const yaw = resolveStructureRotationY([HYPERSTRUCTURE_MODEL_PATH], 0);
    for (let index = 0; index < count; index += 1) {
      const entry = this.entries[index]!;
      const hex = RACE_TOWER_HEXES[index]!;
      const { x, z } = terrainHexToWorld(hex.col, hex.row);
      const y = context.terrain.sampleSurface(x, z).height;
      model.setMatrixAt(index, new Matrix4().makeRotationY(yaw).setPosition(x, y, z));
      const progress =
        this.finishHeight > 0 ? Math.max(0, Math.min(100, Math.round((entry.height / this.finishHeight) * 100))) : 0;
      model.setConstructionAt(index, {
        entityId: ASPECT_HYPERSTRUCTURE_SEEDS[entry.aspectId],
        progress,
        completed: entry.finished || (this.finishHeight > 0 && entry.height >= this.finishHeight),
      });
    }
  }

  private frameCamera(camera: LabStageContext["camera"], controls: LabStageContext["controls"]): void {
    const first = terrainHexToWorld(RACE_TOWER_HEXES[0].col, RACE_TOWER_HEXES[0].row);
    const last = terrainHexToWorld(
      RACE_TOWER_HEXES[RACE_TOWER_HEXES.length - 1].col,
      RACE_TOWER_HEXES[RACE_TOWER_HEXES.length - 1].row,
    );
    const center = new Vector3((first.x + last.x) / 2, 1.25, (first.z + last.z) / 2);
    const aspect = Math.max(camera.aspect, 1);
    this.lastAspect = camera.aspect;
    if (camera.fov !== 30) {
      camera.fov = 30;
      camera.updateProjectionMatrix();
    }
    const halfFovRad = (camera.fov * Math.PI) / 360;
    const idealHorizSpan = Math.abs(last.x - first.x) / 0.75;
    const vertSpan = Math.max(4.4, idealHorizSpan / aspect);
    const distance = vertSpan / (2 * Math.tan(halfFovRad));
    camera.position.set(center.x, center.y + distance * 0.42, center.z + distance * 0.91);
    controls.target.copy(center);
    controls.enabled = false;
    camera.lookAt(center);
    controls.update();
  }
}
