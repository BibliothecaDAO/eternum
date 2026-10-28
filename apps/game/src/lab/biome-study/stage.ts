import { StructureType } from "@bibliothecadao/types";
import { Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3, type Material } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { buildArmyModelAssetPath } from "@/three/constants/army-constants";
import { getStructureModelPaths } from "@/three/constants/scene-constants";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import InstancedModel from "@/three/managers/instanced-model";
import {
  TERRAIN_HEX_HORIZONTAL_SPACING,
  TERRAIN_HEX_VERTICAL_SPACING,
  terrainHexToWorld,
} from "@/three/terrain/terrain-coordinates";
import { TERRAIN_DEEP_FOG_COLOR } from "@/three/terrain/terrain-fog-style";
import { createAllBiomesTerrainRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import { ModelType } from "@/three/types/army";
import { getArmyGroundOffset, groundModelMatrix } from "@/three/utils/model-grounding";
import { gltfLoader } from "@/three/utils/utils";

import { createGroundMaterial, createWaterMaterial, type GroundStyle } from "./ground-material";
import { buildContinuousLand, buildTerracedLand, type StudyLand } from "./land";
import { StudyField, WATER_LEVEL } from "./world-field";

/** The approaches the study compares, today's terrain first. */
export const BIOME_APPROACHES = {
  today: "Today",
  relief: "A · Relief",
  painted: "B · Painted ground",
  terraced: "C · Terraced tiles",
  recommended: "A+B · Relief and painted ground",
} as const;
export type BiomeApproach = keyof typeof BIOME_APPROACHES;

/** Where the camera looks, at the game's own zoom and pitch (worldmap-camera-view-profile). */
export const BIOME_SHOTS = {
  overview: { label: "Every biome", col: 9.5, row: 7.5, distance: 45, pitch: 58 },
  play: { label: "Play zoom", col: 10, row: 7.5, distance: 20, pitch: 52 },
  army: { label: "Closest: army in forest", col: 7, row: 9, distance: 10, pitch: 42 },
  realm: { label: "Closest: realm on grass", col: 12, row: 6, distance: 10, pitch: 42 },
  coast: { label: "Closest: coast", col: 10, row: 2, distance: 10, pitch: 42 },
  tropics: { label: "Closest: tropics", col: 4, row: 5, distance: 10, pitch: 42 },
  desert: { label: "Closest: deserts", col: 16, row: 3, distance: 10, pitch: 42 },
  highlands: { label: "Closest: shrub, bare, taiga", col: 9, row: 11, distance: 10, pitch: 42 },
  cold: { label: "Closest: tundra and snow", col: 9, row: 13.5, distance: 10, pitch: 42 },
  scorched: { label: "Closest: snow and scorched", col: 15, row: 13.5, distance: 10, pitch: 42 },
} as const;
export type BiomeShot = keyof typeof BIOME_SHOTS;

const REALM_TILE = { col: 12, row: 6 };
const ARMY_TILE = { col: 7, row: 9 };
const STUDY_FOV = 38;

/**
 * The biome study on the lab's World biomes field: today's terrain, or one of the study's lands drawn from the same
 * field, with the same army and realm standing on it and the camera on one of the game's zoom levels.
 */
export class BiomeStudyStage implements LabStage {
  readonly request = createAllBiomesTerrainRequest();
  private context: LabStageContext | null = null;
  private land: StudyLand | null = null;
  private readonly meshes: Mesh[] = [];
  private readonly models: InstancedModel[] = [];
  private army: InstancedModel | null = null;

  constructor(private readonly approach: BiomeApproach) {}

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    if (this.approach !== "today") {
      context.terrain.object3d.visible = false;
      this.land = this.buildLand();
      await this.presentLand(context);
    }
    await this.placeRealmAndArmy(context);
    this.look("play");
  }

  /** What the land costs to draw: its vertices and triangles, ground and water. */
  landStats(): { vertices: number; triangles: number } | null {
    if (!this.land) return null;
    const geometries = [this.land.ground, this.land.water].filter((geometry) => geometry !== null);
    return geometries.reduce(
      (sum, geometry) => ({
        vertices: sum.vertices + geometry.getAttribute("position").count,
        triangles:
          sum.triangles + (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3,
      }),
      { vertices: 0, triangles: 0 },
    );
  }

  update(delta: number): void {
    this.army?.updateAnimations(delta);
  }

  /** Puts the camera on a shot: its tile at the game's distance and pitch for that zoom. */
  look(shot: BiomeShot): void {
    const { camera, controls } = this.requireContext();
    const { col, row, distance, pitch } = BIOME_SHOTS[shot];
    const target = fractionalHexToWorld(col, row);
    const height = this.standHeight(Math.round(col), Math.round(row));
    const radians = (pitch * Math.PI) / 180;
    camera.fov = STUDY_FOV;
    camera.updateProjectionMatrix();
    controls.target.set(target.x, height, target.z);
    camera.position.set(target.x, height + Math.sin(radians) * distance, target.z + Math.cos(radians) * distance);
    controls.update();
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
    for (const model of this.models) model.dispose();
    this.context = null;
  }

  private buildLand(): StudyLand {
    const field = new StudyField(
      this.request.cells.flatMap((cell) => (cell.biome ? [{ biome: cell.biome, col: cell.col, row: cell.row }] : [])),
      this.request.climate,
    );
    switch (this.approach) {
      case "relief":
      case "recommended":
        return buildContinuousLand(field, { level: 1, detail: 1 });
      case "painted":
        return buildContinuousLand(field, { level: 0.3, detail: 0.12 });
      case "terraced":
        return buildTerracedLand(field);
      case "today":
        throw new Error("Today's terrain is the renderer's own");
    }
  }

  private groundStyle(): GroundStyle {
    return this.approach === "relief" ? "splat" : "painted";
  }

  private async presentLand({ scene, compile }: LabStageContext): Promise<void> {
    const land = this.requireLand();
    const seed = this.request.climate;
    // The game's climate seeds move every pattern, so two games never share a ground; one game always paints the same.
    const offset = [((seed.elevation_seed ?? 0) % 997) * 1.37, ((seed.moisture_seed ?? 0) % 991) * 1.13] as const;
    const ground = new Mesh(land.ground, createGroundMaterial(this.groundStyle(), offset));
    ground.receiveShadow = true;
    ground.castShadow = this.approach !== "painted";
    this.meshes.push(ground);
    if (land.water) {
      const water = new Mesh(land.water, createWaterMaterial());
      water.receiveShadow = true;
      this.meshes.push(water);
    }
    this.meshes.push(createUnexploredGround());
    for (const mesh of this.meshes) {
      await compile(mesh, scene);
      scene.add(mesh);
    }
  }

  private async placeRealmAndArmy({ scene, compile }: LabStageContext): Promise<void> {
    const [realmGltf, armyGltf] = await Promise.all([
      gltfLoader.loadAsync(getStructureModelPaths()[StructureType.Realm][0]),
      gltfLoader.loadAsync(buildArmyModelAssetPath(ModelType.Knight2)),
    ]);
    const realm = new InstancedModel(realmGltf, 1, false, "Realm");
    const army = new InstancedModel(armyGltf, 1, false, "Army");
    this.standOn(realm, REALM_TILE, 0, 0.02);
    this.standOn(army, ARMY_TILE, getArmyGroundOffset(army.instancedMeshes, ModelType.Knight2), 0);
    for (const model of [realm, army]) {
      await compile(model.group, scene);
      scene.add(model.group);
      this.models.push(model);
    }
    this.army = army;
  }

  private standOn(model: InstancedModel, tile: { col: number; row: number }, groundOffset: number, lift: number): void {
    const center = terrainHexToWorld(tile.col, tile.row);
    const height = this.standHeight(tile.col, tile.row) + lift;
    const matrix = new Matrix4().compose(
      new Vector3(center.x, height, center.z),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 0.85),
      new Vector3(1, 1, 1),
    );
    groundModelMatrix(matrix, groundOffset);
    model.setMatrixAt(0, matrix, height);
    model.setCount(1);
    model.needsUpdate();
  }

  private standHeight(col: number, row: number): number {
    if (this.land) return this.land.standHeight(col, row);
    const center = terrainHexToWorld(col, row);
    return this.requireContext().terrain.sampleSurface(center.x, center.z).height;
  }

  private requireContext(): LabStageContext {
    if (!this.context) throw new Error("The biome study is not prepared");
    return this.context;
  }

  private requireLand(): StudyLand {
    if (!this.land) throw new Error("The biome study has no land");
    return this.land;
  }
}

/** A shot may aim between tiles: step from the lower tile by the lattice's spacing. */
function fractionalHexToWorld(col: number, row: number): { x: number; z: number } {
  const anchor = terrainHexToWorld(Math.floor(col), Math.floor(row));
  return {
    x: anchor.x + (col - Math.floor(col)) * TERRAIN_HEX_HORIZONTAL_SPACING,
    z: anchor.z + (row - Math.floor(row)) * TERRAIN_HEX_VERTICAL_SPACING,
  };
}

/** The unexplored world around the field, as dark as today's deep fog, so every approach is judged on the same ground. */
function createUnexploredGround(): Mesh {
  const material = new MeshStandardNodeMaterial({ color: TERRAIN_DEEP_FOG_COLOR, roughness: 1, metalness: 0 });
  material.name = "biome-study-unexplored";
  const ground = new Mesh(new PlaneGeometry(400, 400), material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(17, WATER_LEVEL - 0.45, 12);
  ground.receiveShadow = true;
  return ground;
}
