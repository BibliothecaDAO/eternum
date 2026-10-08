import type { ProceduralHumanoidJointId } from "./procedural-character-diagnostics";
import type { ProceduralHandDigitId } from "./procedural-character-hand-pose";
import type { QuaternionTuple, Vector3Tuple } from "./procedural-character-pose";
import { CHARACTER_PART_IDS, type CharacterPartId } from "./procedural-character-rig";
import type { CharacterSocketId } from "./procedural-character-sockets";

export type HumanoidSide = "left" | "right";

export interface HumanoidPartBindingDefinition {
  bone: string;
  childBone?: string;
  stable?: boolean;
}

interface HumanoidHandRigBase {
  hand: string;
  rollCorrection: QuaternionTuple;
}

export interface HumanoidArticulatedHandRigDefinition extends HumanoidHandRigBase {
  kind?: "articulated";
  digits: Readonly<Record<ProceduralHandDigitId, readonly string[]>>;
  fingerCurlAxis: Vector3Tuple;
  palm: {
    index: string;
    middle: string;
    normalSign: -1 | 1;
    pinky: string;
  };
}

export interface HumanoidMinimalHandRigDefinition extends HumanoidHandRigBase {
  kind: "minimal";
  palm: {
    index: Vector3Tuple;
    middle: Vector3Tuple;
    normalSign: -1 | 1;
    pinky: Vector3Tuple;
  };
}

export type HumanoidHandRigDefinition = HumanoidArticulatedHandRigDefinition | HumanoidMinimalHandRigDefinition;

export interface HumanoidFootRigDefinition {
  toeTip: string;
  soleHeight: number;
  heelLengthRatio: number;
  ankle: string;
  toe: string;
}

type HumanoidSocketOffsetDefinition =
  | { kind: "fixed"; value: Vector3Tuple }
  | { bones: readonly string[]; kind: "knuckle-center"; scale: number };

export interface HumanoidSocketRigDefinition {
  bone: string;
  offset: HumanoidSocketOffsetDefinition;
  rotationOffset?: QuaternionTuple;
}

/**
 * A joint the runtime drives from another joint's turn after posing (never keyed): `half` takes a share of the
 * followed joint's rotation, `twist` follows its swing in full and takes a share of its roll about `axis`.
 */
export type HumanoidDrivenJointDefinition =
  | { rule: "half"; bone: string; follows: string; share: number }
  | { rule: "twist"; axis: Vector3Tuple; bone: string; follows: string; share: number };

export interface HumanoidRigAdapter {
  authoredLegLength?: "chain";
  authoredUniformScale?: number;
  sourceBodyMorphology?: true;
  /** Source-body chest is the midpoint of these two joints instead of `diagnosticBones.chest`. */
  sourceBodyChestBetween?: readonly [string, string];
  measureSourceHeadRadius?: true;
  auxiliaryBones: readonly string[];
  diagnosticBones: Readonly<Record<ProceduralHumanoidJointId, string>>;
  drivenJoints?: readonly HumanoidDrivenJointDefinition[];
  feet: Readonly<Record<HumanoidSide, HumanoidFootRigDefinition>>;
  hands: Readonly<Record<HumanoidSide, HumanoidHandRigDefinition>>;
  id: string;
  label: string;
  partBindings: Readonly<Record<CharacterPartId, HumanoidPartBindingDefinition>>;
  sceneRotation: QuaternionTuple;
  sockets: Readonly<
    Record<Exclude<CharacterSocketId, "forearmLeft">, HumanoidSocketRigDefinition> &
      Partial<Record<"forearmLeft", HumanoidSocketRigDefinition>>
  >;
  stableSegmentAxes: {
    fallbackForward: Vector3Tuple;
    referenceForward: Vector3Tuple;
  };
}

const HUMANOID_JOINT_IDS: readonly ProceduralHumanoidJointId[] = [
  "ankleLeft",
  "ankleRight",
  "chest",
  "elbowLeft",
  "elbowRight",
  "head",
  "hipLeft",
  "hipRight",
  "kneeLeft",
  "kneeRight",
  "pelvis",
  "shoulderLeft",
  "shoulderRight",
  "wristLeft",
  "wristRight",
];
const HUMANOID_SIDES: readonly HumanoidSide[] = ["left", "right"];
const HUMANOID_SOCKET_IDS: readonly CharacterSocketId[] = [
  "drawRight",
  "gripLeft",
  "gripRight",
  "handLeft",
  "handRight",
  "jawAnchor",
  "projectileOrigin",
  "quiver",
];
const HUMANOID_DIGIT_IDS: readonly ProceduralHandDigitId[] = ["thumb", "index", "middle", "ring", "pinky"];

