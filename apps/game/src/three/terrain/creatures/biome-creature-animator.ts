import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const fract = (x: number): number => x - Math.floor(x);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (x: number): number => x * x * (3 - 2 * x);

interface QuadrupedProfile {
  stride: number;
  duty: number;
  extension?: number;
  nod: number;
  forage: number;
  lie?: number;
  sit?: number;
  tuck?: number;
  hop?: number;
  upright?: number;
  runStride?: number;
  undulation?: number;
  gallops?: boolean;
  gallop?: { stride: number; duty: number };
  pounces?: boolean;
}

const QUADRUPEDS: Record<string, QuadrupedProfile> = {
  goat: { stride: 0.46, duty: 0.64, extension: 0.94, nod: 0.05, forage: 1.0, lie: 0.6, gallops: true },
  fox: {
    stride: 0.5,
    duty: 0.58,
    extension: 0.92,
    nod: 0.03,
    forage: 0.75,
    sit: 0.5,
    gallops: true,
    gallop: { stride: 0.7, duty: 0.22 },
    pounces: true,
  },
  rabbit: { stride: 0.8, duty: 0.45, nod: 0, forage: 0.45, hop: 0.3, upright: 0.5, lie: 0.45, runStride: 1.8 },
  moose: { stride: 0.44, duty: 0.64, extension: 0.95, nod: 0.06, forage: 0.95, lie: 0.62, gallops: true },
  zebra: { stride: 0.46, duty: 0.64, extension: 0.95, nod: 0.06, forage: 1.15, lie: 0.62, gallops: true },
  deer: { stride: 0.46, duty: 0.64, extension: 0.95, nod: 0.05, forage: 1.1, lie: 0.62, gallops: true },
  tiger: { stride: 0.5, duty: 0.62, extension: 0.92, nod: 0.03, forage: 0.5, sit: 0.42, gallops: true },
  tortoise: { stride: 0.5, duty: 0.75, nod: 0, forage: 0.3, tuck: 0.55 },
  salamander: { stride: 0.9, duty: 0.6, nod: 0, forage: 0, undulation: 0.16 },
};
const GALLOP = { stride: 0.55, duty: 0.3, crouch: 0.06, bound: 0.045 };
const GALLOP_PHASES: Record<string, number> = {
  hindLeft: 0.5 * TAU,
  hindRight: 0.42 * TAU,
  foreLeft: 0.08 * TAU,
  foreRight: 0,
};
const RUN_FROM = 1.25;
const RUN_BY = 2.1;
const PROWL_CROUCH = 0.14;
const POUNCE = { every: 6, seconds: 1.5, crouch: 0.3, height: 1.15 };
const GAZE_REACH = 1.3;
const CYCLE_LENGTHS: Record<string, number> = {
  angler: 0.8,
  turtle: 2.2,
  crab: 0.5,
  beetle: 0.45,
  scorpion: 0.5,
  penguin: 0.36,
  toucan: 1,
};
const SPLAY_REACH = 0.5;
const SPLAY_DUTY = 0.5;
const WINGBEATS = 3.2;
export const PERCH_DROP = 0.44;
const IDLE_ACTIONS = ["forage", "watch", "rest"] as const;

export interface CreatureMotion {
  distance?: number;
  pace?: number;
  turn?: number;
  action?: string;
  lift?: number;
  gaze?: number | null;
  stealth?: boolean;
}

export interface CreatureAnimator {
  root: THREE.Object3D;
  rig: THREE.Object3D;
  profile: string;
  joints: THREE.Object3D[];
  update(time: number, motion?: CreatureMotion): THREE.Object3D;
  reset(): void;
}

