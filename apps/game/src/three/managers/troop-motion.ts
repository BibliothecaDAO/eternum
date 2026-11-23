import type Node from "three/src/nodes/core/Node.js";
import { attribute, float, instanceIndex, positionGeometry, vec3 } from "three/tsl";
import { ModelType } from "../types/army";
import {
  CPU_MOTION_OPS,
  INSTANCED_MOTION_GOLDEN_PHASE,
  InstancedMotionController,
  TSL_MOTION_OPS,
  type InstancedMotionSlotState,
  type MotionMathOps,
} from "../utils/instanced-motion";

export type AnimatedTroopKind = "scout" | "crossbow";
export type TroopShaderAction = "idle" | "march" | "attack" | "hit" | "death";
type TroopMotionSlotState = InstancedMotionSlotState<TroopShaderAction>;
export type TroopMotionController = InstancedMotionController<TroopShaderAction>;

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

export function createTroopMotionController(
  kind: AnimatedTroopKind,
  capacity: number,
  resolveLoopAction?: (index: number) => TroopShaderAction,
): TroopMotionController {
  const profile = TROOP_MOTION_PROFILES[kind];
  return new InstancedMotionController<TroopShaderAction>(
    {
      idleAction: "idle",
      actionCodes: TROOP_ACTION_CODES,
      codeToAction: CODE_TO_ACTION,
      oneShotDurations: { attack: profile.attackDuration, hit: profile.hitDuration },
      persistentDurations: { death: profile.deathDuration },
      resolveLoopAction,
    },
    capacity,
  );
}

interface TroopDisplacementInputs<T> {
  x: T;
  y: T;
  z: T;
  actionCode: T;
  progress: T;
  t: T;
  active: T;
}

