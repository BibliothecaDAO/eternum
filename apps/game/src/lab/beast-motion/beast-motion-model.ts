import {
  AnimationClip,
  Bone,
  Box3,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  Uint16BufferAttribute,
  Vector3,
  VectorKeyframeTrack,
} from "three";
import { BEAST_MOTION_PROFILES } from "@/three/structures/beast-motion";
import { FRONTIER_BEASTS, type FrontierSpecies } from "@/three/structures/frontier-beast";
import { type BeastLayer } from "@/three/structures/frontier-model";
import { HEX_SIZE } from "@/three/constants/scene-constants";
import type { BeastFamilyShowcaseId } from "./beast-family-stage";

export type BeastMotionAction = "idle" | "walk" | "attack" | "hit" | "death";
export type BeastMotionWay = "maths" | "rig" | "hybrid";
export type BeastMotionCount = 1 | 20 | 100;
export type BeastMotionLayer = BeastLayer;
export type BeastMotionMode = "compare" | "bench" | "families";
export type BeastMotionCamera = "threeQuarter" | "phoneMap" | "close";

export interface BeastMotionState {
  mode: BeastMotionMode;
  way: BeastMotionWay;
  count: BeastMotionCount;
  action: BeastMotionAction;
  layer: BeastMotionLayer;
  phoenix: boolean;
  paused: boolean;
  camera: BeastMotionCamera;
  family: BeastFamilyShowcaseId;
  species: FrontierSpecies;
}

interface BeastMotionSample {
  breath: number;
  weightShift: number;
  headYaw: number;
  headPitch: number;
  tailYaw: number;
  wingFlap: number;
  walkPhase: number;
  walkOffsetZ: number;
  walkBob: number;
  attackLunge: number;
  attackCoil: number;
  hitFlinch: number;
  deathProgress: number;
}

export const BEAST_MOTION_MODES: readonly BeastMotionMode[] = ["compare", "bench", "families"];
export const BEAST_MOTION_CAMERAS: readonly BeastMotionCamera[] = ["threeQuarter", "phoneMap", "close"];
export const BEAST_MOTION_ACTIONS: readonly BeastMotionAction[] = ["idle", "walk", "attack", "hit", "death"];
export const BEAST_MOTION_WAYS: readonly BeastMotionWay[] = ["maths", "rig", "hybrid"];
export const BEAST_MOTION_COUNTS: readonly BeastMotionCount[] = [1, 20, 100];
export const BEAST_MOTION_LAYERS: readonly BeastMotionLayer[] = [0, 1, 2, 3];
export const BEAST_MOTION_SPECIES_LIST = Object.keys(FRONTIER_BEASTS) as readonly FrontierSpecies[];
export const BEAST_MOTION_SPECIES: FrontierSpecies = "wyvern";
export const BEAST_MOTION_CYCLE_SECONDS = 2.4;
const BEAST_MOTION_HEX_STRIDE = HEX_SIZE * 1.5;

export const BEAST_MOTION_MODE_LABELS = {
  compare: "Side-by-side (a/b/c)",
  bench: "Benchmark (1/20/100)",
  families: `Families (${BEAST_MOTION_SPECIES_LIST.length} beasts)`,
} satisfies Record<BeastMotionMode, string>;

export const BEAST_MOTION_CAMERA_LABELS = {
  threeQuarter: "3/4",
  phoneMap: "Map",
  close: "Close",
} satisfies Record<BeastMotionCamera, string>;

export const BEAST_MOTION_WAY_LABELS: Record<BeastMotionWay, string> = {
  maths: "(a) Pure Maths",
  rig: "(b) Rig + Clips",
  hybrid: "(c) Hybrid",
};

export const BEAST_MOTION_ACTION_INDEX: Record<BeastMotionAction, number> = {
  idle: 0,
  walk: 1,
  attack: 2,
  hit: 3,
  death: 4,
};

export const BEAST_MOTION_DEFAULTS: BeastMotionState = {
  mode: "compare",
  way: "maths",
  count: 20,
  action: "idle",
  layer: 2,
  phoenix: true,
  paused: false,
  camera: "threeQuarter",
  family: "ruin",
  species: BEAST_MOTION_SPECIES,
};

interface BoneSpec {
  readonly name: string;
  readonly parent: string | null;
  readonly position: readonly [number, number, number];
}

export const WYVERN_FULL_RIG_SPECS: readonly BoneSpec[] = [
  { name: "root", parent: null, position: [0, 0, 0] },
  { name: "pelvis", parent: "root", position: [0, 0.3, -0.06] },
  { name: "spine", parent: "pelvis", position: [0, 0.14, 0.14] },
  { name: "neck", parent: "spine", position: [0, 0.18, 0.04] },
  { name: "head", parent: "neck", position: [0, 0.34, 0.06] },
  { name: "tail0", parent: "pelvis", position: [0.06, -0.04, -0.18] },
  { name: "tail1", parent: "tail0", position: [0.22, -0.14, -0.12] },
  { name: "wingL", parent: "spine", position: [-0.14, 0.08, -0.06] },
  { name: "wingR", parent: "spine", position: [0.14, 0.08, -0.06] },
  { name: "legL", parent: "pelvis", position: [-0.16, -0.02, 0.02] },
  { name: "legR", parent: "pelvis", position: [0.16, -0.02, 0.02] },
  { name: "crest", parent: "head", position: [0, 0.12, -0.02] },
];

