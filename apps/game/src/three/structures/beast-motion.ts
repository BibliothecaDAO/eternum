import type Node from "three/src/nodes/core/Node.js";
import { beastOfModel, type BeastIdle } from "@bibliothecadao/types";
import { attribute, float, instanceIndex, positionGeometry, vec3 } from "three/tsl";
import {
  CPU_MOTION_OPS,
  INSTANCED_MOTION_GOLDEN_PHASE,
  InstancedMotionController,
  TSL_MOTION_OPS,
  type InstancedMotionSlotState,
  type MotionMathOps,
} from "../utils/instanced-motion";
import type { FrontierSpecies } from "./frontier-beast";

export type BeastMotionAction = "idle" | "attack" | "hit" | "death";
type BeastMotionArchetype = "winged" | "serpentine" | "floating" | "brute" | "tails";

interface BeastMotionProfile {
  readonly archetype: BeastMotionArchetype;
  readonly swayAmp: number;
  readonly wingAmp: number;
  readonly tailAmp: number;
  readonly hoverAmp: number;
  readonly attackDuration: number;
  readonly hitDuration: number;
  readonly deathDuration: number;
  readonly height: number;
}

export type BeastMotionSlotState = InstancedMotionSlotState<BeastMotionAction>;
export type BeastMotionController = InstancedMotionController<BeastMotionAction>;

const BEAST_ACTION_CODES = {
  idle: 0,
  attack: 1,
  hit: 2,
  death: 3,
} as const satisfies Record<BeastMotionAction, number>;

const CODE_TO_ACTION: readonly BeastMotionAction[] = ["idle", "attack", "hit", "death"];

const BEAST_IDLE_MOTION_CODES = {
  breath: 0,
  lift: 1,
  hover: 2,
} as const satisfies Record<BeastIdle["motion"], number>;

export function encodeBeastIdle(idle: BeastIdle): readonly [number, number, number] {
  if (idle.motion === "hover") return [BEAST_IDLE_MOTION_CODES.hover, 1.85, 0];
  return [BEAST_IDLE_MOTION_CODES[idle.motion], idle.speed, idle.height];
}

