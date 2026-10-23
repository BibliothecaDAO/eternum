import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  color,
  float,
  instanceIndex,
  mix,
  mx_noise_float,
  positionGeometry,
  positionLocal,
  positionWorld,
  smoothstep,
  uv,
  vec3,
} from "three/tsl";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import InstancedModel from "../managers/instanced-model";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { mapAnimationTime as time } from "../effects/endgame/state";
import { createInstancedMeshWithSharedMatrices } from "../utils/create-instanced-mesh";
import { MaterialPool } from "../utils/material-pool";
import { FALLEN_REALM_RUIN_PATH, FRONTIER_BEASTS, type FrontierSpecies } from "./frontier-beast";
import { frontierPaintedPath } from "./frontier-painted-buildings";

export function frontierModelKind(path: string) {
  if (path === FALLEN_REALM_RUIN_PATH || path === frontierPaintedPath("fallen-realm-ruin")) return "ruin";
  return (Object.keys(FRONTIER_BEASTS) as FrontierSpecies[]).find((species) => FRONTIER_BEASTS[species].path === path);
}

/** GPU motion and one mist draw per ruin batch, shared by the map and its lab. */
export class FrontierModel extends InstancedModel {
  private readonly mist?: InstancedMesh;
  private readonly animatedGeometry: BufferGeometry[] = [];
  private readonly idleMaterials: {
    material: FrostedStandardNodeMaterial;
    motion: FrostedStandardNodeMaterial["positionNode"];
  }[] = [];
  private disposed = false;

  constructor(gltf: GLTF, capacity: number, kind: "ruin" | FrontierSpecies) {
    super(gltf, capacity, false, kind, "cache");
    if (kind === "ruin") {
      this.mist = createInstancedMeshWithSharedMatrices(mistGeometry(), mistMaterial(), this.instancedMeshes[0]);
      this.mist.name = "Ruin ground mist";
      this.mist.frustumCulled = false;
      this.mist.castShadow = false;
      this.mist.raycast = () => {};
      this.mist.renderOrder = 11;
      this.group.add(this.mist);
    } else {
      for (const mesh of this.instancedMeshes) {
        const previous = mesh.material as MeshStandardMaterial;
        const material = beastMaterial(previous, kind);
        mesh.material = material;
        this.idleMaterials.push({ material, motion: material.positionNode });
        MaterialPool.getInstance().releaseMaterial(previous);
        mesh.geometry = mesh.geometry.clone();
        this.animatedGeometry.push(mesh.geometry);
        mesh.geometry.computeBoundingBox();
        mesh.geometry.boundingBox!.expandByScalar(kind === "dark-fey" ? 0.14 : 0.035);
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.boundingSphere!.radius += kind === "dark-fey" ? 0.14 : 0.035;
      }
    }
  }

  override setCount(count: number): void {
    super.setCount(count);
    if (this.mist) this.mist.count = this.instancedMeshes[0].count;
  }

  setMistVisible(visible: boolean): void {
    if (this.mist) this.mist.visible = visible;
  }

  /** The lab compares the real animated shader with a shader that has no idle displacement. */
  setBeastMotionEnabled(enabled: boolean): void {
    for (const { material, motion } of this.idleMaterials) {
      const position = enabled ? motion : null;
      if (material.positionNode === position) continue;
      material.positionNode = position;
      material.needsUpdate = true;
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.mist) {
      this.mist.removeFromParent();
      this.mist.geometry.dispose();
      (this.mist.material as MeshBasicNodeMaterial).dispose();
      this.mist.dispose();
    }
    this.animatedGeometry.forEach((geometry) => geometry.dispose());
    super.dispose();
  }
}

function beastMaterial(source: MeshStandardMaterial, species: FrontierSpecies) {
  const material = new FrostedStandardNodeMaterial();
  material.color.copy(source.color);
  material.map = source.map;
  material.normalMap = source.normalMap;
  material.normalScale.copy(source.normalScale);
  material.roughness = source.roughness;
  material.metalness = source.metalness;
  material.side = source.side;
  material.positionNode = positionLocal.add(vec3(0, species === "dark-fey" ? feyIdle() : beastIdle(species), 0));
  return material;
}

const phase = float(instanceIndex).mul(2.399963);

/** Feet stay planted and the horizontal silhouette stays inside its checked ruin clearance. */
function beastIdle(species: Exclude<FrontierSpecies, "dark-fey">) {
  const rhythms = {
    cyclops: [1.5, 0.016],
    troll: [1.1, 0.014],
    ammit: [1.4, 0.01],
    basilisk: [1.3, 0.014],
    wyvern: [1.0, 0.018],
    hydra: [0.9, 0.018],
    wraith: [1.2, 0.028],
  } as const;
  const [speed, lift] = rhythms[species];
  const breath = time
    .mul(speed)
    .add(phase)
    .add(positionGeometry.x.mul(0.8))
    .sin()
    .add(1)
    .mul(lift / 2);
  return species === "wraith" ? breath : breath.mul(smoothstep(0.08, 0.45, positionGeometry.y));
}

function feyIdle() {
  const wing = smoothstep(0.065, 0.18, positionGeometry.x.abs()).mul(
    smoothstep(-0.045, -0.005, positionGeometry.z).oneMinus(),
  );
  const radius = positionGeometry.x.abs().sub(0.052).max(0);
  const flap = time.mul(4.2).add(phase).sin().mul(radius).mul(0.16).mul(wing);
  const hover = time.mul(1.7).add(phase).sin().mul(0.026);
  return hover.add(flap);
}

function mistMaterial() {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    forceSinglePass: true,
  });
  const drift = vec3(time.mul(0.045), 0, time.mul(-0.029));
  const billow = mx_noise_float(positionWorld.mul(3.8).add(drift)).mul(0.5).add(0.5);
  const detail = mx_noise_float(positionWorld.mul(8).sub(drift.mul(1.3)))
    .mul(0.5)
    .add(0.5);
  const edge = smoothstep(0.23, 0.5, uv().sub(0.5).length()).oneMinus();
  material.colorNode = mix(color(new Color(0x7d9891)), color(new Color(0xd5ded0)), billow);
  material.opacityNode = edge.mul(smoothstep(0.18, 0.77, billow.mul(0.75).add(detail.mul(0.25)))).mul(0.32);
  return material;
}

function mistGeometry() {
  const points: number[] = [],
    coords: number[] = [],
    indices: number[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const start = points.length / 3;
    const radius = 0.82 - layer * 0.06;
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      points.push(x * radius, 0.055 + layer * 0.065, z * radius);
      coords.push((x + 1) / 2, (z + 1) / 2);
    }
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(coords, 2));
  geometry.setIndex(indices);
  return geometry;
}