type HybridArchetype = (typeof BEAST_MOTION_PROFILES)[FrontierSpecies]["archetype"];

const HYBRID_NORM_SPECS: Record<HybridArchetype, readonly BoneSpec[]> = {
  winged: [
    { name: "pelvis", parent: null, position: [0, 0.28, -0.1] },
    { name: "spine", parent: "pelvis", position: [0, 0.16, 0.2] },
    { name: "neck", parent: "spine", position: [0, 0.18, 0.08] },
    { name: "head", parent: "neck", position: [0, 0.22, 0.08] },
    { name: "wingL", parent: "spine", position: [-0.38, 0.08, -0.1] },
    { name: "wingR", parent: "spine", position: [0.38, 0.08, -0.1] },
    { name: "legL", parent: "pelvis", position: [-0.36, -0.04, 0.04] },
    { name: "legR", parent: "pelvis", position: [0.36, -0.04, 0.04] },
  ],
  brute: [
    { name: "pelvis", parent: null, position: [0, 0.36, 0] },
    { name: "spine", parent: "pelvis", position: [0, 0.22, 0.04] },
    { name: "neck", parent: "spine", position: [0, 0.18, 0.04] },
    { name: "head", parent: "neck", position: [0, 0.12, 0.04] },
    { name: "armL", parent: "spine", position: [-0.46, 0.12, 0.04] },
    { name: "armR", parent: "spine", position: [0.46, 0.12, 0.04] },
    { name: "legL", parent: "pelvis", position: [-0.3, -0.06, 0.02] },
    { name: "legR", parent: "pelvis", position: [0.3, -0.06, 0.02] },
  ],
  serpentine: [
    { name: "pelvis", parent: null, position: [0, 0.32, -0.06] },
    { name: "spine", parent: "pelvis", position: [0, 0.16, 0.22] },
    { name: "neck", parent: "spine", position: [0, 0.2, 0.18] },
    { name: "head", parent: "neck", position: [0, 0.16, 0.14] },
    { name: "tail0", parent: "pelvis", position: [0, -0.04, -0.34] },
    { name: "tail1", parent: "tail0", position: [0, -0.04, -0.34] },
    { name: "legL", parent: "pelvis", position: [-0.38, -0.06, 0.14] },
    { name: "legR", parent: "pelvis", position: [0.38, -0.06, 0.14] },
  ],
  floating: [
    { name: "pelvis", parent: null, position: [0, 0.36, 0] },
    { name: "spine", parent: "pelvis", position: [0, 0.24, 0.02] },
    { name: "neck", parent: "spine", position: [0, 0.16, 0.02] },
    { name: "head", parent: "neck", position: [0, 0.12, 0.02] },
    { name: "armL", parent: "spine", position: [-0.42, 0.1, 0.06] },
    { name: "armR", parent: "spine", position: [0.42, 0.1, 0.06] },
    { name: "robeL", parent: "pelvis", position: [-0.24, -0.14, -0.04] },
    { name: "robeR", parent: "pelvis", position: [0.24, -0.14, -0.04] },
  ],
  tails: [
    { name: "pelvis", parent: null, position: [0, 0.34, -0.04] },
    { name: "spine", parent: "pelvis", position: [0, 0.22, 0.1] },
    { name: "head", parent: "spine", position: [0, 0.24, 0.1] },
    { name: "armL", parent: "spine", position: [-0.42, 0.08, 0.08] },
    { name: "armR", parent: "spine", position: [0.42, 0.08, 0.08] },
    { name: "tail0", parent: "pelvis", position: [0, 0.08, -0.38] },
    { name: "legL", parent: "pelvis", position: [-0.28, -0.06, 0.04] },
    { name: "legR", parent: "pelvis", position: [0.28, -0.06, 0.04] },
  ],
};

export const BEAST_MOTION_HYBRID_BONE_COUNT = HYBRID_NORM_SPECS.winged.length;

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const fract = (value: number) => value - Math.floor(value);

interface BoundsExtents {
  minY: number;
  height: number;
  halfX: number;
  halfZ: number;
  centerX: number;
  centerZ: number;
}

function readBoundsExtents(bounds: Box3): BoundsExtents {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  return {
    minY: bounds.min.y,
    height: Math.max(size.y, 0.25),
    halfX: Math.max(size.x * 0.5, 0.18),
    halfZ: Math.max(size.z * 0.5, 0.18),
    centerX: center.x,
    centerZ: center.z,
  };
}

