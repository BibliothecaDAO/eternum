import type Node from "three/src/nodes/core/Node.js";
import { InstancedBufferAttribute, Matrix4, Vector3 } from "three";
import {
  abs,
  attribute,
  cos,
  float,
  instanceIndex,
  max,
  mix,
  positionGeometry,
  select,
  sin,
  smoothstep,
  vec3,
} from "three/tsl";
import type { AnimationVisibilityContext } from "../types/animation";
import { isAnimationPositionVisible } from "../utils/animation-visibility";
import type { FrontierSpecies } from "./frontier-beast";

export type BeastMotionAction = "idle" | "attack" | "hit" | "death";
type BeastMotionArchetype = "winged" | "serpentine" | "floating" | "brute" | "tails";

export interface BeastMotionProfile {
  readonly archetype: BeastMotionArchetype;
  readonly breathSpeed: number;
  readonly breathAmp: number;
  readonly swayAmp: number;
  readonly wingAmp: number;
  readonly tailAmp: number;
  readonly hoverAmp: number;
  readonly attackDuration: number;
  readonly hitDuration: number;
  readonly deathDuration: number;
  readonly height: number;
}

export interface BeastMotionSlotState {
  readonly action: BeastMotionAction;
  readonly progress: number;
  readonly clock: number;
  readonly active: boolean;
}

const BEAST_ACTION_CODES = {
  idle: 0,
  attack: 1,
  hit: 2,
  death: 3,
} as const satisfies Record<BeastMotionAction, number>;

const CODE_TO_ACTION: readonly BeastMotionAction[] = ["idle", "attack", "hit", "death"];

const ARCHETYPE_CODES = {
  winged: 0,
  serpentine: 1,
  floating: 2,
  brute: 3,
  tails: 4,
} as const satisfies Record<BeastMotionArchetype, number>;

