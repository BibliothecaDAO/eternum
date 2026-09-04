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

export interface HumanoidHandRigDefinition {
  digits: Readonly<Record<ProceduralHandDigitId, readonly string[]>>;
  fingerCurlAxis: Vector3Tuple;
  hand: string;
  palm: {
    index: string;
    middle: string;
    normalSign: -1 | 1;
    pinky: string;
  };
  rollCorrection: QuaternionTuple;
}

export interface HumanoidFootRigDefinition {
  ankle: string;
  toe: string;
}

type HumanoidSocketOffsetDefinition =
  | { kind: "fixed"; value: Vector3Tuple }
  | { bones: readonly string[]; kind: "knuckle-center"; scale: number };

export interface HumanoidSocketRigDefinition {
  bone: string;
  offset: HumanoidSocketOffsetDefinition;
}

export interface HumanoidRigAdapter {
  auxiliaryBones: readonly string[];
  diagnosticBones: Readonly<Record<ProceduralHumanoidJointId, string>>;
  feet: Readonly<Record<HumanoidSide, HumanoidFootRigDefinition>>;
  hands: Readonly<Record<HumanoidSide, HumanoidHandRigDefinition>>;
  id: string;
  label: string;
  partBindings: Readonly<Record<CharacterPartId, HumanoidPartBindingDefinition>>;
  sceneRotation: QuaternionTuple;
  sockets: Readonly<Record<CharacterSocketId, HumanoidSocketRigDefinition>>;
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
  HUMANOID_SIDES.forEach((side) => {
    const hand = adapter.hands[side];
    const foot = adapter.feet[side];
    if (hand) {
      addName(names, hand.hand);
      addName(names, hand.palm.index);
      addName(names, hand.palm.middle);
      addName(names, hand.palm.pinky);
      HUMANOID_DIGIT_IDS.forEach((digitId) => hand.digits[digitId]?.forEach((name) => addName(names, name)));
    }
    if (foot) {
      addName(names, foot.ankle);
      addName(names, foot.toe);
    }
  });
  HUMANOID_SOCKET_IDS.forEach((socketId) => {
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
    if (!foot?.ankle || !foot?.toe) issues.push(`missing-foot:${side}`);
    (["index", "middle", "pinky"] as const).forEach((point) => {
      if (!hand?.palm?.[point]) issues.push(`missing-palm:${side}:${point}`);
    });
    if (hand && hand.palm?.normalSign !== -1 && hand.palm?.normalSign !== 1) {
      issues.push(`invalid-palm-normal:${side}`);
    }
    HUMANOID_DIGIT_IDS.forEach((digitId) => {
      if (!hand?.digits[digitId]?.length) issues.push(`missing-digit:${side}:${digitId}`);
    });
    if (hand && !isFiniteDirection(hand.fingerCurlAxis)) issues.push(`invalid-finger-axis:${side}`);
    if (hand && !isFiniteQuaternion(hand.rollCorrection)) issues.push(`invalid-roll-correction:${side}`);
  });
  HUMANOID_SOCKET_IDS.forEach((socketId) => {
    const socket = adapter.sockets[socketId];
    if (!socket?.bone) issues.push(`missing-socket:${socketId}`);
    if (socket?.offset.kind === "fixed" && !isFiniteVector(socket.offset.value)) {
      issues.push(`invalid-socket-offset:${socketId}`);
    }
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
  if (!isFiniteQuaternion(adapter.sceneRotation)) issues.push("invalid-scene-rotation");
  if (!isFiniteDirection(adapter.stableSegmentAxes.referenceForward)) issues.push("invalid-stable-reference-axis");
  if (!isFiniteDirection(adapter.stableSegmentAxes.fallbackForward)) issues.push("invalid-stable-fallback-axis");
  return issues;
}

function addName(names: Set<string>, name: string | undefined): void {
  if (name) names.add(name);
}

function isFiniteVector(tuple: readonly number[]): boolean {
  return tuple.length === 3 && tuple.every(Number.isFinite);
}

function isFiniteDirection(tuple: readonly number[]): boolean {
  return isFiniteVector(tuple) && Math.hypot(...tuple) > 1e-8;
}

function isFiniteQuaternion(tuple: readonly number[]): boolean {
  return tuple.length === 4 && tuple.every(Number.isFinite) && Math.hypot(...tuple) > 1e-8;
}
