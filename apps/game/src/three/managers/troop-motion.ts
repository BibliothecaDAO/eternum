import type Node from "three/src/nodes/core/Node.js";
import { InstancedBufferAttribute, Matrix4, Vector3 } from "three";
import {
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
import { ModelType } from "../types/army";
import type { AnimationVisibilityContext } from "../types/animation";
import { isAnimationPositionVisible } from "../utils/animation-visibility";

export type AnimatedTroopKind = "scout" | "crossbow";
export type TroopShaderAction = "idle" | "march" | "attack" | "hit" | "death";

export interface TroopMotionSlotState {
  readonly action: TroopShaderAction;
  readonly progress: number;
  readonly clock: number;
  readonly active: boolean;
}

const TROOP_ACTION_CODES = {
  idle: 0,
  march: 1,
  attack: 2,
  hit: 3,
  death: 4,
} as const satisfies Record<TroopShaderAction, number>;

const CODE_TO_ACTION: readonly TroopShaderAction[] = ["idle", "march", "attack", "hit", "death"];

interface TroopMotionProfile {
  readonly height: number;
  readonly attackDuration: number;
  readonly hitDuration: number;
  readonly deathDuration: number;
}

const TROOP_MOTION_PROFILES = {
  scout: {
    height: 1.276,
    attackDuration: 0.78,
    hitDuration: 0.52,
    deathDuration: 1.05,
  },
  crossbow: {
    height: 0.981,
    attackDuration: 0.74,
    hitDuration: 0.5,
    deathDuration: 1.02,
  },
} as const satisfies Record<AnimatedTroopKind, TroopMotionProfile>;

export function resolveAnimatedTroopKind(modelType: ModelType): AnimatedTroopKind | undefined {
  if (modelType === ModelType.Paladin1) return "scout";
  if (modelType === ModelType.Crossbowman1) return "crossbow";
  return undefined;
}

const GOLDEN_PHASE = 2.399963;
const scratchPosition = new Vector3();

export class TroopMotionController {
  public readonly attribute: InstancedBufferAttribute;
  private readonly profile: TroopMotionProfile;
  private readonly positions: Float32Array;
  private readonly seeded: Uint8Array;
  private readonly capacity: number;

  constructor(kind: AnimatedTroopKind, capacity: number) {
    this.profile = TROOP_MOTION_PROFILES[kind];
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.seeded = new Uint8Array(capacity);
    this.attribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    for (let i = 0; i < capacity; i++) {
      this.attribute.setXYZW(i, TROOP_ACTION_CODES.idle, 0, i * GOLDEN_PHASE, 1);
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

  public setLocomotionAt(index: number, moving: boolean): void {
    if (index < 0 || index >= this.capacity) return;
    const current = Math.round(this.attribute.getX(index));
    if (
      current === TROOP_ACTION_CODES.attack ||
      current === TROOP_ACTION_CODES.hit ||
      current === TROOP_ACTION_CODES.death
    ) {
      return;
    }
    const desired = moving ? TROOP_ACTION_CODES.march : TROOP_ACTION_CODES.idle;
    if (current !== desired) {
      this.attribute.setX(index, desired);
      this.attribute.setY(index, 0);
      this.attribute.needsUpdate = true;
    }
  }

  public playActionAt(index: number, action: TroopShaderAction): void {
    if (index < 0 || index >= this.capacity) return;
    this.attribute.setX(index, TROOP_ACTION_CODES[action]);
    this.attribute.setY(index, 0);
    this.attribute.needsUpdate = true;
  }

  public getStateAt(index: number): TroopMotionSlotState {
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

  public update(deltaSeconds: number, activeSlots: Iterable<number>, visibility?: AnimationVisibilityContext): number {
    const dt = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    let visibleCount = 0;
    let dirty = false;
    for (const index of activeSlots) {
      if (index < 0 || index >= this.capacity) continue;
      const base = index * 3;
      scratchPosition.set(this.positions[base], this.positions[base + 1], this.positions[base + 2]);
      const visible = isAnimationPositionVisible(scratchPosition, visibility);
      const prevActive = this.attribute.getW(index) > 0.5;
      if (visible !== prevActive) {
        this.attribute.setW(index, visible ? 1 : 0);
        dirty = true;
      }
      if (!visible) continue;
      visibleCount++;
      if (dt <= 0) continue;
      const code = Math.round(this.attribute.getX(index));
      this.attribute.setZ(index, this.attribute.getZ(index) + dt);
      dirty = true;
      if (code === TROOP_ACTION_CODES.attack) {
        const nextProgress = this.attribute.getY(index) + dt / this.profile.attackDuration;
        if (nextProgress >= 1) {
          this.attribute.setX(index, TROOP_ACTION_CODES.idle);
          this.attribute.setY(index, 0);
        } else {
          this.attribute.setY(index, nextProgress);
        }
      } else if (code === TROOP_ACTION_CODES.hit) {
        const nextProgress = this.attribute.getY(index) + dt / this.profile.hitDuration;
        if (nextProgress >= 1) {
          this.attribute.setX(index, TROOP_ACTION_CODES.idle);
          this.attribute.setY(index, 0);
        } else {
          this.attribute.setY(index, nextProgress);
        }
      } else if (code === TROOP_ACTION_CODES.death) {
        this.attribute.setY(index, Math.min(1, this.attribute.getY(index) + dt / this.profile.deathDuration));
      }
    }
    if (dirty) this.attribute.needsUpdate = true;
    return visibleCount;
  }
}

function smoothstepCpu(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function evaluateTroopMotionDisplacement(
  kind: AnimatedTroopKind,
  localPos: readonly [number, number, number],
  state: Pick<TroopMotionSlotState, "action" | "progress" | "clock">,
): [number, number, number] {
  const [x, y, z] = localPos;
  const t = state.clock;
  if (kind === "scout") {
    return evaluateScoutDisplacement(x, y, z, state.action, state.progress, t);
  }
  return evaluateCrossbowDisplacement(x, y, z, state.action, state.progress, t);
}

function evaluateScoutDisplacement(
  x: number,
  y: number,
  z: number,
  action: TroopShaderAction,
  progress: number,
  t: number,
): [number, number, number] {
  const heightNorm = Math.min(1, Math.max(0, y / TROOP_MOTION_PROFILES.scout.height));
  const grounded = smoothstepCpu(0.04, 0.24, heightNorm);
  const horseLegs = smoothstepCpu(0.54, 0.24, y) * smoothstepCpu(0.02, 0.14, y);
  const frontLegs = horseLegs * smoothstepCpu(-0.02, 0.14, z);
  const hindLegs = horseLegs * smoothstepCpu(0.02, -0.14, z);
  const horseNeck = smoothstepCpu(0.18, 0.44, z) * smoothstepCpu(0.42, 0.78, y);
  const cloakTail = smoothstepCpu(-0.14, -0.42, z) * smoothstepCpu(0.24, 0.75, y);
  const riderUpper = smoothstepCpu(0.66, 0.98, y);

  if (action === "death") {
    const fall = smoothstepCpu(0, 0.78, progress);
    const roll = fall * 1.44;
    const pivotY = Math.max(0, y - 0.05);
    const rotY = pivotY * Math.cos(roll) - x * Math.sin(roll);
    const rotX = pivotY * Math.sin(roll) + x * Math.cos(roll);
    const settle = progress > 0.78 ? Math.sin(((progress - 0.78) / 0.22) * Math.PI) * 0.016 : 0;
    return [
      (rotX - x) * grounded + fall * 0.06 * grounded,
      (rotY - pivotY) * grounded - fall * 0.04 * grounded + settle * grounded,
      -fall * 0.08 * riderUpper,
    ];
  }

  let dx = Math.sin(t * 2.2 - z * 4.5) * 0.036 * cloakTail + Math.sin(t * 1.35) * 0.014 * riderUpper;
  let dy =
    Math.sin(t * 2.1) * 0.02 * grounded +
    Math.sin(t * 2.4 + 0.6) * 0.026 * horseNeck +
    Math.cos(t * 2.8 - z * 3.8) * 0.016 * cloakTail;
  let dz = Math.sin(t * 2.1) * 0.016 * horseNeck;

  if (action === "march") {
    const gallop = t * 9.2;
    const frontSwing = Math.sin(gallop);
    const hindSwing = Math.sin(gallop + Math.PI * 0.85);
    const strideBob = Math.cos(gallop) * 0.052;
    const pitch = Math.sin(gallop - 0.35) * 0.085;
    dz += frontSwing * 0.13 * frontLegs + hindSwing * 0.13 * hindLegs + Math.cos(gallop) * 0.045 * horseNeck;
    dy +=
      Math.max(0, frontSwing) * 0.075 * frontLegs +
      Math.max(0, hindSwing) * 0.075 * hindLegs +
      strideBob * grounded +
      z * pitch * grounded;
    dx += Math.sin(gallop * 1.35 - z * 5.2) * 0.055 * cloakTail;
  } else if (action === "attack") {
    const pr = Math.min(1, Math.max(0, progress));
    const rear = smoothstepCpu(0, 0.3, pr) * (1 - smoothstepCpu(0.32, 0.54, pr));
    const lunge = smoothstepCpu(0.3, 0.56, pr) * (1 - smoothstepCpu(0.62, 0.96, pr));
    const rearLift = rear * Math.max(0, z + 0.25) * 0.38;
    dy += rearLift * grounded + rear * 0.06 * riderUpper - lunge * 0.03 * grounded;
    dz += -rear * 0.08 * grounded + lunge * 0.26 * grounded + lunge * 0.1 * riderUpper;
    dx += lunge * 0.04 * riderUpper;
  } else if (action === "hit") {
    const pr = Math.min(1, Math.max(0, progress));
    const flinch = Math.sin(pr * Math.PI) * Math.exp(-pr * 1.4);
    dz -= flinch * 0.16 * grounded;
    dy += flinch * 0.04 * horseNeck - flinch * 0.03 * riderUpper;
    dx += Math.sin(pr * Math.PI * 6) * flinch * 0.035 * grounded;
  }

  return [dx, dy, dz];
}

function evaluateCrossbowDisplacement(
  x: number,
  y: number,
  z: number,
  action: TroopShaderAction,
  progress: number,
  t: number,
): [number, number, number] {
  const heightNorm = Math.min(1, Math.max(0, y / TROOP_MOTION_PROFILES.crossbow.height));
  const grounded = smoothstepCpu(0.05, 0.24, heightNorm);
  const legs = smoothstepCpu(0.05, 0.18, y) * smoothstepCpu(0.5, 0.28, y);
  const leftLeg = legs * smoothstepCpu(-0.02, 0.04, x);
  const rightLeg = legs * smoothstepCpu(0.02, -0.04, x);
  const upper = smoothstepCpu(0.42, 0.78, y);
  const weaponFront = smoothstepCpu(0.04, 0.2, z) * smoothstepCpu(0.42, 0.74, y);

  if (action === "death") {
    const fall = smoothstepCpu(0, 0.78, progress);
    const angle = fall * 1.45;
    const pivotY = Math.max(0, y - 0.04);
    const rotY = pivotY * Math.cos(angle) - z * Math.sin(angle);
    const rotZ = pivotY * Math.sin(angle) + z * Math.cos(angle);
    const settle = progress > 0.78 ? Math.sin(((progress - 0.78) / 0.22) * Math.PI) * 0.014 : 0;
    return [
      fall * 0.045 * upper,
      (rotY - pivotY) * grounded - fall * 0.05 * grounded + settle * grounded,
      (rotZ - z) * grounded - fall * 0.09 * grounded,
    ];
  }

  let dx = Math.sin(t * 1.45) * 0.018 * upper;
  let dy = Math.sin(t * 2.35) * 0.02 * grounded;
  let dz = Math.cos(t * 1.45) * 0.012 * weaponFront;

  if (action === "march") {
    const stride = t * 7.8;
    const stepSin = Math.sin(stride);
    const bob = Math.abs(Math.cos(stride)) * 0.036;
    dz += stepSin * 0.12 * leftLeg - stepSin * 0.12 * rightLeg + 0.03 * upper;
    dy += Math.max(0, stepSin) * 0.055 * leftLeg + Math.max(0, -stepSin) * 0.055 * rightLeg + bob * grounded;
    dx += -stepSin * 0.028 * upper;
  } else if (action === "attack") {
    const pr = Math.min(1, Math.max(0, progress));
    const aim = smoothstepCpu(0, 0.26, pr) * (1 - smoothstepCpu(0.32, 0.44, pr));
    const recoil = smoothstepCpu(0.3, 0.42, pr) * (1 - smoothstepCpu(0.46, 0.85, pr));
    const reloadDip = smoothstepCpu(0.55, 0.78, pr) * (1 - smoothstepCpu(0.82, 0.98, pr));
    dz += aim * 0.045 * upper - recoil * 0.14 * upper - recoil * 0.08 * weaponFront;
    dy += aim * 0.025 * weaponFront + recoil * 0.075 * weaponFront - reloadDip * 0.055 * upper;
  } else if (action === "hit") {
    const pr = Math.min(1, Math.max(0, progress));
    const flinch = Math.sin(pr * Math.PI) * Math.exp(-pr * 1.4);
    dz -= flinch * 0.17 * grounded;
    dy -= flinch * 0.04 * upper;
    dx += Math.sin(pr * Math.PI * 6) * flinch * 0.03 * grounded;
  }

  return [dx, dy, dz];
}

export function createTroopMotionNode(
  kind: AnimatedTroopKind,
  clockNode: Node<"float">,
  drivenByController: Node<"float">,
) {
  const motion = attribute<"vec4">("troopMotion", "vec4");
  const fallbackPhase = float(instanceIndex).mul(GOLDEN_PHASE);
  const actionCode = motion.x;
  const progress = motion.y;
  const t = mix(clockNode.add(fallbackPhase), motion.z, drivenByController);

  if (kind === "scout") {
    return createScoutMotionNode(actionCode, progress, t);
  }
  return createCrossbowMotionNode(actionCode, progress, t);
}

function createScoutMotionNode(actionCode: Node<"float">, progress: Node<"float">, t: Node<"float">) {
  const pos = positionGeometry;
  const heightNorm = pos.y.div(TROOP_MOTION_PROFILES.scout.height).clamp(0, 1);
  const grounded = smoothstep(0.04, 0.24, heightNorm);
  const horseLegs = smoothstep(0.54, 0.24, pos.y).mul(smoothstep(0.02, 0.14, pos.y));
  const frontLegs = horseLegs.mul(smoothstep(-0.02, 0.14, pos.z));
  const hindLegs = horseLegs.mul(smoothstep(0.02, -0.14, pos.z));
  const horseNeck = smoothstep(0.18, 0.44, pos.z).mul(smoothstep(0.42, 0.78, pos.y));
  const cloakTail = smoothstep(-0.14, -0.42, pos.z).mul(smoothstep(0.24, 0.75, pos.y));
  const riderUpper = smoothstep(0.66, 0.98, pos.y);

  const isMarch = actionCode.greaterThan(0.5).and(actionCode.lessThan(1.5));
  const isAttack = actionCode.greaterThan(1.5).and(actionCode.lessThan(2.5));
  const isHit = actionCode.greaterThan(2.5).and(actionCode.lessThan(3.5));
  const isDeath = actionCode.greaterThan(3.5);

  const idleDx = sin(t.mul(2.2).sub(pos.z.mul(4.5)))
    .mul(0.036)
    .mul(cloakTail)
    .add(sin(t.mul(1.35)).mul(0.014).mul(riderUpper));
  const idleDy = sin(t.mul(2.1))
    .mul(0.02)
    .mul(grounded)
    .add(sin(t.mul(2.4).add(0.6)).mul(0.026).mul(horseNeck))
    .add(
      cos(t.mul(2.8).sub(pos.z.mul(3.8)))
        .mul(0.016)
        .mul(cloakTail),
    );
  const idleDz = sin(t.mul(2.1)).mul(0.016).mul(horseNeck);

  const gallop = t.mul(9.2);
  const frontSwing = sin(gallop);
  const hindSwing = sin(gallop.add(Math.PI * 0.85));
  const marchDz = frontSwing
    .mul(0.13)
    .mul(frontLegs)
    .add(hindSwing.mul(0.13).mul(hindLegs))
    .add(cos(gallop).mul(0.045).mul(horseNeck));
  const marchDy = max(float(0), frontSwing)
    .mul(0.075)
    .mul(frontLegs)
    .add(max(float(0), hindSwing).mul(0.075).mul(hindLegs))
    .add(cos(gallop).mul(0.052).mul(grounded))
    .add(pos.z.mul(sin(gallop.sub(0.35)).mul(0.085)).mul(grounded));
  const marchDx = sin(gallop.mul(1.35).sub(pos.z.mul(5.2)))
    .mul(0.055)
    .mul(cloakTail);

  const rear = smoothstep(0, 0.3, progress).mul(smoothstep(0.32, 0.54, progress).oneMinus());
  const lunge = smoothstep(0.3, 0.56, progress).mul(smoothstep(0.62, 0.96, progress).oneMinus());
  const attackDy = rear
    .mul(max(float(0), pos.z.add(0.25)))
    .mul(0.38)
    .mul(grounded)
    .add(rear.mul(0.06).mul(riderUpper))
    .sub(lunge.mul(0.03).mul(grounded));
  const attackDz = rear.mul(-0.08).mul(grounded).add(lunge.mul(0.26).mul(grounded)).add(lunge.mul(0.1).mul(riderUpper));
  const attackDx = lunge.mul(0.04).mul(riderUpper);

  const flinch = sin(progress.mul(Math.PI)).mul(progress.mul(-1.4).exp());
  const hitDz = flinch.mul(-0.16).mul(grounded);
  const hitDy = flinch.mul(0.04).mul(horseNeck).sub(flinch.mul(0.03).mul(riderUpper));
  const hitDx = sin(progress.mul(Math.PI * 6))
    .mul(flinch)
    .mul(0.035)
    .mul(grounded);

  const aliveDx = idleDx
    .add(select(isMarch, marchDx, float(0)))
    .add(select(isAttack, attackDx, float(0)))
    .add(select(isHit, hitDx, float(0)));
  const aliveDy = idleDy
    .add(select(isMarch, marchDy, float(0)))
    .add(select(isAttack, attackDy, float(0)))
    .add(select(isHit, hitDy, float(0)));
  const aliveDz = idleDz
    .add(select(isMarch, marchDz, float(0)))
    .add(select(isAttack, attackDz, float(0)))
    .add(select(isHit, hitDz, float(0)));

  const fall = smoothstep(0, 0.78, progress);
  const roll = fall.mul(1.44);
  const pivotY = max(float(0), pos.y.sub(0.05));
  const rotY = pivotY.mul(cos(roll)).sub(pos.x.mul(sin(roll)));
  const rotX = pivotY.mul(sin(roll)).add(pos.x.mul(cos(roll)));
  const settlePhase = progress.sub(0.78).div(0.22).clamp(0, 1);
  const settle = select(progress.greaterThan(0.78), sin(settlePhase.mul(Math.PI)).mul(0.016), float(0));
  const deathDx = rotX.sub(pos.x).mul(grounded).add(fall.mul(0.06).mul(grounded));
  const deathDy = rotY.sub(pivotY).mul(grounded).sub(fall.mul(0.04).mul(grounded)).add(settle.mul(grounded));
  const deathDz = fall.mul(-0.08).mul(riderUpper);

  return vec3(select(isDeath, deathDx, aliveDx), select(isDeath, deathDy, aliveDy), select(isDeath, deathDz, aliveDz));
}

function createCrossbowMotionNode(actionCode: Node<"float">, progress: Node<"float">, t: Node<"float">) {
  const pos = positionGeometry;
  const heightNorm = pos.y.div(TROOP_MOTION_PROFILES.crossbow.height).clamp(0, 1);
  const grounded = smoothstep(0.05, 0.24, heightNorm);
  const legs = smoothstep(0.05, 0.18, pos.y).mul(smoothstep(0.5, 0.28, pos.y));
  const leftLeg = legs.mul(smoothstep(-0.02, 0.04, pos.x));
  const rightLeg = legs.mul(smoothstep(0.02, -0.04, pos.x));
  const upper = smoothstep(0.42, 0.78, pos.y);
  const weaponFront = smoothstep(0.04, 0.2, pos.z).mul(smoothstep(0.42, 0.74, pos.y));

  const isMarch = actionCode.greaterThan(0.5).and(actionCode.lessThan(1.5));
  const isAttack = actionCode.greaterThan(1.5).and(actionCode.lessThan(2.5));
  const isHit = actionCode.greaterThan(2.5).and(actionCode.lessThan(3.5));
  const isDeath = actionCode.greaterThan(3.5);

  const idleDx = sin(t.mul(1.45)).mul(0.018).mul(upper);
  const idleDy = sin(t.mul(2.35)).mul(0.02).mul(grounded);
  const idleDz = cos(t.mul(1.45)).mul(0.012).mul(weaponFront);

  const stride = t.mul(7.8);
  const stepSin = sin(stride);
  const bob = cos(stride).abs().mul(0.036);
  const marchDz = stepSin.mul(0.12).mul(leftLeg).sub(stepSin.mul(0.12).mul(rightLeg)).add(upper.mul(0.03));
  const marchDy = max(float(0), stepSin)
    .mul(0.055)
    .mul(leftLeg)
    .add(max(float(0), stepSin.negate()).mul(0.055).mul(rightLeg))
    .add(bob.mul(grounded));
  const marchDx = stepSin.mul(-0.028).mul(upper);

  const aim = smoothstep(0, 0.26, progress).mul(smoothstep(0.32, 0.44, progress).oneMinus());
  const recoil = smoothstep(0.3, 0.42, progress).mul(smoothstep(0.46, 0.85, progress).oneMinus());
  const reloadDip = smoothstep(0.55, 0.78, progress).mul(smoothstep(0.82, 0.98, progress).oneMinus());
  const attackDz = aim.mul(0.045).mul(upper).sub(recoil.mul(0.14).mul(upper)).sub(recoil.mul(0.08).mul(weaponFront));
  const attackDy = aim
    .mul(0.025)
    .mul(weaponFront)
    .add(recoil.mul(0.075).mul(weaponFront))
    .sub(reloadDip.mul(0.055).mul(upper));

  const flinch = sin(progress.mul(Math.PI)).mul(progress.mul(-1.4).exp());
  const hitDz = flinch.mul(-0.17).mul(grounded);
  const hitDy = flinch.mul(-0.04).mul(upper);
  const hitDx = sin(progress.mul(Math.PI * 6))
    .mul(flinch)
    .mul(0.03)
    .mul(grounded);

  const aliveDx = idleDx.add(select(isMarch, marchDx, float(0))).add(select(isHit, hitDx, float(0)));
  const aliveDy = idleDy
    .add(select(isMarch, marchDy, float(0)))
    .add(select(isAttack, attackDy, float(0)))
    .add(select(isHit, hitDy, float(0)));
  const aliveDz = idleDz
    .add(select(isMarch, marchDz, float(0)))
    .add(select(isAttack, attackDz, float(0)))
    .add(select(isHit, hitDz, float(0)));

  const fall = smoothstep(0, 0.78, progress);
  const angle = fall.mul(1.45);
  const pivotY = max(float(0), pos.y.sub(0.04));
  const rotY = pivotY.mul(cos(angle)).sub(pos.z.mul(sin(angle)));
  const rotZ = pivotY.mul(sin(angle)).add(pos.z.mul(cos(angle)));
  const settlePhase = progress.sub(0.78).div(0.22).clamp(0, 1);
  const settle = select(progress.greaterThan(0.78), sin(settlePhase.mul(Math.PI)).mul(0.014), float(0));
  const deathDx = fall.mul(0.045).mul(upper);
  const deathDy = rotY.sub(pivotY).mul(grounded).sub(fall.mul(0.05).mul(grounded)).add(settle.mul(grounded));
  const deathDz = rotZ.sub(pos.z).mul(grounded).sub(fall.mul(0.09).mul(grounded));

  return vec3(select(isDeath, deathDx, aliveDx), select(isDeath, deathDy, aliveDy), select(isDeath, deathDz, aliveDz));
}