export const BEAST_MOTION_PROFILES = {
  cyclops: {
    archetype: "brute",
    breathSpeed: 1.5,
    breathAmp: 0.032,
    swayAmp: 0.028,
    wingAmp: 0,
    tailAmp: 0,
    hoverAmp: 0,
    attackDuration: 0.85,
    hitDuration: 0.55,
    deathDuration: 1.05,
    height: 1.15,
  },
  hydra: {
    archetype: "serpentine",
    breathSpeed: 1.15,
    breathAmp: 0.028,
    swayAmp: 0.042,
    wingAmp: 0,
    tailAmp: 0.055,
    hoverAmp: 0,
    attackDuration: 0.8,
    hitDuration: 0.55,
    deathDuration: 1.0,
    height: 0.734,
  },
  tarrasque: {
    archetype: "serpentine",
    breathSpeed: 1.2,
    breathAmp: 0.03,
    swayAmp: 0.03,
    wingAmp: 0,
    tailAmp: 0.068,
    hoverAmp: 0,
    attackDuration: 0.9,
    hitDuration: 0.58,
    deathDuration: 1.1,
    height: 0.94,
  },
  wraith: {
    archetype: "floating",
    breathSpeed: 1.35,
    breathAmp: 0.022,
    swayAmp: 0.036,
    wingAmp: 0,
    tailAmp: 0.042,
    hoverAmp: 0.052,
    attackDuration: 0.75,
    hitDuration: 0.5,
    deathDuration: 0.95,
    height: 1.26,
  },
  banshee: {
    archetype: "floating",
    breathSpeed: 1.65,
    breathAmp: 0.024,
    swayAmp: 0.044,
    wingAmp: 0,
    tailAmp: 0.048,
    hoverAmp: 0.048,
    attackDuration: 0.72,
    hitDuration: 0.48,
    deathDuration: 0.92,
    height: 1.15,
  },
  lich: {
    archetype: "floating",
    breathSpeed: 1.0,
    breathAmp: 0.02,
    swayAmp: 0.026,
    wingAmp: 0,
    tailAmp: 0.032,
    hoverAmp: 0.038,
    attackDuration: 0.82,
    hitDuration: 0.52,
    deathDuration: 1.0,
    height: 1.15,
  },
  troll: {
    archetype: "brute",
    breathSpeed: 1.25,
    breathAmp: 0.032,
    swayAmp: 0.034,
    wingAmp: 0,
    tailAmp: 0,
    hoverAmp: 0,
    attackDuration: 0.88,
    hitDuration: 0.55,
    deathDuration: 1.08,
    height: 1.15,
  },
  golem: {
    archetype: "brute",
    breathSpeed: 0.85,
    breathAmp: 0.024,
    swayAmp: 0.02,
    wingAmp: 0,
    tailAmp: 0,
    hoverAmp: 0,
    attackDuration: 0.95,
    hitDuration: 0.6,
    deathDuration: 1.15,
    height: 1.15,
  },
  ettin: {
    archetype: "brute",
    breathSpeed: 1.4,
    breathAmp: 0.034,
    swayAmp: 0.036,
    wingAmp: 0,
    tailAmp: 0,
    hoverAmp: 0,
    attackDuration: 0.86,
    hitDuration: 0.54,
    deathDuration: 1.06,
    height: 1.15,
  },
  "dark-fey": {
    archetype: "winged",
    breathSpeed: 1.9,
    breathAmp: 0.022,
    swayAmp: 0.024,
    wingAmp: 0.17,
    tailAmp: 0.02,
    hoverAmp: 0.048,
    attackDuration: 0.72,
    hitDuration: 0.48,
    deathDuration: 0.9,
    height: 1.4,
  },
  kappa: {
    archetype: "tails",
    breathSpeed: 1.7,
    breathAmp: 0.028,
    swayAmp: 0.034,
    wingAmp: 0,
    tailAmp: 0.045,
    hoverAmp: 0,
    attackDuration: 0.75,
    hitDuration: 0.5,
    deathDuration: 0.95,
    height: 1.15,
  },
  kitsune: {
    archetype: "tails",
    breathSpeed: 1.45,
    breathAmp: 0.026,
    swayAmp: 0.032,
    wingAmp: 0,
    tailAmp: 0.085,
    hoverAmp: 0,
    attackDuration: 0.76,
    hitDuration: 0.5,
    deathDuration: 0.95,
    height: 1.15,
  },
  wyvern: {
    archetype: "winged",
    breathSpeed: 1.35,
    breathAmp: 0.032,
    swayAmp: 0.03,
    wingAmp: 0.19,
    tailAmp: 0.056,
    hoverAmp: 0.014,
    attackDuration: 0.82,
    hitDuration: 0.54,
    deathDuration: 1.04,
    height: 1.093,
  },
  ammit: {
    archetype: "serpentine",
    breathSpeed: 1.5,
    breathAmp: 0.028,
    swayAmp: 0.034,
    wingAmp: 0,
    tailAmp: 0.058,
    hoverAmp: 0,
    attackDuration: 0.78,
    hitDuration: 0.52,
    deathDuration: 0.98,
    height: 0.829,
  },
  minotaur: {
    archetype: "brute",
    breathSpeed: 1.25,
    breathAmp: 0.034,
    swayAmp: 0.038,
    wingAmp: 0,
    tailAmp: 0,
    hoverAmp: 0,
    attackDuration: 0.84,
    hitDuration: 0.54,
    deathDuration: 1.05,
    height: 1.15,
  },
  colossus: {
    archetype: "brute",
    breathSpeed: 0.85,
    breathAmp: 0.03,
    swayAmp: 0.022,
    wingAmp: 0,
    tailAmp: 0,
    hoverAmp: 0,
    attackDuration: 0.98,
    hitDuration: 0.62,
    deathDuration: 1.2,
    height: 1.36,
  },
  warlock: {
    archetype: "floating",
    breathSpeed: 1.4,
    breathAmp: 0.024,
    swayAmp: 0.032,
    wingAmp: 0,
    tailAmp: 0.044,
    hoverAmp: 0.056,
    attackDuration: 0.78,
    hitDuration: 0.5,
    deathDuration: 0.98,
    height: 1.15,
  },
  balrog: {
    archetype: "winged",
    breathSpeed: 1.2,
    breathAmp: 0.036,
    swayAmp: 0.034,
    wingAmp: 0.16,
    tailAmp: 0.048,
    hoverAmp: 0,
    attackDuration: 0.88,
    hitDuration: 0.56,
    deathDuration: 1.1,
    height: 1.15,
  },
  basilisk: {
    archetype: "serpentine",
    breathSpeed: 1.4,
    breathAmp: 0.026,
    swayAmp: 0.046,
    wingAmp: 0,
    tailAmp: 0.078,
    hoverAmp: 0,
    attackDuration: 0.8,
    hitDuration: 0.52,
    deathDuration: 1.02,
    height: 1.15,
  },
} as const satisfies Record<FrontierSpecies, BeastMotionProfile>;

