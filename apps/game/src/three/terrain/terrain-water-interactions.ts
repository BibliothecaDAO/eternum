import {
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import * as ThreeWebGPU from "three/webgpu";
import { attribute, color, mix, smoothstep, time, uniform, uv } from "three/tsl";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import type MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";

import { TERRAIN_WATER_LEVEL } from "./terrain-water";

export const TERRAIN_WATER_INTERACTION_CAPACITY = 256;

export interface TerrainWaterInteraction {
  entityId: number;
  isMoving: boolean;
  worldX: number;
  worldZ: number;
  yaw: number;
}

export interface TerrainWaterInteractionStats {
  instances: number;
  triangles: number;
  wakes: number;
}

const WATER_INTERACTION_ATTRIBUTE = "terrainWaterInteraction";
const WATER_INTERACTION_Y = TERRAIN_WATER_LEVEL + 0.012;
const MeshBasicNodeMaterialConstructor = (
  ThreeWebGPU as unknown as { MeshBasicNodeMaterial: new () => MeshBasicNodeMaterial }
).MeshBasicNodeMaterial;

export class TerrainWaterInteractionPool {
  readonly object3d = new Group();
  private readonly geometry = createTerrainWaterInteractionGeometry();
  private readonly strength = uniform(1, "float");
  private readonly material = createTerrainWaterInteractionMaterial(this.strength);
  private readonly mesh = new InstancedMesh(this.geometry, this.material, TERRAIN_WATER_INTERACTION_CAPACITY);
  private readonly interactionAttribute = new InstancedBufferAttribute(
    new Float32Array(TERRAIN_WATER_INTERACTION_CAPACITY * 2),
    2,
  );
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private strengthValue = 1;
  private wakeCount = 0;

  constructor() {
    this.object3d.name = "terrain-water-interactions";
    this.mesh.name = "terrain-water-interaction-pool";
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.raycast = disableWaterInteractionRaycast;
    this.interactionAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute(WATER_INTERACTION_ATTRIBUTE, this.interactionAttribute);
    this.object3d.add(this.mesh);
  }

  update(interactions: readonly TerrainWaterInteraction[]): void {
    interactions.forEach(requireFiniteInteraction);
    const canonical = canonicalWaterInteractions(interactions);
    const count = Math.min(canonical.length, TERRAIN_WATER_INTERACTION_CAPACITY);
    this.wakeCount = 0;
    for (let index = 0; index < count; index += 1) {
      this.writeInteraction(canonical[index], index);
    }
    this.mesh.count = count;
    this.mesh.visible = count > 0 && this.strengthValue > 0;
    this.mesh.instanceMatrix.needsUpdate = count > 0;
    this.interactionAttribute.needsUpdate = count > 0;
  }

  setStrength(strength: number): void {
    this.strengthValue = clampUnit(strength);
    this.strength.value = this.strengthValue;
    this.mesh.visible = this.mesh.count > 0 && this.strengthValue > 0;
  }

  getStats(): TerrainWaterInteractionStats {
    if (!this.mesh.visible) return { instances: 0, triangles: 0, wakes: 0 };
    const trianglesPerInstance = (this.geometry.index?.count ?? this.geometry.getAttribute("position").count) / 3;
    return {
      instances: this.mesh.count,
      triangles: trianglesPerInstance * this.mesh.count,
      wakes: this.wakeCount,
    };
  }

  dispose(): void {
    this.object3d.clear();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private writeInteraction(interaction: TerrainWaterInteraction, index: number): void {
    const mode = interaction.isMoving ? 1 : 0;
    const forwardX = Math.sin(interaction.yaw);
    const forwardZ = Math.cos(interaction.yaw);
    const wakeOffset = interaction.isMoving ? 0.62 : 0;
    this.position.set(
      interaction.worldX - forwardX * wakeOffset,
      WATER_INTERACTION_Y,
      interaction.worldZ - forwardZ * wakeOffset,
    );
    this.quaternion.setFromAxisAngle(this.up, interaction.yaw);
    this.scale.set(interaction.isMoving ? 0.68 : 0.72, 1, interaction.isMoving ? 1.7 : 0.72);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
    this.interactionAttribute.setXY(index, mode, interactionPhase(interaction.entityId));
    this.wakeCount += mode;
  }
}

function canonicalWaterInteractions(
  interactions: readonly TerrainWaterInteraction[],
): readonly TerrainWaterInteraction[] {
  for (let index = 1; index < interactions.length; index += 1) {
    if (interactions[index - 1].entityId > interactions[index].entityId) {
      return interactions.toSorted((left, right) => left.entityId - right.entityId);
    }
  }
  return interactions;
}

function createTerrainWaterInteractionGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(1, 1, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.name = "terrain-water-interaction-geometry";
  return geometry;
}

function createTerrainWaterInteractionMaterial(strength: UniformNode<"float", number>): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterialConstructor();
  material.name = "terrain-water-interactions";
  material.transparent = true;
  material.depthWrite = false;
  material.alphaTest = 0.015;
  const interaction = attribute<"vec2">(WATER_INTERACTION_ATTRIBUTE, "vec2").clamp(0, 1);
  const mode = interaction.x;
  const coordinates = uv().sub(0.5).mul(2);
  const cycle = time.mul(0.24).add(interaction.y).fract();
  const rippleRadius = cycle.mul(0.65).add(0.2);
  const rippleDistance = coordinates.length().sub(rippleRadius).abs();
  const ripple = smoothstep(0.025, 0.11, rippleDistance)
    .oneMinus()
    .mul(cycle.oneMinus())
    .mul(smoothstep(0.72, 1, coordinates.length()).oneMinus());

  const wakeTarget = uv().y.mul(0.32).add(0.08);
  const wakeDistance = coordinates.x.abs().sub(wakeTarget).abs();
  const wakeLines = smoothstep(0.035, 0.13, wakeDistance).oneMinus();
  const wakeCenter = smoothstep(0.08, 0.36, coordinates.x.abs()).oneMinus().mul(0.24);
  const wakeTrail = uv().y.oneMinus();
  const wakeLength = smoothstep(0.02, 0.28, wakeTrail).mul(wakeTrail);
  const breakup = coordinates.x.mul(8.2).add(coordinates.y.mul(4.7)).add(time.mul(1.15)).sin().mul(0.18).add(0.82);
  const wake = wakeLines.add(wakeCenter).mul(wakeLength).mul(breakup);

  const opacity = mix(ripple.mul(0.34), wake.mul(0.62), mode).mul(strength).clamp(0, 0.72);
  material.colorNode = mix(color("#a8d5d0"), color("#eef2e7"), mode.mul(0.55));
  material.opacityNode = opacity;
  return material;
}

function interactionPhase(entityId: number): number {
  const value = Math.sin(entityId * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

function requireFiniteInteraction(interaction: TerrainWaterInteraction): void {
  if (
    !Number.isFinite(interaction.entityId) ||
    !Number.isFinite(interaction.worldX) ||
    !Number.isFinite(interaction.worldZ) ||
    !Number.isFinite(interaction.yaw)
  ) {
    throw new Error(`Terrain water interaction requires finite values: ${JSON.stringify(interaction)}`);
  }
}

function disableWaterInteractionRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