interface JointBind {
  node: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface LegRig {
  hip: THREE.Object3D;
  knee: THREE.Object3D;
  front: boolean;
  rest: THREE.Vector3;
  upper: number;
  lower: number;
  bend: number;
  footHeight: number;
  phase: number;
  toGallop: number;
}

interface StanceRig {
  legLength: number;
  hipHeight: number;
  stride: number;
  raise: number;
  cycleLength: number;
  frontZ: number;
  rearZ: number;
}

export function createCreatureAnimator(root: THREE.Object3D, { seed = 0 }: { seed?: number } = {}): CreatureAnimator {
  const joints: JointBind[] = [];
  const hips: THREE.Object3D[] = [];
  let rig: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (o.userData.animation_schema === "biome-creature-v1") rig = o;
    if (o.userData.joint)
      joints.push({ node: o, position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() });
    if (o.userData.joint === "hip") hips.push(o);
  });
  if (!rig) throw new Error("This object does not contain a biome-creature-v1 hierarchy.");
  const profile = String(rig.userData.profile);
  const body = joints.find((j) => j.node.userData.joint === "body")?.node;
  if (!body) throw new Error("Creature body joint is missing.");
  const quadruped = QUADRUPEDS[profile];
  const legs = quadruped ? createLegs(hips, profile) : [];
  for (const leg of legs) leg.toGallop = turnToGallop(leg);
  const stance = legs.length > 0 && quadruped ? createStance(legs, quadruped) : null;
  const cycleLength = stance ? stance.cycleLength : CYCLE_LENGTHS[profile];
  if (!(cycleLength > 0)) throw new Error(`Creature profile has no gait: ${profile}`);
  const phaseOffset = seed * 2.399963229728653;
  const baseBody = body.position.clone();
  const groundFeet = profile === "penguin" ? createFootGrounding(body, joints) : null;
  const axis = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const delta = new THREE.Quaternion();
  const turn = (node: THREE.Object3D, key: "x" | "y" | "z", angle: number) =>
    node.quaternion.multiply(delta.setFromAxisAngle(axis[key], angle));
  const weights = { move: 0, run: 0, gazing: 0, prowl: 0, forage: 0, watch: 0, rest: 0 };
  let lastTime: number | undefined;
  let phase = phaseOffset;
  let lastDistance = 0;
  let look = 0;

  function reset(): void {
    for (const j of joints) {
      j.node.position.copy(j.position);
      j.node.quaternion.copy(j.quaternion);
      j.node.scale.copy(j.scale);
    }
  }

  function easeWeights(time: number, pace: number, action: string, gaze: number | null, stealth: boolean): void {
    const dt = lastTime === undefined ? Infinity : clamp(time - lastTime, 0, 0.1);
    lastTime = time;
    weights.move += (clamp(pace * 2, 0, 1) - weights.move) * (1 - Math.exp(-8 * dt));
    weights.run += (clamp((pace - RUN_FROM) / (RUN_BY - RUN_FROM), 0, 1) - weights.run) * (1 - Math.exp(-5 * dt));
    weights.gazing += ((gaze === null ? 0 : 1) - weights.gazing) * (1 - Math.exp(-4 * dt));
    weights.prowl += ((stealth ? 1 : 0) - weights.prowl) * (1 - Math.exp(-3 * dt));
    if (gaze !== null) look += (clamp(gaze, -GAZE_REACH, GAZE_REACH) - look) * (1 - Math.exp(-5 * dt));
    const settle = 1 - Math.exp(-2.5 * dt);
    for (const key of IDLE_ACTIONS) weights[key] += ((pace < 0.05 && action === key ? 1 : 0) - weights[key]) * settle;
  }

  function update(
    time: number,
    {
      distance = 0,
      pace = 0,
      turn: turnRate = 0,
      action = "stand",
      lift = 0,
      gaze = null,
      stealth = false,
    }: CreatureMotion = {},
  ): THREE.Object3D {
    if (![time, distance, pace, turnRate, lift, gaze ?? 0].every(Number.isFinite))
      throw new Error("Animation inputs must be finite.");
    reset();
    easeWeights(time, pace, action, gaze, stealth);
    const { move, run, gazing, prowl, forage, watch, rest } = weights;
    const galloping = quadruped && quadruped.gallops ? run : 0;
    const gallop = (quadruped && quadruped.gallop) || GALLOP;
    const walkStride = stance && quadruped ? stance.stride * (1 + ((quadruped.runStride || 1) - 1) * run) : 0;
    const strideNow = stance ? mix(walkStride, gallop.stride * stance.legLength, galloping) : 0;
    const dutyNow = quadruped ? mix(quadruped.duty, gallop.duty, galloping) : 0;
    const pounce = quadruped && quadruped.pounces ? pounceAt(time + phaseOffset) * forage : 0;
    phase += (TAU * (distance - lastDistance)) / (stance ? strideNow / dutyNow : cycleLength);
    lastDistance = distance;
    const breath = Math.sin(time * 2.3 + phaseOffset);
    const idle = Math.sin(time * 0.7 + phaseOffset);
    const scanWave = Math.sin(time * 0.55 + phaseOffset);
    const scan = Math.sign(scanWave) * Math.sqrt(Math.abs(scanWave));
    const bank = clamp(-turnRate * 0.22, -0.4, 0.4);
    const air = smooth(clamp(lift, 0, 1));
    const swims = profile === "angler" || profile === "turtle";
    const stroke = swims ? phase + time * (profile === "turtle" ? 0.9 : 1.6) : phase;
    const effort = swims ? mix(0.35, 1, move) : move;

    let rise = 0;
    let pitch = 0;
    let roll = 0;
    let wag = 0;
    let pivotZ = 0;
    if (stance && quadruped) {
      const bound = quadruped.hop ? Math.max(0, Math.sin(phase + 0.5)) : 0;
      rise = stance.raise - 0.012 * stance.legLength * move * (1 - galloping) * Math.cos(phase * 2);
      rise += (quadruped.hop || 0) * stance.legLength * move * bound;
      rise += stance.legLength * galloping * (GALLOP.bound * Math.sin(phase + 2.2) - GALLOP.crouch);
      rise -= ((quadruped.tuck || 0) + (quadruped.lie || 0)) * stance.hipHeight * rest;
      rise -= quadruped.upright ? 0.3 * stance.hipHeight * watch : 0;
      rise -= PROWL_CROUCH * stance.legLength * prowl;
      rise += stance.legLength * (pounce < 0 ? 0.12 * pounce : POUNCE.height * Math.sin(Math.PI * pounce));
      pitch = 0.012 * move * (1 - galloping) * Math.sin(phase * 2) + 0.07 * forage * Math.sign(quadruped.forage);
      pitch += 0.085 * galloping * Math.sin(phase + 0.6);
      pitch += pounce > 0 ? 1.1 * (pounce - 0.4) * Math.sin(Math.PI * pounce) : 0;
      pitch -= quadruped.hop ? 0.2 * move * Math.cos(phase + 0.5) : 0;
      pitch -= (quadruped.sit || 0) * rest + (quadruped.upright || 0) * watch;
      pivotZ = stance.rearZ * forage + (quadruped.sit ? stance.frontZ * rest : 0);
      pivotZ += quadruped.upright ? stance.rearZ * watch : 0;
      roll = 0.022 * move * Math.sin(phase);
      wag = (quadruped.undulation || 0) * move * Math.sin(phase);
    }
    if (swims) {
      rise = 0.04 * Math.sin(stroke * 0.5) + 0.07 * watch;
      pitch = 0.05 * effort * Math.sin(stroke - 1) - 0.2 * watch;
      roll = bank;
      if (profile === "angler") wag = 0.07 * effort * Math.sin(stroke);
    }
    if (profile === "penguin") {
      rise = 0.025 * move * (1 + Math.sin(phase * 2));
      roll = 0.09 * move * Math.sin(phase);
    }
    if (profile === "toucan") {
      const hop = 0.06 * move * (1 - air) * Math.abs(Math.sin(time * 9));
      rise = mix(-PERCH_DROP + 0.008 * breath + hop, 0.05 * Math.sin(time * TAU * WINGBEATS), air);
      pitch = -0.12 * air * (1 - move);
      roll = bank * air;
    }
    if (profile === "crab" || profile === "beetle" || profile === "scorpion") {
      rise = 0.012 * move * Math.sin(phase * 2) + 0.01 * breath;
      pitch = profile === "crab" ? -0.1 * watch : 0;
    }
    const pivotY = stance ? stance.hipHeight : 0;
    const cos = Math.cos(pitch);
    const sin = Math.sin(pitch);
    const offsetY = rise + pivotY - (pivotY * cos - pivotZ * sin);
    const offsetZ = pivotZ - (pivotY * sin + pivotZ * cos);
    body!.position.y = baseBody.y + offsetY;
    body!.position.z = baseBody.z + offsetZ;
    turn(body!, "x", pitch);
    turn(body!, "z", roll);
    turn(body!, "y", wag);

    for (const leg of legs) {
      const length = leg.upper + leg.lower;
      const cycle = fract((phase + leg.phase + leg.toGallop * galloping) / TAU);
      const stride = strideNow;
      let footZ: number;
      let footLift: number;
      if (cycle < dutyNow) {
        footZ = stride * (0.5 - cycle / dutyNow);
        footLift = 0;
      } else {
        const swing = (cycle - dutyNow) / (1 - dutyNow);
        const tangent = -(1 - dutyNow) / dutyNow;
        const travel = (tangent * 2 - 2) * swing ** 3 + (3 - 3 * tangent) * swing ** 2 + tangent * swing;
        footZ = stride * (-0.5 + travel);
        footLift = Math.sin(swing * Math.PI) ** 2 * length * 0.17 * move * (1 + 0.8 * galloping);
      }
      const hipY = offsetY + leg.rest.y * cos - leg.rest.z * sin;
      const hipZ = offsetZ + leg.rest.y * sin + leg.rest.z * cos;
      const gathered = pounce > 0 ? 0.6 * length * Math.sin(Math.PI * pounce) : 0;
      const reachY = leg.footHeight + footLift + gathered - hipY;
      const reachZ = leg.rest.z + footZ - hipZ;
      const localY = reachY * cos + reachZ * sin;
      const localZ = -reachY * sin + reachZ * cos;
      const d = clamp(Math.hypot(localY, localZ), Math.abs(leg.upper - leg.lower) + 0.0001, length - 0.0001);
      const aim = Math.atan2(-localZ, -localY);
      const a = Math.acos(clamp((leg.upper ** 2 + d * d - leg.lower ** 2) / (2 * leg.upper * d), -1, 1));
      const b =
        Math.PI - Math.acos(clamp((leg.upper ** 2 + leg.lower ** 2 - d * d) / (2 * leg.upper * leg.lower), -1, 1));
      const tucked = leg.front && quadruped?.upright ? watch : 0;
      leg.hip.quaternion.setFromAxisAngle(axis.x, mix(aim + leg.bend * a, -pitch - 0.5, tucked));
      leg.knee.quaternion.setFromAxisAngle(axis.x, mix(-leg.bend * b, 1.7, tucked));
    }

    for (const { node } of joints) {
      const u = node.userData;
      const side = (u.side as number | undefined) || 1;
      switch (u.joint) {
        case "neck": {
          const reach = quadruped ? quadruped.forage : profile === "penguin" ? 0.6 : profile === "toucan" ? 0.55 : 0;
          const nibble = 1 + 0.05 * Math.sin(time * 5.5 + phaseOffset);
          const nod = quadruped ? quadruped.nod * move * Math.sin(phase * 2 + 0.6) : 0.018 * move * Math.sin(phase);
          const watching = mix(0.55 * watch * scan, look, gazing);
          turn(node, "y", 0.03 * idle + watching + clamp(turnRate * 0.12, -0.3, 0.3) * move);
          const carriage = 0.3 * Math.max(galloping, prowl) - 0.1 * watch * (1 - galloping) - pitch * 0.85;
          turn(node, "x", 0.014 * breath + nod + reach * forage * nibble + carriage);
          if (quadruped && quadruped.tuck) node.position.z -= 0.22 * rest;
          break;
        }
        case "tail": {
          const segment = (u.segment as number | undefined) || 0;
          if (swims || profile === "salamander") {
            const amp = swims ? 0.2 : 0.17;
            turn(node, "y", amp * Math.sin(stroke - 0.8 - segment * 0.75) * Math.max(effort, 0.2));
          } else {
            const flick = Math.max(0, Math.sin(time * 0.9 + phaseOffset)) ** 6;
            const standing = Math.sin(time * 6 + phaseOffset - segment * 0.75) * (0.2 + 0.8 * flick);
            turn(node, "y", 0.07 * mix(standing, Math.sin(phase - segment * 0.75), move));
            turn(node, "x", segment === 0 ? 0.9 * run - 0.5 * pitch : 0);
          }
          break;
        }
        case "flipper": {
          const jointPhase = (u.phase as number | undefined) || 0;
          const power = jointPhase === 0 ? 1 : 0.4;
          const beat = profile === "turtle" ? 0.45 * power : 0.28;
          turn(node, "z", side * beat * Math.sin(stroke + jointPhase) * Math.max(effort, 0.3));
          turn(node, "x", 0.5 * beat * Math.cos(stroke + jointPhase) * Math.max(effort, 0.3));
          break;
        }
        case "lure":
          turn(node, "x", 0.09 * Math.sin(time * 1.6) + 0.12 * watch * Math.sin(time * 5));
          turn(node, "z", 0.06 * idle);
          break;
        case "splay_leg":
        case "splay_knee": {
          const cycle = fract((phase + (u.phase as number)) / TAU);
          const swing = (cycle - SPLAY_DUTY) / (1 - SPLAY_DUTY);
          const sweep = cycle < SPLAY_DUTY ? 0.5 - cycle / SPLAY_DUTY : smooth(swing) - 0.5;
          const footLift = cycle < SPLAY_DUTY ? 0 : Math.sin(swing * Math.PI) * move;
          const reach = (cycleLength * SPLAY_DUTY) / SPLAY_REACH;
          if (u.joint === "splay_knee") {
            if (profile === "crab") turn(node, "z", 0.7 * reach * sweep);
            turn(node, "z", -side * 0.25 * footLift);
          } else {
            if (profile === "crab") turn(node, "z", -0.35 * reach * sweep);
            else turn(node, "y", -side * reach * sweep);
            turn(node, "z", side * 0.28 * footLift);
          }
          break;
        }
        case "claw":
          turn(node, "x", 0.1 * Math.sin(time * 1.4 + side) - 0.45 * watch);
          turn(node, "x", 0.4 * forage * Math.max(0, Math.sin(time * 3 + side * 1.6)));
          break;
        case "pincer":
          turn(node, "y", side * (0.13 + 0.11 * Math.sin(time * 1.7 + side) + 0.2 * watch));
          break;
        case "stinger":
          turn(node, "x", 0.05 * Math.sin(time * 1.4 - (u.segment as number) * 0.5) + 0.07 * watch);
          turn(node, "y", 0.045 * Math.sin(time * 0.8 - (u.segment as number) * 0.5));
          break;
        case "wing":
          if (profile === "toucan") {
            turn(node, "y", side * 1.3 * (1 - air));
            turn(node, "z", side * mix(-0.12, 0.65 * Math.sin(time * TAU * WINGBEATS), air));
          } else {
            const stretch = rest * (0.45 + 0.25 * Math.sin(time * 9));
            turn(node, "z", side * (0.08 + 0.09 * move * Math.sin(phase) + stretch));
            turn(node, "x", 0.08 * move * Math.cos(phase));
          }
          break;
        case "bird_foot":
          if (profile === "penguin") {
            turn(node, "x", 0.27 * move * Math.sin(phase + (u.phase as number)));
            node.position.y += 0.07 * move * Math.max(0, Math.cos(phase + (u.phase as number)));
          } else {
            turn(node, "x", 0.08 * Math.sin(time * 1.6 + side) * (1 - air) + 0.5 * air);
          }
          break;
      }
    }
    root.updateMatrixWorld(true);
    if (groundFeet) {
      groundFeet();
      root.updateMatrixWorld(true);
    }
    return root;
  }
  return { root, rig, profile, joints: joints.map((j) => j.node), update, reset };
}