function buildHybridSpecsForSpecies(species: FrontierSpecies, bounds: Box3): BoneSpec[] {
  const archetype = BEAST_MOTION_PROFILES[species].archetype;
  const ext = readBoundsExtents(bounds);
  return HYBRID_NORM_SPECS[archetype].map((spec) => {
    const isRoot = spec.parent === null;
    return {
      name: spec.name,
      parent: spec.parent,
      position: [
        spec.position[0] * ext.halfX + (isRoot ? ext.centerX : 0),
        spec.position[1] * ext.height + (isRoot ? ext.minY : 0),
        spec.position[2] * ext.halfZ + (isRoot ? ext.centerZ : 0),
      ] as const,
    };
  });
}

export function sampleBeastMotionCycle(action: BeastMotionAction, seconds: number): BeastMotionSample {
  const cycle = fract(seconds / BEAST_MOTION_CYCLE_SECONDS);
  const phase = cycle * TAU;
  const breath = Math.sin(phase * 2) * 0.5 + 0.5;
  const weightShift = Math.sin(phase);
  const headYaw = Math.sin(phase + 0.6) * 0.65 + Math.sin(phase * 2 + 1.1) * 0.35;
  const headPitch = Math.sin(phase * 2 - 0.5) * 0.5;
  const tailYaw = Math.sin(phase * 2 - 1.2) * 0.8 + Math.sin(phase * 3 + 0.4) * 0.2;
  const wingFlap = Math.sin(phase * 2 + 0.3);

  const walkPhase = phase * 2;
  const walkOffsetZ = action === "walk" ? Math.sin(phase) * (BEAST_MOTION_HEX_STRIDE * 0.5) : 0;
  const walkBob = action === "walk" ? Math.abs(Math.sin(walkPhase)) : 0;

  let attackCoil = 0;
  let attackLunge = 0;
  if (action === "attack") {
    if (cycle < 0.26) {
      attackCoil = smoothstep(0, 0.26, cycle);
    } else if (cycle < 0.44) {
      const strike = smoothstep(0.26, 0.44, cycle);
      attackCoil = 1 - strike;
      attackLunge = strike;
    } else if (cycle < 0.62) {
      attackLunge = 1 - smoothstep(0.44, 0.62, cycle) * 0.25;
    } else {
      attackLunge = 0.75 * (1 - smoothstep(0.62, 0.92, cycle));
    }
  }

  let hitFlinch = 0;
  if (action === "hit") {
    if (cycle < 0.14) {
      hitFlinch = smoothstep(0, 0.14, cycle);
    } else if (cycle < 0.55) {
      hitFlinch = 1 - smoothstep(0.14, 0.55, cycle);
    }
  }

  let deathProgress = 0;
  if (action === "death") {
    deathProgress = smoothstep(0.08, 0.56, cycle);
  }

  return {
    breath,
    weightShift,
    headYaw,
    headPitch,
    tailYaw,
    wingFlap,
    walkPhase,
    walkOffsetZ,
    walkBob,
    attackLunge,
    attackCoil,
    hitFlinch,
    deathProgress,
  };
}

export interface BuiltBeastRig {
  rootBone: Bone;
  bones: Bone[];
  skeleton: Skeleton;
  boneMap: Record<string, Bone>;
  restPositions: Record<string, Vector3>;
}

function buildRigFromSpecs(specs: readonly BoneSpec[]): BuiltBeastRig {
  const boneMap: Record<string, Bone> = {};
  const restPositions: Record<string, Vector3> = {};
  const bones: Bone[] = [];

  for (const spec of specs) {
    const bone = new Bone();
    bone.name = spec.name;
    bone.position.set(spec.position[0], spec.position[1], spec.position[2]);
    boneMap[spec.name] = bone;
    restPositions[spec.name] = bone.position.clone();
    bones.push(bone);
  }

  for (const spec of specs) {
    if (spec.parent) boneMap[spec.parent].add(boneMap[spec.name]);
  }

  const rootBone = bones[0];
  rootBone.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  return { rootBone, bones, skeleton, boneMap, restPositions };
}

export function createFullBeastSkeleton(): BuiltBeastRig {
  return buildRigFromSpecs(WYVERN_FULL_RIG_SPECS);
}

export function createBeastHybridSkeleton(species: FrontierSpecies, bounds: Box3): BuiltBeastRig {
  return buildRigFromSpecs(buildHybridSpecsForSpecies(species, bounds));
}

