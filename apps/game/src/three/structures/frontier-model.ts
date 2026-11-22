import {
  AdditiveBlending,
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
} from "three";
import type { BeastIdle } from "@bibliothecadao/types";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  color,
  float,
  instanceIndex,
  mix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionLocal,
  positionViewDirection,
  positionWorld,
  select,
  smoothstep,
  uv,
  varying,
  vec3,
} from "three/tsl";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import brandPalette from "@/brand/palette.json";
import InstancedModel from "../managers/instanced-model";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { mapAnimationTime as time } from "../effects/endgame/state";
import { DEEP_PALETTE } from "../terrain/deep-floor-material";
import { createInstancedMeshWithSharedMatrices } from "../utils/create-instanced-mesh";
import { MaterialPool } from "../utils/material-pool";
import { FALLEN_REALM_RUIN_PATH, FRONTIER_BEASTS, type FrontierSpecies } from "./frontier-beast";
import { frontierPaintedPath } from "./frontier-painted-buildings";

export type BeastLayer = 0 | 1 | 2 | 3;

type LayerRamp = {
  readonly low: string;
  readonly mid: string;
  readonly hot: string;
  readonly rim: number;
  readonly embers: number;
};

const MIST_MATERIAL = brandPalette.games.frontier.materials[1];

const BEAST_LAYER_RAMPS = {
  0: { low: "#7a4c28", mid: "#d9924c", hot: "#fff1d0", rim: 0.08, embers: 0 },
  1: { low: "#1a5c72", mid: "#5fd2e6", hot: "#e8fdff", rim: 0.9, embers: 0.55 },
  2: { low: MIST_MATERIAL.shade.hex, mid: MIST_MATERIAL.light.hex, hot: "#f5ebff", rim: 1.05, embers: 0.72 },
  3: { low: "#8f5414", mid: DEEP_PALETTE.gold, hot: "#fff6d6", rim: 1.15, embers: 0.82 },
} as const satisfies Record<BeastLayer, LayerRamp>;

const EMBER_QUADS = 10;

export function frontierModelKind(path: string) {
  if (path === FALLEN_REALM_RUIN_PATH || path === frontierPaintedPath("fallen-realm-ruin")) return "ruin";
  return (Object.keys(FRONTIER_BEASTS) as FrontierSpecies[]).find((species) => FRONTIER_BEASTS[species].path === path);
}

/** GPU motion and one mist draw per ruin batch, shared by the map and its lab. */
export class FrontierModel extends InstancedModel {
  private readonly mist?: InstancedMesh;
  private readonly embers?: InstancedMesh;
  private readonly animatedGeometry: BufferGeometry[] = [];
  private readonly idle: InstancedBufferAttribute;
  private readonly layer: InstancedBufferAttribute;
  private disposed = false;

  constructor(gltf: GLTF, capacity: number, kind: "ruin" | FrontierSpecies) {
    super(gltf, capacity, false, kind, "cache");
    const slots = this.instancedMeshes[0].instanceMatrix.count;
    this.idle = new InstancedBufferAttribute(new Float32Array(slots * 3), 3);
    this.layer = new InstancedBufferAttribute(new Float32Array(slots), 1);
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
        const material = beastMaterial(previous);
        mesh.material = material;
        MaterialPool.getInstance().releaseMaterial(previous);
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.setAttribute("beastIdle", this.idle);
        mesh.geometry.setAttribute("beastLayer", this.layer);
        this.animatedGeometry.push(mesh.geometry);
        mesh.geometry.computeBoundingBox();
        mesh.geometry.boundingBox!.expandByScalar(kind === "dark-fey" ? 0.14 : 0.035);
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.boundingSphere!.radius += kind === "dark-fey" ? 0.14 : 0.035;
      }
      const bounds = new Box3().setFromObject(gltf.scene);
      this.embers = createInstancedMeshWithSharedMatrices(
        emberGeometry(bounds, this.layer),
        emberMaterial(),
        this.instancedMeshes[0],
      );
      this.embers.name = "Beast phoenix embers";
      this.embers.frustumCulled = false;
      this.embers.castShadow = false;
      this.embers.raycast = () => {};
      this.embers.renderOrder = 11;
      this.group.add(this.embers);
    }
  }

  setIdleAt(index: number, idle: BeastIdle): void {
    if (idle.motion === "hover") this.idle.setXYZ(index, IDLE_MOTIONS.hover, 0, 0);
    else this.idle.setXYZ(index, IDLE_MOTIONS[idle.motion], idle.speed, idle.height);
    this.idle.needsUpdate = true;
  }

  setLayerAt(index: number, layer: BeastLayer): void {
    this.layer.setX(index, layer);
    this.layer.needsUpdate = true;
  }

  override setCount(count: number): void {
    super.setCount(count);
    if (this.mist) this.mist.count = this.instancedMeshes[0].count;
    if (this.embers) this.embers.count = this.instancedMeshes[0].count;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const overlay of [this.mist, this.embers]) {
      if (!overlay) continue;
      overlay.removeFromParent();
      overlay.geometry.dispose();
      (overlay.material as MeshBasicNodeMaterial).dispose();
      overlay.dispose();
    }
    this.animatedGeometry.forEach((geometry) => geometry.dispose());
    super.dispose();
  }
}

function beastMaterial(source: MeshStandardMaterial) {
  const material = new FrostedStandardNodeMaterial();
  material.color.copy(source.color);
  material.map = source.map;
  material.normalMap = source.normalMap;
  material.normalScale.copy(source.normalScale);
  material.roughness = source.roughness;
  material.metalness = source.metalness;
  material.side = source.side;
  material.positionNode = positionLocal.add(vec3(0, beastIdle(), 0));
  material.emissiveNode = beastPhoenixGlow();
  return material;
}