function createLegs(hips: THREE.Object3D[], profile: string): LegRig[] {
  return hips.flatMap((hip) => {
    const knee = hip.children.find((child) => child.userData.joint === "knee");
    if (!knee) return [];
    const front = hip.position.z > 0;
    return {
      hip,
      knee,
      front,
      rest: hip.position.clone(),
      upper: hip.userData.upperLength as number,
      lower: hip.userData.lowerLength as number,
      bend: (hip.userData.bend as number | undefined) || 1,
      footHeight: (hip.userData.footHeight as number | undefined) ?? 0.02,
      phase: profile === "rabbit" ? (front ? Math.PI : 0) : (hip.userData.phase as number),
      toGallop: 0,
    };
  });
}

function pounceAt(seconds: number): number {
  const into = (seconds % POUNCE.every) - (POUNCE.every - POUNCE.seconds);
  if (into < 0) return 0;
  const share = into / POUNCE.seconds;
  return share < POUNCE.crouch
    ? -Math.sin((Math.PI * share) / POUNCE.crouch)
    : (share - POUNCE.crouch) / (1 - POUNCE.crouch);
}

function turnToGallop(leg: LegRig): number {
  const end = leg.front ? "fore" : "hind";
  const gallop = GALLOP_PHASES[`${end}${leg.rest.x < 0 ? "Left" : "Right"}`];
  return Math.atan2(Math.sin(gallop - leg.phase), Math.cos(gallop - leg.phase));
}