function buildScoutDisplacement<T>(op: MotionMathOps<T>, input: TroopDisplacementInputs<T>): [T, T, T] {
  const { x, y, z, actionCode, progress, t, active } = input;
  const zero = op.num(0);
  const one = op.num(1);
  const heightNorm = op.clamp(op.div(y, op.num(TROOP_MOTION_PROFILES.scout.height)), 0, 1);
  const grounded = op.smoothstep(0.04, 0.24, heightNorm);
  const horseLegs = op.mul(op.smoothstep(0.54, 0.24, y), op.smoothstep(0.02, 0.14, y));
  const frontLegs = op.mul(horseLegs, op.smoothstep(-0.02, 0.14, z));
  const hindLegs = op.mul(horseLegs, op.smoothstep(0.02, -0.14, z));
  const horseNeck = op.mul(op.smoothstep(0.18, 0.44, z), op.smoothstep(0.42, 0.78, y));
  const cloakTail = op.mul(op.smoothstep(-0.14, -0.42, z), op.smoothstep(0.24, 0.75, y));
  const riderUpper = op.smoothstep(0.66, 0.98, y);

  const idleDx = op.add(
    op.mul(op.mul(op.sin(op.sub(op.mul(t, op.num(2.2)), op.mul(z, op.num(4.5)))), op.num(0.036)), cloakTail),
    op.mul(op.mul(op.sin(op.mul(t, op.num(1.35))), op.num(0.014)), riderUpper),
  );
  const idleDy = op.add(
    op.add(
      op.mul(op.mul(op.sin(op.mul(t, op.num(2.1))), op.num(0.02)), grounded),
      op.mul(op.mul(op.sin(op.add(op.mul(t, op.num(2.4)), op.num(0.6))), op.num(0.026)), horseNeck),
    ),
    op.mul(op.mul(op.cos(op.sub(op.mul(t, op.num(2.8)), op.mul(z, op.num(3.8)))), op.num(0.016)), cloakTail),
  );
  const idleDz = op.mul(op.mul(op.sin(op.mul(t, op.num(2.1))), op.num(0.016)), horseNeck);

  const gallop = op.mul(t, op.num(9.2));
  const frontSwing = op.sin(gallop);
  const hindSwing = op.sin(op.add(gallop, op.num(Math.PI * 0.85)));
  const marchDz = op.add(
    op.add(op.mul(op.mul(frontSwing, op.num(0.13)), frontLegs), op.mul(op.mul(hindSwing, op.num(0.13)), hindLegs)),
    op.mul(op.mul(op.cos(gallop), op.num(0.045)), horseNeck),
  );
  const marchDy = op.add(
    op.add(
      op.add(
        op.mul(op.mul(op.max(zero, frontSwing), op.num(0.075)), frontLegs),
        op.mul(op.mul(op.max(zero, hindSwing), op.num(0.075)), hindLegs),
      ),
      op.mul(op.mul(op.cos(gallop), op.num(0.052)), grounded),
    ),
    op.mul(op.mul(z, op.mul(op.sin(op.sub(gallop, op.num(0.35))), op.num(0.085))), grounded),
  );
  const marchDx = op.mul(
    op.mul(op.sin(op.sub(op.mul(gallop, op.num(1.35)), op.mul(z, op.num(5.2)))), op.num(0.055)),
    cloakTail,
  );

  const rear = op.mul(op.smoothstep(0, 0.3, progress), op.sub(one, op.smoothstep(0.32, 0.54, progress)));
  const lunge = op.mul(op.smoothstep(0.3, 0.56, progress), op.sub(one, op.smoothstep(0.62, 0.96, progress)));
  const attackDy = op.sub(
    op.add(
      op.mul(op.mul(op.mul(rear, op.max(zero, op.add(z, op.num(0.25)))), op.num(0.38)), grounded),
      op.mul(op.mul(rear, op.num(0.06)), riderUpper),
    ),
    op.mul(op.mul(lunge, op.num(0.03)), grounded),
  );
  const attackDz = op.add(
    op.add(op.mul(op.mul(rear, op.num(-0.08)), grounded), op.mul(op.mul(lunge, op.num(0.26)), grounded)),
    op.mul(op.mul(lunge, op.num(0.1)), riderUpper),
  );
  const attackDx = op.mul(op.mul(lunge, op.num(0.04)), riderUpper);

  const flinch = op.mul(op.sin(op.mul(progress, op.num(Math.PI))), op.exp(op.mul(progress, op.num(-1.4))));
  const hitDz = op.mul(op.mul(flinch, op.num(-0.16)), grounded);
  const hitDy = op.sub(
    op.mul(op.mul(flinch, op.num(0.04)), horseNeck),
    op.mul(op.mul(flinch, op.num(0.03)), riderUpper),
  );
  const hitDx = op.mul(op.mul(op.mul(op.sin(op.mul(progress, op.num(Math.PI * 6))), flinch), op.num(0.035)), grounded);

  const aliveDx = op.add(
    op.add(idleDx, op.selectBetween(actionCode, 0.5, 1.5, marchDx, zero)),
    op.add(op.selectBetween(actionCode, 1.5, 2.5, attackDx, zero), op.selectBetween(actionCode, 2.5, 3.5, hitDx, zero)),
  );
  const aliveDy = op.add(
    op.add(idleDy, op.selectBetween(actionCode, 0.5, 1.5, marchDy, zero)),
    op.add(op.selectBetween(actionCode, 1.5, 2.5, attackDy, zero), op.selectBetween(actionCode, 2.5, 3.5, hitDy, zero)),
  );
  const aliveDz = op.add(
    op.add(idleDz, op.selectBetween(actionCode, 0.5, 1.5, marchDz, zero)),
    op.add(op.selectBetween(actionCode, 1.5, 2.5, attackDz, zero), op.selectBetween(actionCode, 2.5, 3.5, hitDz, zero)),
  );

  const fall = op.smoothstep(0, 0.78, progress);
  const roll = op.mul(fall, op.num(1.44));
  const pivotY = op.max(zero, op.sub(y, op.num(0.05)));
  const rotY = op.sub(op.mul(pivotY, op.cos(roll)), op.mul(x, op.sin(roll)));
  const rotX = op.add(op.mul(pivotY, op.sin(roll)), op.mul(x, op.cos(roll)));
  const settlePhase = op.clamp(op.div(op.sub(progress, op.num(0.78)), op.num(0.22)), 0, 1);
  const settle = op.selectGt(progress, 0.78, op.mul(op.sin(op.mul(settlePhase, op.num(Math.PI))), op.num(0.016)), zero);
  const deathDx = op.add(op.mul(op.sub(rotX, x), grounded), op.mul(op.mul(fall, op.num(0.06)), grounded));
  const deathDy = op.add(
    op.sub(op.mul(op.sub(rotY, pivotY), grounded), op.mul(op.mul(fall, op.num(0.04)), grounded)),
    op.mul(settle, grounded),
  );
  const deathDz = op.mul(op.mul(fall, op.num(-0.08)), riderUpper);

  const dx = op.selectGt(actionCode, 3.5, deathDx, aliveDx);
  const dy = op.selectGt(actionCode, 3.5, deathDy, aliveDy);
  const dz = op.selectGt(actionCode, 3.5, deathDz, aliveDz);

  return [op.selectGt(active, 0.5, dx, zero), op.selectGt(active, 0.5, dy, zero), op.selectGt(active, 0.5, dz, zero)];
}