function assignHybridWeights(
  archetype: HybridArchetype,
  nx: number,
  ny: number,
  nz: number,
  push: (name: string, weight: number) => void,
): void {
  const absX = Math.abs(nx);
  if (archetype === "winged") {
    const wingMask = smoothstep(0.36, 0.72, absX) * smoothstep(0.24, 0.44, ny) * smoothstep(0.36, -0.05, nz);
    const legMask = smoothstep(0.34, 0.16, ny) * smoothstep(-0.35, -0.05, nz) * (1 - wingMask);
    const neckMask = smoothstep(0.46, 0.64, ny) * smoothstep(0.55, 0.22, absX) * (1 - wingMask);
    const headMask = smoothstep(0.74, 0.9, ny) * neckMask;
    const spineMask = smoothstep(0.3, 0.5, ny) * (1 - wingMask) * (1 - neckMask);
    if (wingMask > 0.01) push(nx < 0 ? "wingL" : "wingR", wingMask);
    if (legMask > 0.01) push(nx < 0 ? "legL" : "legR", legMask);
    if (headMask > 0.01) push("head", headMask);
    if (neckMask > headMask) push("neck", neckMask - headMask);
    if (spineMask > 0.01) push("spine", spineMask);
    return;
  }

  if (archetype === "brute") {
    const armMask = smoothstep(0.34, 0.66, absX) * smoothstep(0.34, 0.56, ny);
    const legMask = smoothstep(0.38, 0.18, ny) * (1 - armMask);
    const headMask = smoothstep(0.74, 0.9, ny) * smoothstep(0.55, 0.2, absX) * (1 - armMask);
    const neckMask = smoothstep(0.6, 0.76, ny) * smoothstep(0.58, 0.25, absX) * (1 - armMask) * (1 - headMask);
    const spineMask = smoothstep(0.36, 0.54, ny) * (1 - armMask) * (1 - headMask) * (1 - neckMask);
    if (armMask > 0.01) push(nx < 0 ? "armL" : "armR", armMask);
    if (legMask > 0.01) push(nx < 0 ? "legL" : "legR", legMask);
    if (headMask > 0.01) push("head", headMask);
    if (neckMask > 0.01) push("neck", neckMask);
    if (spineMask > 0.01) push("spine", spineMask);
    return;
  }

  if (archetype === "serpentine") {
    const tailMask = smoothstep(-0.18, -0.46, nz) * smoothstep(0.68, 0.34, ny);
    const tailTip = smoothstep(-0.5, -0.82, nz);
    const legMask = smoothstep(0.32, 0.14, ny) * smoothstep(-0.3, 0.08, nz) * smoothstep(0.2, 0.45, absX) * (1 - tailMask);
    const frontMask = (smoothstep(0.46, 0.72, ny) + smoothstep(0.24, 0.58, nz) * 0.65) * (1 - tailMask);
    const headMask = clamp01(frontMask) * smoothstep(0.66, 0.88, Math.max(ny, (nz + 1) * 0.5));
    const neckMask = clamp01(frontMask) * (1 - headMask);
    const spineMask = smoothstep(0.26, 0.48, ny) * (1 - tailMask) * (1 - clamp01(frontMask));
    if (tailMask > 0.01) {
      push("tail0", tailMask * (1 - tailTip * 0.65));
      push("tail1", tailMask * tailTip * 0.65);
    }
    if (legMask > 0.01) push(nx < 0 ? "legL" : "legR", legMask);
    if (headMask > 0.01) push("head", headMask);
    if (neckMask > 0.01) push("neck", neckMask);
    if (spineMask > 0.01) push("spine", spineMask);
    return;
  }

  if (archetype === "floating") {
    const armMask = smoothstep(0.32, 0.64, absX) * smoothstep(0.42, 0.62, ny);
    const robeMask = smoothstep(0.36, 0.14, ny);
    const headMask = smoothstep(0.76, 0.9, ny) * smoothstep(0.55, 0.2, absX) * (1 - armMask);
    const neckMask = smoothstep(0.62, 0.76, ny) * smoothstep(0.55, 0.22, absX) * (1 - armMask) * (1 - headMask);
    const spineMask = smoothstep(0.36, 0.56, ny) * (1 - armMask) * (1 - headMask) * (1 - neckMask);
    if (armMask > 0.01) push(nx < 0 ? "armL" : "armR", armMask);
    if (robeMask > 0.01) push(nx < 0 ? "robeL" : "robeR", robeMask);
    if (headMask > 0.01) push("head", headMask);
    if (neckMask > 0.01) push("neck", neckMask);
    if (spineMask > 0.01) push("spine", spineMask);
    return;
  }

  const tailMask = smoothstep(-0.18, -0.48, nz) * smoothstep(0.18, 0.36, ny);
  const armMask = smoothstep(0.34, 0.64, absX) * smoothstep(0.38, 0.58, ny) * (1 - tailMask);
  const legMask = smoothstep(0.34, 0.16, ny) * smoothstep(-0.32, 0.05, nz) * (1 - tailMask);
  const headMask = smoothstep(0.7, 0.88, ny) * smoothstep(0.55, 0.22, absX) * (1 - tailMask) * (1 - armMask);
  const spineMask = smoothstep(0.34, 0.56, ny) * (1 - tailMask) * (1 - armMask) * (1 - headMask);
  if (tailMask > 0.01) push("tail0", tailMask);
  if (armMask > 0.01) push(nx < 0 ? "armL" : "armR", armMask);
  if (legMask > 0.01) push(nx < 0 ? "legL" : "legR", legMask);
  if (headMask > 0.01) push("head", headMask);
  if (spineMask > 0.01) push("spine", spineMask);
}