const IDLE_MOTIONS = { breath: 0, lift: 1, hover: 2 } as const satisfies Record<BeastIdle["motion"], number>;

const phase = float(instanceIndex).mul(2.399963);

const beastLayerNode = () => varying(attribute<"float">("beastLayer", "float")).setInterpolation("flat");
type BeastLayerNode = ReturnType<typeof beastLayerNode>;

function selectLayerNumber(layer: BeastLayerNode, values: Record<BeastLayer, number>) {
  return select(
    layer.greaterThan(2.5),
    float(values[3]),
    select(
      layer.greaterThan(1.5),
      float(values[2]),
      select(layer.greaterThan(0.5), float(values[1]), float(values[0])),
    ),
  );
}

function layerColour(layer: BeastLayerNode, stop: "low" | "mid" | "hot") {
  return select(
    layer.greaterThan(2.5),
    color(new Color(BEAST_LAYER_RAMPS[3][stop])),
    select(
      layer.greaterThan(1.5),
      color(new Color(BEAST_LAYER_RAMPS[2][stop])),
      select(
        layer.greaterThan(0.5),
        color(new Color(BEAST_LAYER_RAMPS[1][stop])),
        color(new Color(BEAST_LAYER_RAMPS[0][stop])),
      ),
    ),
  );
}

function beastPhoenixGlow() {
  const layer = beastLayerNode();
  const rim = normalView.dot(positionViewDirection).abs().clamp(0, 1).oneMinus().pow(2.4);
  const flameSample = vec3(
    positionGeometry.x.mul(5.2),
    positionGeometry.y.mul(4.2).sub(time.mul(1.75)).add(phase),
    positionGeometry.z.mul(5.2),
  );
  const scrollNoise = mx_noise_float(flameSample).mul(0.5).add(0.5);
  const upper = smoothstep(0.05, 0.55, positionGeometry.y);
  const heat = rim.mul(scrollNoise.mul(0.55).add(0.55)).add(scrollNoise.mul(upper).mul(0.22)).clamp(0, 1);
  const lowToMid = mix(layerColour(layer, "low"), layerColour(layer, "mid"), smoothstep(0.08, 0.65, heat));
  const ramped = mix(lowToMid, layerColour(layer, "hot"), smoothstep(0.65, 0.98, heat));
  const strength = selectLayerNumber(layer, {
    0: BEAST_LAYER_RAMPS[0].rim,
    1: BEAST_LAYER_RAMPS[1].rim,
    2: BEAST_LAYER_RAMPS[2].rim,
    3: BEAST_LAYER_RAMPS[3].rim,
  });
  return ramped.mul(heat).mul(strength);
}

function emberMaterial() {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const layer = beastLayerNode();
  const seed = attribute<"float">("emberSeed", "float");
  const lift = attribute<"float">("emberLift", "float");
  const age = time.mul(0.32).add(seed).add(phase.mul(0.17)).fract();
  const sway = age
    .mul(Math.PI * 2)
    .add(seed.mul(12.5))
    .sin()
    .mul(0.045);
  material.positionNode = positionLocal.add(vec3(sway, age.mul(lift), sway.mul(0.65)));
  const edge = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1).pow(2);
  const strength = selectLayerNumber(layer, {
    0: BEAST_LAYER_RAMPS[0].embers,
    1: BEAST_LAYER_RAMPS[1].embers,
    2: BEAST_LAYER_RAMPS[2].embers,
    3: BEAST_LAYER_RAMPS[3].embers,
  });
  material.colorNode = mix(layerColour(layer, "mid"), layerColour(layer, "hot"), age.oneMinus());
  material.opacityNode = edge.mul(age.mul(Math.PI).sin()).mul(strength);
  return material;
}

function emberGeometry(bounds: Box3, layer: InstancedBufferAttribute): BufferGeometry {
  const top = Math.max(0.45, bounds.isEmpty() ? 0.85 : bounds.max.y);
  const span = Math.max(
    0.24,
    bounds.isEmpty() ? 0.35 : Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.48,
  );
  const points: number[] = [],
    coords: number[] = [],
    seeds: number[] = [],
    lifts: number[] = [],
    indices: number[] = [];
  for (let index = 0; index < EMBER_QUADS; index++) {
    const angle = index * 2.399963;
    const radius = span * (0.45 + 0.55 * ((index * 0.754877666) % 1));
    const size = index % 3 === 0 ? 0.046 : 0.03;
    const baseY = 0.1 + (index % 4) * (top * 0.12);
    const start = points.length / 3;
    for (const [x, y, u, v] of [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [-1, 1, 0, 1],
      [1, 1, 1, 1],
    ]) {
      points.push(
        Math.cos(angle) * radius + (index % 2 === 0 ? x * size : 0),
        baseY + y * size * 1.35,
        Math.sin(angle) * radius + (index % 2 === 1 ? x * size : 0),
      );
      coords.push(u, v);
      seeds.push((index * 0.61803398875) % 1);
      lifts.push(top * 0.55 + 0.25);
    }
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(coords, 2));
  geometry.setAttribute("emberSeed", new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("emberLift", new Float32BufferAttribute(lifts, 1));
  geometry.setAttribute("beastLayer", layer);
  geometry.setIndex(indices);
  return geometry;
}

function beastIdle() {
  const idle = attribute<"vec3">("beastIdle", "vec3");
  const breath = time.mul(idle.y).add(phase).add(positionGeometry.x.mul(0.8)).sin().add(1).mul(idle.z.div(2));
  const planted = breath.mul(smoothstep(0.08, 0.45, positionGeometry.y));
  return select(idle.x.greaterThan(1.5), feyIdle(), select(idle.x.greaterThan(0.5), breath, planted));
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