const GOLDEN_PHASE = 2.399963;
const scratchPosition = new Vector3();

export class BeastMotionController {
  public readonly attribute: InstancedBufferAttribute;
  private readonly profile: BeastMotionProfile;
  private readonly positions: Float32Array;
  private readonly seeded: Uint8Array;
  private readonly capacity: number;
  private lastVisibleCount = 0;

  constructor(species: FrontierSpecies, capacity: number) {
    this.profile = BEAST_MOTION_PROFILES[species];
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.seeded = new Uint8Array(capacity);
    this.attribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    for (let i = 0; i < capacity; i++) {
      this.attribute.setXYZW(i, BEAST_ACTION_CODES.idle, 0, i * GOLDEN_PHASE, 1);
    }
  }

  public setPlacementAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.capacity) return;
    const base = index * 3;
    this.positions[base] = matrix.elements[12];
    this.positions[base + 1] = matrix.elements[13];
    this.positions[base + 2] = matrix.elements[14];
    if (!this.seeded[index]) {
      this.seeded[index] = 1;
      this.attribute.setZ(index, index * GOLDEN_PHASE);
      this.attribute.setW(index, 1);
      this.attribute.needsUpdate = true;
    }
  }

  public playActionAt(index: number, action: BeastMotionAction): void {
    if (index < 0 || index >= this.capacity) return;
    this.attribute.setX(index, BEAST_ACTION_CODES[action]);
    this.attribute.setY(index, 0);
    this.attribute.needsUpdate = true;
  }

  public resetAt(index: number): void {
    this.playActionAt(index, "idle");
  }

  public getStateAt(index: number): BeastMotionSlotState {
    if (index < 0 || index >= this.capacity) {
      return { action: "idle", progress: 0, clock: 0, active: false };
    }
    const code = Math.round(this.attribute.getX(index));
    return {
      action: CODE_TO_ACTION[code] ?? "idle",
      progress: this.attribute.getY(index),
      clock: this.attribute.getZ(index),
      active: this.attribute.getW(index) > 0.5,
    };
  }

  public getVisibleSlotCount(): number {
    return this.lastVisibleCount;
  }

  public update(deltaSeconds: number, count: number, visibility?: AnimationVisibilityContext): number {
    const dt = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    const limit = Math.min(Math.max(0, count), this.capacity);
    if (limit === 0) {
      this.lastVisibleCount = 0;
      return 0;
    }
    let visibleSlots = 0;
    let dirty = false;
    for (let i = 0; i < limit; i++) {
      const base = i * 3;
      scratchPosition.set(this.positions[base], this.positions[base + 1], this.positions[base + 2]);
      const visible = isAnimationPositionVisible(scratchPosition, visibility);
      const prevActive = this.attribute.getW(i) > 0.5;
      if (visible !== prevActive) {
        this.attribute.setW(i, visible ? 1 : 0);
        dirty = true;
      }
      if (!visible) continue;
      visibleSlots++;
      if (dt <= 0) continue;
      const code = Math.round(this.attribute.getX(i));
      const clock = this.attribute.getZ(i) + dt;
      this.attribute.setZ(i, clock);
      dirty = true;
      if (code === BEAST_ACTION_CODES.attack) {
        const nextProgress = this.attribute.getY(i) + dt / this.profile.attackDuration;
        if (nextProgress >= 1) {
          this.attribute.setX(i, BEAST_ACTION_CODES.idle);
          this.attribute.setY(i, 0);
        } else {
          this.attribute.setY(i, nextProgress);
        }
      } else if (code === BEAST_ACTION_CODES.hit) {
        const nextProgress = this.attribute.getY(i) + dt / this.profile.hitDuration;
        if (nextProgress >= 1) {
          this.attribute.setX(i, BEAST_ACTION_CODES.idle);
          this.attribute.setY(i, 0);
        } else {
          this.attribute.setY(i, nextProgress);
        }
      } else if (code === BEAST_ACTION_CODES.death) {
        const nextProgress = Math.min(1, this.attribute.getY(i) + dt / this.profile.deathDuration);
        this.attribute.setY(i, nextProgress);
      }
    }
    this.lastVisibleCount = visibleSlots;
    if (dirty) this.attribute.needsUpdate = true;
    return visibleSlots;
  }
}