export function applyBeastSpatialSkinning(
  geometry: BufferGeometry,
  species: FrontierSpecies,
  bounds: Box3,
  kind: "full" | "hybrid",
): BufferGeometry {
  const archetype = BEAST_MOTION_PROFILES[species].archetype;
  const specs = kind === "full" ? WYVERN_FULL_RIG_SPECS : buildHybridSpecsForSpecies(species, bounds);
  const indexOf = Object.fromEntries(specs.map((spec, idx) => [spec.name, idx])) as Record<string, number>;
  const ext = readBoundsExtents(bounds);
  const cloned = geometry.clone();
  const pos = cloned.getAttribute("position");
  const count = pos.count;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  const pairs: Array<[number, number]> = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = (x - ext.centerX) / ext.halfX;
    const ny = (y - ext.minY) / ext.height;
    const nz = (z - ext.centerZ) / ext.halfZ;
    const absX = Math.abs(x);

    pairs.length = 0;
    const push = (name: string, weight: number) => {
      if (weight > 1e-4 && indexOf[name] !== undefined) pairs.push([indexOf[name], weight]);
    };

    if (kind === "full") {
      const wingMask = smoothstep(0.16, 0.3, absX) * smoothstep(0.24, 0.42, y) * smoothstep(0.18, 0.02, z);
      const tailMask = smoothstep(-0.14, -0.24, z) * smoothstep(0.42, 0.24, y) * (1 - wingMask);
      const legMask = smoothstep(0.36, 0.2, y) * smoothstep(-0.18, -0.05, z) * (1 - wingMask);
      const neckMask = smoothstep(0.46, 0.64, y) * smoothstep(0.24, 0.12, absX) * (1 - wingMask);
      const headMask = smoothstep(0.76, 0.94, y) * neckMask;
      const spineMask = smoothstep(0.32, 0.52, y) * (1 - wingMask) * (1 - tailMask) * (1 - neckMask);
      if (wingMask > 0.01) push(x < 0 ? "wingL" : "wingR", wingMask);
      if (legMask > 0.01) push(x < 0 ? "legL" : "legR", legMask);
      if (tailMask > 0.01) {
        const tipWeight = clamp01(smoothstep(-0.26, -0.36, z) + smoothstep(0.16, 0.34, x) * 0.5);
        push("tail0", tailMask * (1 - tipWeight * 0.65));
        push("tail1", tailMask * tipWeight * 0.65);
      }
      if (headMask > 0.01) {
        const crestWeight = smoothstep(1.0, 1.12, y);
        push("head", headMask * (1 - crestWeight * 0.5));
        push("crest", headMask * crestWeight * 0.5);
      }
      if (neckMask > headMask) push("neck", neckMask - headMask);
      if (spineMask > 0.01) push("spine", spineMask);
    } else {
      assignHybridWeights(archetype, nx, ny, nz, push);
    }

    const assigned = pairs.reduce((sum, entry) => sum + entry[1], 0);
    push("pelvis", Math.max(0.05, 1 - assigned));

    pairs.sort((a, b) => b[1] - a[1]);
    const top = pairs.slice(0, 4);
    const total = top.reduce((sum, entry) => sum + entry[1], 0);
    for (let slot = 0; slot < 4; slot++) {
      const entry = top[slot];
      skinIndices[i * 4 + slot] = entry ? entry[0] : 0;
      skinWeights[i * 4 + slot] = entry ? entry[1] / total : 0;
    }
  }

  cloned.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  cloned.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  return cloned;
}

const TEMP_EULER = new Euler();
const TEMP_QUAT = new Quaternion();

interface BonePose {
  posOffset?: readonly [number, number, number];
  rot?: readonly [number, number, number];
}