function createStance(legs: LegRig[], quadruped: QuadrupedProfile): StanceRig {
  const legLength = Math.min(...legs.map((leg) => leg.upper + leg.lower));
  const hipHeight = legs.reduce((sum, leg) => sum + leg.rest.y, 0) / legs.length;
  const stride = quadruped.stride * legLength;
  const raise = quadruped.extension
    ? Math.max(
        0,
        Math.min(...legs.map((leg) => quadruped.extension! * (leg.upper + leg.lower) - (leg.rest.y - leg.footHeight))),
      )
    : 0;
  return {
    legLength,
    hipHeight,
    stride,
    raise,
    cycleLength: stride / quadruped.duty,
    frontZ: Math.max(...legs.map((leg) => leg.rest.z)),
    rearZ: Math.min(...legs.map((leg) => leg.rest.z)),
  };
}

function createFootGrounding(body: THREE.Object3D, joints: JointBind[]): () => void {
  const feet = joints.filter(({ node }) => node.userData.joint === "bird_foot").map(({ node }) => node);
  if (feet.length === 0) throw new Error("Walking bird has no feet.");
  const parentInverse = new THREE.Matrix4();
  const foot = new THREE.Vector3();
  const lowestFoot = () => {
    parentInverse.copy(body.parent!.matrixWorld).invert();
    return Math.min(...feet.map((node) => foot.setFromMatrixPosition(node.matrixWorld).applyMatrix4(parentInverse).y));
  };
  body.parent!.updateMatrixWorld(true);
  const standing = lowestFoot();
  return () => {
    body.position.y -= lowestFoot() - standing;
  };
}