function buildCrossbowDisplacement<T>(op: MotionMathOps<T>, input: TroopDisplacementInputs<T>): [T, T, T] {
  const { x, y, z, actionCode, progress, t, active } = input;
  const zero = op.num(0);
  const one = op.num(1);
  const heightNorm = op.clamp(op.div(y, op.num(TROOP_MOTION_PROFILES.crossbow.height)), 0, 1);
  const grounded = op.smoothstep(0.05, 0.24, heightNorm);
  const legs = op.mul(op.smoothstep(0.05, 0.18, y), op.smoothstep(0.5, 0.28, y));
  const leftLeg = op.mul(legs, op.smoothstep(-0.02, 0.04, x));
  const rightLeg = op.mul(legs, op.smoothstep(0.02, -0.04, x));
  const upper = op.smoothstep(0.42, 0.78, y);
  const weaponFront = op.mul(op.smoothstep(0.04, 0.2, z), op.smoothstep(0.42, 0.74, y));

  const idleDx = op.mul(op.mul(op.sin(op.mul(t, op.num(1.45))), op.num(0.018)), upper);
  const idleDy = op.mul(op.mul(op.sin(op.mul(t, op.num(2.35))), op.num(0.02)), grounded);
  const idleDz = op.mul(op.mul(op.cos(op.mul(t, op.num(1.45))), op.num(0.012)), weaponFront);

  const stride = op.mul(t, op.num(7.8));
  const stepSin = op.sin(stride);
  const bob = op.mul(op.abs(op.cos(stride)), op.num(0.036));
  const marchDz = op.add(
    op.sub(op.mul(op.mul(stepSin, op.num(0.12)), leftLeg), op.mul(op.mul(stepSin, op.num(0.12)), rightLeg)),
    op.mul(upper, op.num(0.03)),
  );
  const marchDy = op.add(
    op.add(
      op.mul(op.mul(op.max(zero, stepSin), op.num(0.055)), leftLeg),
      op.mul(op.mul(op.max(zero, op.sub(zero, stepSin)), op.num(0.055)), rightLeg),
    ),
    op.mul(bob, grounded),
  );
  const marchDx = op.mul(op.mul(stepSin, op.num(-0.028)), upper);

  const aim = op.mul(op.smoothstep(0, 0.26, progress), op.sub(one, op.smoothstep(0.32, 0.44, progress)));
  const recoil = op.mul(op.smoothstep(0.3, 0.42, progress), op.sub(one, op.smoothstep(0.46, 0.85, progress)));
  const reloadDip = op.mul(op.smoothstep(0.55, 0.78, progress), op.sub(one, op.smoothstep(0.82, 0.98, progress)));
  const attackDz = op.sub(
    op.sub(op.mul(op.mul(aim, op.num(0.045)), upper), op.mul(op.mul(recoil, op.num(0.14)), upper)),
    op.mul(op.mul(recoil, op.num(0.08)), weaponFront),
  );
  const attackDy = op.sub(
    op.add(op.mul(op.mul(aim, op.num(0.025)), weaponFront), op.mul(op.mul(recoil, op.num(0.075)), weaponFront)),
    op.mul(op.mul(reloadDip, op.num(0.055)), upper),
  );

  const flinch = op.mul(op.sin(op.mul(progress, op.num(Math.PI))), op.exp(op.mul(progress, op.num(-1.4))));
  const hitDz = op.mul(op.mul(flinch, op.num(-0.17)), grounded);
  const hitDy = op.mul(op.mul(flinch, op.num(-0.04)), upper);
  const hitDx = op.mul(op.mul(op.mul(op.sin(op.mul(progress, op.num(Math.PI * 6))), flinch), op.num(0.03)), grounded);

  const aliveDx = op.add(
    op.add(idleDx, op.selectBetween(actionCode, 0.5, 1.5, marchDx, zero)),
    op.selectBetween(actionCode, 2.5, 3.5, hitDx, zero),
  );
  const aliveDy = op.add(
    op.add(idleDy, op.selectBetween(actionCode, 0.5, 1.5, marchDy, zero)),
    op.add(op.selectBetween(actionCode, 1.5, 2.5, attackDy, zero), op.selectBetween(actionCode, 2.5, 3.5, hitDy, zero)),
  );
  const aliveDz = op.add(
    op.add(idleDz, op.selectBetween(actionCode, 0.5, 1.5, marchDz, zero)),
    op.add(op.selectBetween(actionCode, 1.5, 2.5, attackDz, zero), op.selectBetween(actionCode, 2.5, 3.5, hitDz, zero)),
  );

  const fall = op.smoothstep(0, 0.78, progress);
  const angle = op.mul(fall, op.num(1.45));
  const pivotY = op.max(zero, op.sub(y, op.num(0.04)));
  const rotY = op.sub(op.mul(pivotY, op.cos(angle)), op.mul(z, op.sin(angle)));
  const rotZ = op.add(op.mul(pivotY, op.sin(angle)), op.mul(z, op.cos(angle)));
  const settlePhase = op.clamp(op.div(op.sub(progress, op.num(0.78)), op.num(0.22)), 0, 1);
  const settle = op.selectGt(progress, 0.78, op.mul(op.sin(op.mul(settlePhase, op.num(Math.PI))), op.num(0.014)), zero);
  const deathDx = op.mul(op.mul(fall, op.num(0.045)), upper);
  const deathDy = op.add(
    op.sub(op.mul(op.sub(rotY, pivotY), grounded), op.mul(op.mul(fall, op.num(0.05)), grounded)),
    op.mul(settle, grounded),
  );
  const deathDz = op.sub(op.mul(op.sub(rotZ, z), grounded), op.mul(op.mul(fall, op.num(0.09)), grounded));

  const dx = op.selectGt(actionCode, 3.5, deathDx, aliveDx);
  const dy = op.selectGt(actionCode, 3.5, deathDy, aliveDy);
  const dz = op.selectGt(actionCode, 3.5, deathDz, aliveDz);

  return [op.selectGt(active, 0.5, dx, zero), op.selectGt(active, 0.5, dy, zero), op.selectGt(active, 0.5, dz, zero)];
}