function evaluateFullRigBonePose(boneName: string, action: BeastMotionAction, sample: BeastMotionSample): BonePose {
  const walkActive = action === "walk" ? 1 : 0;
  const death = sample.deathProgress;
  const flinch = sample.hitFlinch;
  const lunge = sample.attackLunge;
  const coil = sample.attackCoil;

  switch (boneName) {
    case "root":
      return {
        posOffset: [
          sample.weightShift * 0.03 * (1 - death),
          sample.walkBob * 0.055 * walkActive + death * 0.14,
          sample.walkOffsetZ + lunge * 0.42 - coil * 0.18 - flinch * 0.24,
        ],
        rot: [
          lunge * 0.22 - coil * 0.18 - flinch * 0.24 + death * 0.18,
          sample.weightShift * 0.05 * (1 - death),
          death * 1.48 + Math.sin(sample.walkPhase) * 0.06 * walkActive,
        ],
      };
    case "pelvis":
      return {
        posOffset: [0, sample.breath * 0.025 * (1 - death), 0],
        rot: [
          -coil * 0.14 + lunge * 0.12 - flinch * 0.18,
          sample.weightShift * 0.07 * (1 - death),
          sample.weightShift * 0.04 * (1 - death),
        ],
      };
    case "spine":
      return {
        rot: [
          sample.breath * 0.07 * (1 - death) - coil * 0.24 + lunge * 0.34 - flinch * 0.26,
          sample.headYaw * 0.08 * (1 - death),
          -Math.sin(sample.walkPhase) * 0.05 * walkActive,
        ],
      };
    case "neck":
      return {
        rot: [
          sample.headPitch * 0.12 * (1 - death) - coil * 0.32 + lunge * 0.48 - flinch * 0.34 + death * 0.35,
          sample.headYaw * 0.18 * (1 - death),
          sample.weightShift * 0.06 * (1 - death),
        ],
      };
    case "head":
      return {
        rot: [
          sample.headPitch * 0.14 * (1 - death) + lunge * 0.24 - flinch * 0.32 + death * 0.28,
          sample.headYaw * 0.22 * (1 - death),
          0,
        ],
      };
    case "crest":
      return {
        rot: [sample.breath * 0.05 - flinch * 0.18, 0, 0],
      };
    case "tail0":
      return {
        rot: [-sample.breath * 0.08 + lunge * 0.2 - death * 0.2, sample.tailYaw * 0.32 * (1 - death), 0],
      };
    case "tail1":
      return {
        rot: [0, sample.tailYaw * 0.45 * (1 - death), 0],
      };
    case "wingL":
      return {
        rot: [
          -coil * 0.25 + lunge * 0.35 - flinch * 0.3,
          -coil * 0.32 + lunge * 0.45 + sample.wingFlap * 0.12 * (1 - death),
          (0.18 * sample.wingFlap + 0.14 * walkActive * Math.sin(sample.walkPhase)) * (1 - death) +
            coil * 0.42 -
            flinch * 0.38 -
            death * 0.55,
        ],
      };
    case "wingR":
      return {
        rot: [
          -coil * 0.25 + lunge * 0.35 - flinch * 0.3,
          coil * 0.32 - lunge * 0.45 - sample.wingFlap * 0.12 * (1 - death),
          -(0.18 * sample.wingFlap + 0.14 * walkActive * Math.sin(sample.walkPhase)) * (1 - death) -
            coil * 0.42 +
            flinch * 0.38 +
            death * 0.55,
        ],
      };
    case "legL":
      return {
        rot: [
          Math.sin(sample.walkPhase) * 0.55 * walkActive - coil * 0.22 + lunge * 0.28 - flinch * 0.16 + death * 0.45,
          0,
          death * 0.25,
        ],
      };
    case "legR":
      return {
        rot: [
          -Math.sin(sample.walkPhase) * 0.55 * walkActive - coil * 0.22 + lunge * 0.28 - flinch * 0.16 + death * 0.35,
          0,
          -death * 0.25,
        ],
      };
    default:
      return {};
  }
}

export function buildFullBeastRigClips(restPositions: Record<string, Vector3>): Record<BeastMotionAction, AnimationClip> {
  const frames = 24;
  const times = Array.from({ length: frames + 1 }, (_, i) => (i / frames) * BEAST_MOTION_CYCLE_SECONDS);
  const clips = {} as Record<BeastMotionAction, AnimationClip>;

  for (const action of BEAST_MOTION_ACTIONS) {
    const tracks: Array<VectorKeyframeTrack | QuaternionKeyframeTrack> = [];
    for (const spec of WYVERN_FULL_RIG_SPECS) {
      const rest = restPositions[spec.name] ?? new Vector3(...spec.position);
      const posValues: number[] = [];
      const quatValues: number[] = [];
      let hasPos = false;

      for (const t of times) {
        const sample = sampleBeastMotionCycle(action, t);
        const pose = evaluateFullRigBonePose(spec.name, action, sample);
        if (pose.posOffset) {
          hasPos = true;
          posValues.push(rest.x + pose.posOffset[0], rest.y + pose.posOffset[1], rest.z + pose.posOffset[2]);
        } else {
          posValues.push(rest.x, rest.y, rest.z);
        }
        const rot = pose.rot ?? [0, 0, 0];
        TEMP_EULER.set(rot[0], rot[1], rot[2], "XYZ");
        TEMP_QUAT.setFromEuler(TEMP_EULER);
        quatValues.push(TEMP_QUAT.x, TEMP_QUAT.y, TEMP_QUAT.z, TEMP_QUAT.w);
      }

      if (hasPos) tracks.push(new VectorKeyframeTrack(`${spec.name}.position`, times, posValues));
      tracks.push(new QuaternionKeyframeTrack(`${spec.name}.quaternion`, times, quatValues));
    }
    clips[action] = new AnimationClip(`beast-${action}`, BEAST_MOTION_CYCLE_SECONDS, tracks);
  }

  return clips;
}