function smoothstepCpu(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function evaluateBeastMotionDisplacement(
  species: FrontierSpecies,
  localPos: readonly [number, number, number],
  state: Pick<BeastMotionSlotState, "action" | "progress" | "clock">,
): [number, number, number] {
  const p = BEAST_MOTION_PROFILES[species];
  const [x, y, z] = localPos;
  const heightNorm = Math.min(1, Math.max(0, y / Math.max(0.4, p.height)));
  const grounded = p.archetype === "floating" ? 1 : smoothstepCpu(0.06, 0.32, heightNorm);
  const upper = smoothstepCpu(0.28, 0.85, heightNorm);
  const absX = Math.abs(x);
  const wingMask = smoothstepCpu(0.14, 0.36, absX) * smoothstepCpu(0.18, 0.5, heightNorm);
  const tailMask = smoothstepCpu(-0.08, -0.34, z) * smoothstepCpu(0.05, 0.4, heightNorm);
  const t = state.clock;

  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (state.action === "death") {
    const fall = smoothstepCpu(0, 0.78, state.progress);
    const angle = fall * 1.42;
    const pivotY = Math.max(0, y - 0.04);
    const rotY = pivotY * Math.cos(angle) - z * Math.sin(angle);
    const rotZ = pivotY * Math.sin(angle) + z * Math.cos(angle);
    const settle = state.progress > 0.78 ? Math.sin(((state.progress - 0.78) / 0.22) * Math.PI) * 0.015 : 0;
    dx = fall * 0.05 * upper;
    dy = (rotY - pivotY) * grounded - fall * 0.06 * grounded + settle * grounded;
    dz = (rotZ - z) * grounded - fall * 0.1 * grounded;
    return [dx, dy, dz];
  }

  const breathWave = Math.sin(t * p.breathSpeed * 2.1);
  const swayWave = Math.sin(t * p.breathSpeed * 1.15);
  dy += breathWave * p.breathAmp * grounded;
  dx += swayWave * p.swayAmp * upper;

  if (p.archetype === "winged") {
    const flapFreq = state.action === "attack" ? 10.5 : 4.2;
    const flapBoost = state.action === "attack" ? 1.55 : 1.0;
    const flap = Math.sin(t * flapFreq - absX * 2.2) * p.wingAmp * flapBoost * wingMask;
    dy += flap + Math.sin(t * 1.7) * p.hoverAmp;
    dx += Math.sin(t * 2.4 - z * 4.5) * p.tailAmp * tailMask;
  } else if (p.archetype === "serpentine") {
    dx += Math.sin(t * 2.8 - z * 5.2) * p.tailAmp * (tailMask + upper * 0.45);
    dz += Math.cos(t * 2.1) * 0.018 * upper;
  } else if (p.archetype === "floating") {
    dy += Math.sin(t * 1.85) * p.hoverAmp;
    dx += Math.sin(t * 2.6 + y * 3.8) * p.tailAmp * (1 - heightNorm * 0.45);
    dz += Math.cos(t * 1.45 + y * 2.4) * p.swayAmp * 0.65;
  } else if (p.archetype === "brute") {
    const armMask = smoothstepCpu(0.16, 0.38, absX) * smoothstepCpu(0.32, 0.78, heightNorm);
    dz += Math.sin(t * p.breathSpeed * 1.15) * (x >= 0 ? 1 : -1) * 0.042 * armMask;
    dy += Math.cos(t * p.breathSpeed * 2.1) * 0.018 * armMask;
  } else if (p.archetype === "tails") {
    dx += Math.sin(t * 3.4 - z * 5.6 + absX * 2.5) * p.tailAmp * tailMask;
    dy += Math.cos(t * 2.9 - z * 4.2) * p.tailAmp * 0.45 * tailMask;
  }

  if (state.action === "attack") {
    const pr = Math.min(1, Math.max(0, state.progress));
    const windup = smoothstepCpu(0, 0.3, pr) * (1 - smoothstepCpu(0.3, 0.5, pr));
    const strike = smoothstepCpu(0.28, 0.52, pr) * (1 - smoothstepCpu(0.58, 0.96, pr));
    const pitch = -windup * 0.24 + strike * 0.42;
    const pivotY = Math.max(0, y - 0.12);
    const lungedZ = pivotY * Math.sin(pitch) + strike * 0.24 - windup * 0.1;
    const lungedY = pivotY * (Math.cos(pitch) - 1) + windup * 0.08 - strike * 0.04;
    dz += lungedZ * grounded;
    dy += lungedY * grounded;
    dx += strike * 0.045 * upper;
  } else if (state.action === "hit") {
    const pr = Math.min(1, Math.max(0, state.progress));
    const flinch = Math.sin(pr * Math.PI) * Math.exp(-pr * 1.4);
    const shudder = Math.sin(pr * Math.PI * 6) * flinch * 0.032;
    dz -= flinch * 0.18 * grounded;
    dy -= flinch * 0.045 * upper;
    dx += shudder * grounded;
  }

  return [dx, dy, dz];
}

export function createBeastMotionNode(
  species: FrontierSpecies,
  clockNode: Node<"float">,
  drivenByController: Node<"float">,
) {
  const p = BEAST_MOTION_PROFILES[species];
  const motion = attribute<"vec4">("beastMotion", "vec4");
  const idle = attribute<"vec3">("beastIdle", "vec3");
  const fallbackPhase = float(instanceIndex).mul(GOLDEN_PHASE);

  const actionCode = motion.x;
  const progress = motion.y;
  const t = mix(clockNode.add(fallbackPhase), motion.z, drivenByController);

  const pos = positionGeometry;
  const heightNorm = pos.y.div(Math.max(0.4, p.height)).clamp(0, 1);
  const grounded = p.archetype === "floating" ? float(1) : smoothstep(0.06, 0.32, heightNorm);
  const upper = smoothstep(0.28, 0.85, heightNorm);
  const absX = abs(pos.x);
  const wingMask = smoothstep(0.14, 0.36, absX).mul(smoothstep(0.18, 0.5, heightNorm));
  const tailMask = smoothstep(-0.08, -0.34, pos.z).mul(smoothstep(0.05, 0.4, heightNorm));

  const breathSpeed = select(idle.y.greaterThan(0.05), idle.y, float(p.breathSpeed));
  const breathWave = sin(t.mul(breathSpeed).mul(2.1));
  const swayWave = sin(t.mul(breathSpeed).mul(1.15));

  const baseDy = breathWave.mul(p.breathAmp).mul(grounded);
  const baseDx = swayWave.mul(p.swayAmp).mul(upper);

  const isAttack = actionCode.greaterThan(0.5).and(actionCode.lessThan(1.5));
  const isHit = actionCode.greaterThan(1.5).and(actionCode.lessThan(2.5));
  const isDeath = actionCode.greaterThan(2.5);

  const archCode = ARCHETYPE_CODES[p.archetype];
  let archDx: Node<"float"> = float(0);
  let archDy: Node<"float"> = float(0);
  let archDz: Node<"float"> = float(0);

  if (archCode === ARCHETYPE_CODES.winged) {
    const flapFreq = select(isAttack, float(10.5), float(4.2));
    const flapBoost = select(isAttack, float(1.55), float(1.0));
    const flap = sin(t.mul(flapFreq).sub(absX.mul(2.2)))
      .mul(p.wingAmp)
      .mul(flapBoost)
      .mul(wingMask);
    archDy = flap.add(sin(t.mul(1.7)).mul(p.hoverAmp));
    archDx = sin(t.mul(2.4).sub(pos.z.mul(4.5)))
      .mul(p.tailAmp)
      .mul(tailMask);
  } else if (archCode === ARCHETYPE_CODES.serpentine) {
    archDx = sin(t.mul(2.8).sub(pos.z.mul(5.2)))
      .mul(p.tailAmp)
      .mul(tailMask.add(upper.mul(0.45)));
    archDz = cos(t.mul(2.1)).mul(0.018).mul(upper);
  } else if (archCode === ARCHETYPE_CODES.floating) {
    archDy = sin(t.mul(1.85)).mul(p.hoverAmp);
    archDx = sin(t.mul(2.6).add(pos.y.mul(3.8)))
      .mul(p.tailAmp)
      .mul(float(1).sub(heightNorm.mul(0.45)));
    archDz = cos(t.mul(1.45).add(pos.y.mul(2.4))).mul(p.swayAmp * 0.65);
  } else if (archCode === ARCHETYPE_CODES.brute) {
    const armMask = smoothstep(0.16, 0.38, absX).mul(smoothstep(0.32, 0.78, heightNorm));
    const sideSign = select(pos.x.greaterThanEqual(0), float(1), float(-1));
    archDz = sin(t.mul(breathSpeed).mul(1.15)).mul(sideSign).mul(0.042).mul(armMask);
    archDy = cos(t.mul(breathSpeed).mul(2.1)).mul(0.018).mul(armMask);
  } else {
    archDx = sin(t.mul(3.4).sub(pos.z.mul(5.6)).add(absX.mul(2.5)))
      .mul(p.tailAmp)
      .mul(tailMask);
    archDy = cos(t.mul(2.9).sub(pos.z.mul(4.2)))
      .mul(p.tailAmp * 0.45)
      .mul(tailMask);
  }

  const windup = smoothstep(0, 0.3, progress).mul(smoothstep(0.3, 0.5, progress).oneMinus());
  const strike = smoothstep(0.28, 0.52, progress).mul(smoothstep(0.58, 0.96, progress).oneMinus());
  const attackPitch = windup.mul(-0.24).add(strike.mul(0.42));
  const pivotY = max(float(0), pos.y.sub(0.12));
  const attackDz = pivotY.mul(sin(attackPitch)).add(strike.mul(0.24)).sub(windup.mul(0.1)).mul(grounded);
  const attackDy = pivotY.mul(cos(attackPitch).sub(1)).add(windup.mul(0.08)).sub(strike.mul(0.04)).mul(grounded);
  const attackDx = strike.mul(0.045).mul(upper);

  const flinch = sin(progress.mul(Math.PI)).mul(progress.mul(-1.4).exp());
  const hitDz = flinch.mul(-0.18).mul(grounded);
  const hitDy = flinch.mul(-0.045).mul(upper);
  const hitDx = sin(progress.mul(Math.PI * 6))
    .mul(flinch)
    .mul(0.032)
    .mul(grounded);

  const aliveDx = baseDx
    .add(archDx)
    .add(select(isAttack, attackDx, float(0)))
    .add(select(isHit, hitDx, float(0)));
  const aliveDy = baseDy
    .add(archDy)
    .add(select(isAttack, attackDy, float(0)))
    .add(select(isHit, hitDy, float(0)));
  const aliveDz = archDz.add(select(isAttack, attackDz, float(0))).add(select(isHit, hitDz, float(0)));

  const fall = smoothstep(0, 0.78, progress);
  const fallAngle = fall.mul(1.42);
  const fallPivot = max(float(0), pos.y.sub(0.04));
  const rotY = fallPivot.mul(cos(fallAngle)).sub(pos.z.mul(sin(fallAngle)));
  const rotZ = fallPivot.mul(sin(fallAngle)).add(pos.z.mul(cos(fallAngle)));
  const settlePhase = progress.sub(0.78).div(0.22).clamp(0, 1);
  const settle = select(progress.greaterThan(0.78), sin(settlePhase.mul(Math.PI)).mul(0.015), float(0));
  const deathDx = fall.mul(0.05).mul(upper);
  const deathDy = rotY.sub(fallPivot).mul(grounded).sub(fall.mul(0.06).mul(grounded)).add(settle.mul(grounded));
  const deathDz = rotZ.sub(pos.z).mul(grounded).sub(fall.mul(0.1).mul(grounded));

  return vec3(select(isDeath, deathDx, aliveDx), select(isDeath, deathDy, aliveDy), select(isDeath, deathDz, aliveDz));
}