function buildTroopDisplacement<T>(
  op: MotionMathOps<T>,
  kind: AnimatedTroopKind,
  input: TroopDisplacementInputs<T>,
): [T, T, T] {
  return kind === "scout" ? buildScoutDisplacement(op, input) : buildCrossbowDisplacement(op, input);
}

export function evaluateTroopMotionDisplacement(
  kind: AnimatedTroopKind,
  localPos: readonly [number, number, number],
  state: Pick<TroopMotionSlotState, "action" | "progress" | "clock" | "active">,
): [number, number, number] {
  return buildTroopDisplacement(CPU_MOTION_OPS, kind, {
    x: localPos[0],
    y: localPos[1],
    z: localPos[2],
    actionCode: TROOP_ACTION_CODES[state.action],
    progress: state.progress,
    t: state.clock,
    active: state.active ? 1 : 0,
  });
}

export function createTroopMotionNode(kind: AnimatedTroopKind, clockNode: Node<"float">) {
  const motion = attribute<"vec4">("troopMotion", "vec4");
  const phase = float(instanceIndex).mul(INSTANCED_MOTION_GOLDEN_PHASE);
  const progress = clockNode
    .sub(motion.y)
    .div(TSL_MOTION_OPS.max(motion.z, float(0.001)))
    .clamp(0, 1);
  const [dx, dy, dz] = buildTroopDisplacement(TSL_MOTION_OPS, kind, {
    x: positionGeometry.x,
    y: positionGeometry.y,
    z: positionGeometry.z,
    actionCode: motion.x,
    progress,
    t: clockNode.add(phase),
    active: motion.w,
  });
  return vec3(dx, dy, dz);
}