export function poseBeastHybridRig(
  rig: BuiltBeastRig,
  species: FrontierSpecies,
  action: BeastMotionAction,
  seconds: number,
  phaseOffset = 0,
): void {
  const profile = BEAST_MOTION_PROFILES[species];
  const archetype = profile.archetype;
  const sample = sampleBeastMotionCycle(action, seconds + phaseOffset);
  const walkActive = action === "walk" ? 1 : 0;
  const alive = 1 - sample.deathProgress;
  const death = sample.deathProgress;
  const flinch = sample.hitFlinch;
  const lunge = sample.attackLunge;
  const coil = sample.attackCoil;
  const stride = Math.sin(sample.walkPhase) * walkActive;

  const setBone = (name: string, rx: number, ry: number, rz: number, ox = 0, oy = 0, oz = 0) => {
    const bone = rig.boneMap[name];
    const rest = rig.restPositions[name];
    if (!bone || !rest) return;
    bone.position.set(rest.x + ox, rest.y + oy, rest.z + oz);
    bone.rotation.set(rx, ry, rz);
  };

  if (archetype === "winged") {
    const hoverLift = profile.hoverAmp > 0.02 ? Math.sin(sample.walkPhase * 0.5) * profile.hoverAmp * alive : 0;
    setBone(
      "pelvis",
      lunge * 0.24 - coil * 0.2 - flinch * 0.24 + death * 0.16,
      sample.weightShift * 0.05 * alive,
      death * 1.48 + stride * 0.05,
      0,
      sample.walkBob * 0.055 * walkActive + hoverLift - death * 0.18,
      sample.walkOffsetZ + lunge * 0.42 - coil * 0.18 - flinch * 0.24,
    );
    setBone("spine", -coil * 0.22 + lunge * 0.34 - flinch * 0.26, 0, -stride * 0.04);
    setBone("neck", -coil * 0.3 + lunge * 0.48 - flinch * 0.34 + death * 0.35, sample.headYaw * 0.14 * alive, 0);
    setBone("head", lunge * 0.24 - flinch * 0.32 + death * 0.28, sample.headYaw * 0.16 * alive, 0);
    setBone(
      "wingL",
      -coil * 0.25 + lunge * 0.35 - flinch * 0.3,
      -coil * 0.3 + lunge * 0.42,
      (0.22 * sample.wingFlap + stride * 0.12) * alive + coil * 0.42 - flinch * 0.38 - death * 0.55,
    );
    setBone(
      "wingR",
      -coil * 0.25 + lunge * 0.35 - flinch * 0.3,
      coil * 0.3 - lunge * 0.42,
      -(0.22 * sample.wingFlap + stride * 0.12) * alive - coil * 0.42 + flinch * 0.38 + death * 0.55,
    );
    setBone("legL", stride * 0.55 - coil * 0.22 + lunge * 0.28 - flinch * 0.16 + death * 0.45, 0, death * 0.25);
    setBone("legR", -stride * 0.55 - coil * 0.22 + lunge * 0.28 - flinch * 0.16 + death * 0.35, 0, -death * 0.25);
    return;
  }

  if (archetype === "brute") {
    setBone(
      "pelvis",
      lunge * 0.22 - coil * 0.18 - flinch * 0.22 + death * 0.12,
      sample.weightShift * 0.06 * alive,
      death * 1.46 + stride * 0.07,
      0,
      sample.walkBob * 0.06 * walkActive - death * 0.22,
      sample.walkOffsetZ + lunge * 0.36 - coil * 0.16 - flinch * 0.22,
    );
    setBone(
      "spine",
      sample.breath * 0.05 * alive - coil * 0.24 + lunge * 0.38 - flinch * 0.28,
      sample.weightShift * 0.06 * alive,
      -stride * 0.05,
    );
    setBone("neck", -coil * 0.16 + lunge * 0.24 - flinch * 0.26 + death * 0.25, sample.headYaw * 0.14 * alive, 0);
    setBone("head", sample.headPitch * 0.1 * alive - flinch * 0.24 + death * 0.2, sample.headYaw * 0.18 * alive, 0);
    setBone(
      "armL",
      -stride * 0.42 - coil * 1.05 + lunge * 0.85 - flinch * 0.35 + death * 0.45,
      -coil * 0.18 + lunge * 0.14,
      (0.08 + sample.breath * 0.06) * alive + coil * 0.24 - flinch * 0.25 - death * 0.35,
    );
    setBone(
      "armR",
      stride * 0.42 - coil * 1.12 + lunge * 0.92 - flinch * 0.32 + death * 0.4,
      coil * 0.18 - lunge * 0.14,
      -(0.08 + sample.breath * 0.06) * alive - coil * 0.24 + flinch * 0.25 + death * 0.35,
    );
    setBone("legL", stride * 0.52 - coil * 0.18 + lunge * 0.22 - flinch * 0.14 + death * 0.4, 0, death * 0.22);
    setBone("legR", -stride * 0.52 - coil * 0.18 + lunge * 0.22 - flinch * 0.14 + death * 0.3, 0, -death * 0.22);
    return;
  }

  if (archetype === "serpentine") {
    setBone(
      "pelvis",
      lunge * 0.18 - coil * 0.2 - flinch * 0.2 + death * 0.15,
      sample.weightShift * 0.1 * alive,
      death * 1.42 + stride * 0.05,
      0,
      sample.walkBob * 0.04 * walkActive - death * 0.16,
      sample.walkOffsetZ + lunge * 0.44 - coil * 0.22 - flinch * 0.22,
    );
    setBone("spine", -coil * 0.26 + lunge * 0.36 - flinch * 0.24, sample.headYaw * 0.16 * alive, -stride * 0.05);
    setBone("neck", -coil * 0.34 + lunge * 0.52 - flinch * 0.32 + death * 0.3, sample.headYaw * 0.26 * alive, 0);
    setBone("head", lunge * 0.28 - flinch * 0.3 + death * 0.25, sample.headYaw * 0.28 * alive, 0);
    setBone("tail0", -sample.breath * 0.08 * alive + lunge * 0.22 - death * 0.2, sample.tailYaw * 0.36 * alive, 0);
    setBone("tail1", 0, sample.tailYaw * 0.48 * alive, 0);
    setBone("legL", stride * 0.48 - coil * 0.18 + lunge * 0.22 + death * 0.35, 0, death * 0.2);
    setBone("legR", -stride * 0.48 - coil * 0.18 + lunge * 0.22 + death * 0.25, 0, -death * 0.2);
    return;
  }

  if (archetype === "floating") {
    const hover = Math.sin(sample.walkPhase * 0.5) * Math.max(profile.hoverAmp, 0.04) * alive;
    setBone(
      "pelvis",
      walkActive * 0.16 + lunge * 0.22 - coil * 0.18 - flinch * 0.26 + death * 0.22,
      sample.weightShift * 0.08 * alive,
      death * 1.45 + sample.weightShift * 0.05 * alive,
      0,
      hover - death * 0.26,
      sample.walkOffsetZ + lunge * 0.36 - coil * 0.16 - flinch * 0.24,
    );
    setBone("spine", -coil * 0.2 + lunge * 0.32 - flinch * 0.24, sample.headYaw * 0.1 * alive, 0);
    setBone("neck", -coil * 0.16 + lunge * 0.22 - flinch * 0.22 + death * 0.24, sample.headYaw * 0.16 * alive, 0);
    setBone("head", sample.headPitch * 0.12 * alive - flinch * 0.2 + death * 0.2, sample.headYaw * 0.2 * alive, 0);
    setBone(
      "armL",
      -coil * 0.65 + lunge * 0.52 - flinch * 0.35 + death * 0.4,
      -coil * 0.35 + lunge * 0.25,
      (0.14 + sample.breath * 0.1) * alive + coil * 0.45 - flinch * 0.3 - death * 0.4,
    );
    setBone(
      "armR",
      -coil * 0.65 + lunge * 0.52 - flinch * 0.35 + death * 0.4,
      coil * 0.35 - lunge * 0.25,
      -(0.14 + sample.breath * 0.1) * alive - coil * 0.45 + flinch * 0.3 + death * 0.4,
    );
    setBone("robeL", -walkActive * 0.24 + sample.tailYaw * 0.14 * alive + death * 0.45, 0, sample.weightShift * 0.12 * alive);
    setBone("robeR", -walkActive * 0.24 - sample.tailYaw * 0.14 * alive + death * 0.4, 0, sample.weightShift * 0.12 * alive);
    return;
  }

  setBone(
    "pelvis",
    lunge * 0.24 - coil * 0.22 - flinch * 0.22 + death * 0.14,
    sample.weightShift * 0.08 * alive,
    death * 1.46 + stride * 0.06,
    0,
    sample.walkBob * 0.06 * walkActive - death * 0.2,
    sample.walkOffsetZ + lunge * 0.42 - coil * 0.18 - flinch * 0.22,
  );
  setBone("spine", -coil * 0.24 + lunge * 0.38 - flinch * 0.24, sample.headYaw * 0.12 * alive, -stride * 0.05);
  setBone("head", sample.headPitch * 0.12 * alive + lunge * 0.2 - flinch * 0.26 + death * 0.24, sample.headYaw * 0.22 * alive, 0);
  setBone(
    "armL",
    -stride * 0.45 - coil * 0.62 + lunge * 0.68 - flinch * 0.3 + death * 0.35,
    -coil * 0.22 + lunge * 0.18,
    0.1 * alive + coil * 0.28 - death * 0.35,
  );
  setBone(
    "armR",
    stride * 0.45 - coil * 0.62 + lunge * 0.68 - flinch * 0.3 + death * 0.35,
    coil * 0.22 - lunge * 0.18,
    -0.1 * alive - coil * 0.28 + death * 0.35,
  );
  setBone("tail0", -sample.breath * 0.1 * alive + lunge * 0.28 - coil * 0.18 - death * 0.25, sample.tailYaw * 0.44 * alive, 0);
  setBone("legL", stride * 0.56 - coil * 0.2 + lunge * 0.26 - flinch * 0.14 + death * 0.42, 0, death * 0.22);
  setBone("legR", -stride * 0.56 - coil * 0.2 + lunge * 0.26 - flinch * 0.14 + death * 0.34, 0, -death * 0.22);
}

export function computeHexFormationOffsets(count: number): Array<{ x: number; z: number }> {
  if (count <= 1) return [{ x: 0, z: 0 }];
  const spacingX = HEX_SIZE * Math.sqrt(3);
  const spacingZ = HEX_SIZE * 1.5;
  const cols = Math.ceil(Math.sqrt(count * 1.15));
  const rows = Math.ceil(count / cols);
  const result: Array<{ x: number; z: number }> = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = (col - (cols - 1) / 2 + (row % 2 === 0 ? 0 : 0.5)) * spacingX;
    const z = (row - (rows - 1) / 2) * spacingZ;
    result.push({ x, z });
  }
  return result;
}