export function resolveHumanoidRigRequiredBoneNames(adapter: HumanoidRigAdapter): string[] {
  const names = new Set(adapter.auxiliaryBones);
  CHARACTER_PART_IDS.forEach((partId) => {
    const binding = adapter.partBindings[partId];
    if (binding?.bone) names.add(binding.bone);
    if (binding?.childBone) names.add(binding.childBone);
  });
  HUMANOID_JOINT_IDS.forEach((jointId) => addName(names, adapter.diagnosticBones[jointId]));
  adapter.sourceBodyChestBetween?.forEach((name) => addName(names, name));
  adapter.drivenJoints?.forEach((joint) => {
    addName(names, joint.bone);
    addName(names, joint.follows);
  });
  HUMANOID_SIDES.forEach((side) => {
    const hand = adapter.hands[side];
    const foot = adapter.feet[side];
    if (hand) {
      addName(names, hand.hand);
      if (hand.kind !== "minimal") {
        addName(names, hand.palm.index);
        addName(names, hand.palm.middle);
        addName(names, hand.palm.pinky);
        HUMANOID_DIGIT_IDS.forEach((digitId) => hand.digits[digitId]?.forEach((name) => addName(names, name)));
      }
    }
    if (foot) {
      addName(names, foot.ankle);
      addName(names, foot.toe);
      addName(names, foot.toeTip);
    }
  });
  ([...HUMANOID_SOCKET_IDS, "forearmLeft"] as const).forEach((socketId) => {
    const socket = adapter.sockets[socketId];
    if (!socket) return;
    addName(names, socket.bone);
    if (socket.offset.kind === "knuckle-center") socket.offset.bones.forEach((name) => addName(names, name));
  });
  return [...names].filter(Boolean).sort();
}