export const BEAST_MOTION_PROFILES = {
  cyclops: {
    archetype: "brute",
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

export function createBeastMotionController(species: FrontierSpecies, capacity: number): BeastMotionController {
  const profile = BEAST_MOTION_PROFILES[species];
  return new InstancedMotionController<BeastMotionAction>(
    {
      idleAction: "idle",
      actionCodes: BEAST_ACTION_CODES,
      codeToAction: CODE_TO_ACTION,
      oneShotDurations: { attack: profile.attackDuration, hit: profile.hitDuration },
      persistentDurations: { death: profile.deathDuration },
    },
    capacity,
  );
}

interface BeastDisplacementInputs<T> {
  x: T;
  y: T;
  z: T;
  actionCode: T;
  progress: T;
  t: T;
  active: T;
  idleMotion: T;
  idleSpeed: T;
  idleHeight: T;
}

function buildBeastDisplacement<T>(
  op: MotionMathOps<T>,
  p: BeastMotionProfile,
  input: BeastDisplacementInputs<T>,
): [T, T, T] {
  const { x, y, z, actionCode, progress, t, active, idleMotion, idleSpeed, idleHeight } = input;
  const zero = op.num(0);
  const one = op.num(1);
  const heightNorm = op.clamp(op.div(y, op.num(Math.max(0.4, p.height))), 0, 1);
  const isHoverOrLift = op.selectGt(idleMotion, 0.5, one, zero);
  const plantedMask = op.smoothstep(0.06, 0.32, heightNorm);
  const grounded = op.selectGt(isHoverOrLift, 0.5, one, plantedMask);
  const upper = op.smoothstep(0.28, 0.85, heightNorm);
  const absX = op.abs(x);
  const wingMask = op.mul(op.smoothstep(0.14, 0.36, absX), op.smoothstep(0.18, 0.5, heightNorm));
  const tailMask = op.mul(op.smoothstep(-0.08, -0.34, z), op.smoothstep(0.05, 0.4, heightNorm));

  const speed = op.selectGt(idleSpeed, 0.05, idleSpeed, op.num(1.2));
  const breathWave = op.sin(op.mul(op.mul(t, speed), op.num(2.1)));
  const swayWave = op.sin(op.mul(op.mul(t, speed), op.num(1.15)));
  const hoverHeight = op.num(Math.max(p.hoverAmp, 0.024));
  const idleAmp = op.selectGt(idleMotion, 1.5, hoverHeight, op.selectGt(idleHeight, 0.001, idleHeight, hoverHeight));

  const baseDy = op.mul(op.mul(breathWave, idleAmp), grounded);
  const baseDx = op.mul(op.mul(swayWave, op.num(p.swayAmp)), upper);

  let archDx = zero;
  let archDy = zero;
  let archDz = zero;

  if (p.archetype === "winged") {
    const flapFreq = op.selectBetween(actionCode, 0.5, 1.5, op.num(10.5), op.num(4.2));
    const flapBoost = op.selectBetween(actionCode, 0.5, 1.5, op.num(1.55), one);
    const flap = op.mul(
      op.mul(op.mul(op.sin(op.sub(op.mul(t, flapFreq), op.mul(absX, op.num(2.2)))), op.num(p.wingAmp)), flapBoost),
      wingMask,
    );
    archDy = op.add(flap, op.mul(op.sin(op.mul(t, op.num(1.7))), op.num(p.hoverAmp)));
    archDx = op.mul(op.mul(op.sin(op.sub(op.mul(t, op.num(2.4)), op.mul(z, op.num(4.5)))), op.num(p.tailAmp)), tailMask);
  } else if (p.archetype === "serpentine") {
    archDx = op.mul(
      op.mul(op.sin(op.sub(op.mul(t, op.num(2.8)), op.mul(z, op.num(5.2)))), op.num(p.tailAmp)),
      op.add(tailMask, op.mul(upper, op.num(0.45))),
    );
    archDz = op.mul(op.mul(op.cos(op.mul(t, op.num(2.1))), op.num(0.018)), upper);
  } else if (p.archetype === "floating") {
    archDx = op.mul(
      op.mul(op.sin(op.add(op.mul(t, op.num(2.6)), op.mul(y, op.num(3.8)))), op.num(p.tailAmp)),
      op.sub(one, op.mul(heightNorm, op.num(0.45))),
    );
    archDz = op.mul(op.cos(op.add(op.mul(t, op.num(1.45)), op.mul(y, op.num(2.4)))), op.num(p.swayAmp * 0.65));
  } else if (p.archetype === "brute") {
    const armMask = op.mul(op.smoothstep(0.16, 0.38, absX), op.smoothstep(0.32, 0.78, heightNorm));
    const sideSign = op.selectGte(x, 0, one, op.num(-1));
    archDz = op.mul(op.mul(op.mul(swayWave, sideSign), op.num(0.042)), armMask);
    archDy = op.mul(op.mul(op.cos(op.mul(op.mul(t, speed), op.num(2.1))), op.num(0.018)), armMask);
  } else {
    archDx = op.mul(
      op.mul(
        op.sin(op.add(op.sub(op.mul(t, op.num(3.4)), op.mul(z, op.num(5.6))), op.mul(absX, op.num(2.5)))),
        op.num(p.tailAmp),
      ),
      tailMask,
    );
    archDy = op.mul(
      op.mul(op.cos(op.sub(op.mul(t, op.num(2.9)), op.mul(z, op.num(4.2)))), op.num(p.tailAmp * 0.45)),
      tailMask,
    );
  }

  const windup = op.mul(op.smoothstep(0, 0.3, progress), op.sub(one, op.smoothstep(0.3, 0.5, progress)));
  const strike = op.mul(op.smoothstep(0.28, 0.52, progress), op.sub(one, op.smoothstep(0.58, 0.96, progress)));
  const attackPitch = op.add(op.mul(windup, op.num(-0.24)), op.mul(strike, op.num(0.42)));
  const pivotY = op.max(zero, op.sub(y, op.num(0.12)));
  const attackDz = op.mul(
    op.sub(op.add(op.mul(pivotY, op.sin(attackPitch)), op.mul(strike, op.num(0.24))), op.mul(windup, op.num(0.1))),
    grounded,
  );
  const attackDy = op.mul(
    op.sub(
      op.add(op.mul(pivotY, op.sub(op.cos(attackPitch), one)), op.mul(windup, op.num(0.08))),
      op.mul(strike, op.num(0.04)),
    ),
    grounded,
  );
  const attackDx = op.mul(op.mul(strike, op.num(0.045)), upper);

  const flinch = op.mul(op.sin(op.mul(progress, op.num(Math.PI))), op.exp(op.mul(progress, op.num(-1.4))));
  const hitDz = op.mul(op.mul(flinch, op.num(-0.18)), grounded);
  const hitDy = op.mul(op.mul(flinch, op.num(-0.045)), upper);
  const hitDx = op.mul(op.mul(op.mul(op.sin(op.mul(progress, op.num(Math.PI * 6))), flinch), op.num(0.032)), grounded);

  const aliveDx = op.add(
    op.add(baseDx, archDx),
    op.add(
      op.selectBetween(actionCode, 0.5, 1.5, attackDx, zero),
      op.selectBetween(actionCode, 1.5, 2.5, hitDx, zero),
    ),
  );
  const aliveDy = op.add(
    op.add(baseDy, archDy),
    op.add(
      op.selectBetween(actionCode, 0.5, 1.5, attackDy, zero),
      op.selectBetween(actionCode, 1.5, 2.5, hitDy, zero),
    ),
  );
  const aliveDz = op.add(
    archDz,
    op.add(
      op.selectBetween(actionCode, 0.5, 1.5, attackDz, zero),
      op.selectBetween(actionCode, 1.5, 2.5, hitDz, zero),
    ),
  );

  const fall = op.smoothstep(0, 0.78, progress);
  const fallAngle = op.mul(fall, op.num(1.42));
  const fallPivot = op.max(zero, op.sub(y, op.num(0.04)));
  const rotY = op.sub(op.mul(fallPivot, op.cos(fallAngle)), op.mul(z, op.sin(fallAngle)));
  const rotZ = op.add(op.mul(fallPivot, op.sin(fallAngle)), op.mul(z, op.cos(fallAngle)));
  const settlePhase = op.clamp(op.div(op.sub(progress, op.num(0.78)), op.num(0.22)), 0, 1);
  const settle = op.selectGt(progress, 0.78, op.mul(op.sin(op.mul(settlePhase, op.num(Math.PI))), op.num(0.015)), zero);
  const deathDx = op.mul(op.mul(fall, op.num(0.05)), upper);
  const deathDy = op.add(
    op.sub(op.mul(op.sub(rotY, fallPivot), grounded), op.mul(op.mul(fall, op.num(0.06)), grounded)),
    op.mul(settle, grounded),
  );
  const deathDz = op.sub(op.mul(op.sub(rotZ, z), grounded), op.mul(op.mul(fall, op.num(0.1)), grounded));

  const dx = op.selectGt(actionCode, 2.5, deathDx, aliveDx);
  const dy = op.selectGt(actionCode, 2.5, deathDy, aliveDy);
  const dz = op.selectGt(actionCode, 2.5, deathDz, aliveDz);

  return [
    op.selectGt(active, 0.5, dx, zero),
    op.selectGt(active, 0.5, dy, zero),
    op.selectGt(active, 0.5, dz, zero),
  ];
}

export function evaluateBeastMotionDisplacement(
  species: FrontierSpecies,
  localPos: readonly [number, number, number],
  state: Pick<BeastMotionSlotState, "action" | "progress" | "clock" | "active">,
  idleOverride?: BeastIdle,
): [number, number, number] {
  const [idleMotion, idleSpeed, idleHeight] = encodeBeastIdle(idleOverride ?? beastOfModel(species).idle);
  return buildBeastDisplacement(CPU_MOTION_OPS, BEAST_MOTION_PROFILES[species], {
    x: localPos[0],
    y: localPos[1],
    z: localPos[2],
    actionCode: BEAST_ACTION_CODES[state.action],
    progress: state.progress,
    t: state.clock,
    active: state.active ? 1 : 0,
    idleMotion,
    idleSpeed,
    idleHeight,
  });
}

export function createBeastMotionNode(species: FrontierSpecies, clockNode: Node<"float">) {
  const motion = attribute<"vec4">("beastMotion", "vec4");
  const idle = attribute<"vec3">("beastIdle", "vec3");
  const phase = float(instanceIndex).mul(INSTANCED_MOTION_GOLDEN_PHASE);
  const progress = clockNode.sub(motion.y).div(TSL_MOTION_OPS.max(motion.z, float(0.001))).clamp(0, 1);
  const [dx, dy, dz] = buildBeastDisplacement(TSL_MOTION_OPS, BEAST_MOTION_PROFILES[species], {
    x: positionGeometry.x,
    y: positionGeometry.y,
    z: positionGeometry.z,
    actionCode: motion.x,
    progress,
    t: clockNode.add(phase),
    active: motion.w,
    idleMotion: idle.x,
    idleSpeed: idle.y,
    idleHeight: idle.z,
  });
  return vec3(dx, dy, dz);
}