export function validateHumanoidRigAdapter(adapter: HumanoidRigAdapter): string[] {
  const issues: string[] = [];
  if (!adapter.id.trim()) issues.push("missing-adapter-id");
  if (!adapter.label.trim()) issues.push("missing-adapter-label");
  CHARACTER_PART_IDS.forEach((partId) => {
    const binding = adapter.partBindings[partId];
    if (!binding?.bone) issues.push(`missing-part:${partId}`);
    if (binding?.stable && !binding.childBone) issues.push(`missing-stable-child:${partId}`);
  });
  HUMANOID_JOINT_IDS.forEach((jointId) => {
    if (!adapter.diagnosticBones[jointId]) issues.push(`missing-diagnostic:${jointId}`);
  });
  HUMANOID_SIDES.forEach((side) => {
    const hand = adapter.hands[side];
    const foot = adapter.feet[side];
    if (!hand?.hand) issues.push(`missing-hand:${side}`);
    if (!foot?.ankle || !foot?.toe || !foot?.toeTip) issues.push(`missing-foot:${side}`);
    if (!Number.isFinite(foot?.soleHeight) || !(foot?.heelLengthRatio > 0))
      issues.push(`invalid-foot-geometry:${side}`);
    if (hand && hand.palm?.normalSign !== -1 && hand.palm?.normalSign !== 1) {
      issues.push(`invalid-palm-normal:${side}`);
    }
    if (hand?.kind === "minimal") {
      (["index", "middle", "pinky"] as const).forEach((point) => {
        if (!isFiniteVector(hand.palm?.[point])) issues.push(`invalid-palm-point:${side}:${point}`);
      });
      if (isFiniteMinimalPalm(hand.palm) && !hasUsablePalmPlane(hand.palm)) issues.push(`degenerate-palm:${side}`);
    } else {
      (["index", "middle", "pinky"] as const).forEach((point) => {
        if (!hand?.palm?.[point]) issues.push(`missing-palm:${side}:${point}`);
      });
      HUMANOID_DIGIT_IDS.forEach((digitId) => {
        if (!hand?.digits[digitId]?.length) issues.push(`missing-digit:${side}:${digitId}`);
      });
      if (hand && !isFiniteDirection(hand.fingerCurlAxis)) issues.push(`invalid-finger-axis:${side}`);
    }
    if (hand && !isFiniteQuaternion(hand.rollCorrection)) issues.push(`invalid-roll-correction:${side}`);
  });
  const chestBetween = adapter.sourceBodyChestBetween;
  if (chestBetween && (!chestBetween[0] || !chestBetween[1] || chestBetween[0] === chestBetween[1])) {
    issues.push("invalid-source-body-chest");
  }
  adapter.drivenJoints?.forEach((joint) => {
    if (!joint.bone || !joint.follows || joint.bone === joint.follows)
      issues.push(`invalid-driven-joint:${joint.bone}`);
    if (!(joint.share >= 0 && joint.share <= 1)) issues.push(`invalid-driven-share:${joint.bone}`);
    if (joint.rule === "twist" && !isFiniteDirection(joint.axis)) issues.push(`invalid-driven-axis:${joint.bone}`);
  });
  ([...HUMANOID_SOCKET_IDS, "forearmLeft"] as const).forEach((socketId) => {
    const socket = adapter.sockets[socketId];
    if (socketId === "forearmLeft" && !socket) return;
    if (!socket?.bone) issues.push(`missing-socket:${socketId}`);
    if (socket?.offset.kind === "fixed" && !isFiniteVector(socket.offset.value)) {
      issues.push(`invalid-socket-offset:${socketId}`);
    }
    if (socket?.rotationOffset && !isFiniteQuaternion(socket.rotationOffset))
      issues.push(`invalid-socket-rotation:${socketId}`);
    if (socket?.offset.kind === "knuckle-center" && socket.offset.bones.length === 0) {
      issues.push(`missing-socket-knuckles:${socketId}`);
    }
    if (
      socket?.offset.kind === "knuckle-center" &&
      (!socket.offset.bones.every((name) => name.trim().length > 0) || !Number.isFinite(socket.offset.scale))
    ) {
      issues.push(`invalid-socket-knuckles:${socketId}`);
    }
  });
  if (
    adapter.authoredUniformScale !== undefined &&
    (!Number.isFinite(adapter.authoredUniformScale) || adapter.authoredUniformScale <= 0)
  )
    issues.push("invalid-authored-uniform-scale");
  if (!isFiniteQuaternion(adapter.sceneRotation)) issues.push("invalid-scene-rotation");
  if (!isFiniteDirection(adapter.stableSegmentAxes.referenceForward)) issues.push("invalid-stable-reference-axis");
  if (!isFiniteDirection(adapter.stableSegmentAxes.fallbackForward)) issues.push("invalid-stable-fallback-axis");
  return issues;
}

function addName(names: Set<string>, name: string | undefined): void {
  if (name) names.add(name);
}

function isFiniteVector(tuple: readonly number[] | undefined): boolean {
  return (tuple?.length === 3 && tuple.every(Number.isFinite)) || false;
}

function isFiniteMinimalPalm(palm: HumanoidMinimalHandRigDefinition["palm"]): boolean {
  return isFiniteVector(palm?.index) && isFiniteVector(palm?.middle) && isFiniteVector(palm?.pinky);
}

function hasUsablePalmPlane(palm: HumanoidMinimalHandRigDefinition["palm"]): boolean {
  const [ix, iy, iz] = palm.index;
  const [mx, my, mz] = palm.middle;
  const [px, py, pz] = palm.pinky;
  const ax = ix - px;
  const ay = iy - py;
  const az = iz - pz;
  const crossLength = Math.hypot(ay * mz - az * my, az * mx - ax * mz, ax * my - ay * mx);
  return Math.hypot(mx, my, mz) > 1e-8 && crossLength > 1e-8;
}

function isFiniteDirection(tuple: readonly number[]): boolean {
  return isFiniteVector(tuple) && Math.hypot(...tuple) > 1e-8;
}

function isFiniteQuaternion(tuple: readonly number[]): boolean {
  return tuple.length === 4 && tuple.every(Number.isFinite) && Math.hypot(...tuple) > 1e-8;
}
