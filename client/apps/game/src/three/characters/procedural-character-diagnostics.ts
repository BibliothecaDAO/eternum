import { Group, Vector3 } from "three";

import type { ProceduralCharacterPose, QuaternionTuple, Vector3Tuple } from "./procedural-character-pose";
import type { ResolvedCharacterRig } from "./procedural-character-rig";

export type ProceduralHumanoidJointId =
  | "ankleLeft"
  | "ankleRight"
  | "chest"
  | "elbowLeft"
  | "elbowRight"
  | "head"
  | "hipLeft"
  | "hipRight"
  | "kneeLeft"
  | "kneeRight"
  | "pelvis"
  | "shoulderLeft"
  | "shoulderRight"
  | "wristLeft"
  | "wristRight";

export interface ProceduralArmPoseDiagnostics {
  elbowDegrees: number;
  forearmLength: number;
  handHeadClearance: number | null;
  solverSocketError: number | null;
  upperArmLength: number;
}

export interface ProceduralLegPoseDiagnostics {
  kneeDegrees: number;
  lowerLegLength: number;
  upperLegLength: number;
}

export interface ProceduralFootPoseDiagnostics {
  contact: "stance" | "swing";
  position: Vector3Tuple;
  progress: number;
}

export interface ProceduralCharacterPoseDiagnostics {
  arms: Readonly<Record<"left" | "right", ProceduralArmPoseDiagnostics>>;
  finite: boolean;
  feet: Readonly<Record<"left" | "right", ProceduralFootPoseDiagnostics>>;
  headRadius: number;
  issues: readonly string[];
  joints: Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>>;
  jawAnchor: Vector3Tuple | null;
  legs: Readonly<Record<"left" | "right", ProceduralLegPoseDiagnostics>>;
  palmInwardDot: Readonly<Record<"left" | "right", number>>;
  phase: number;
  rootPosition: Vector3Tuple;
  rotations: Readonly<Record<"chest" | "head" | "pelvis", QuaternionTuple>>;
  scale: number;
  socketDrawGripRight: Vector3Tuple | null;
  solverWristTargets: Readonly<Record<"left" | "right", Vector3Tuple>>;
  socketGrips: Readonly<Record<"left" | "right", Vector3Tuple | null>>;
  socketHands: Readonly<Record<"left" | "right", Vector3Tuple | null>>;
}

export interface ProceduralCharacterDiagnosticSockets {
  drawRight?: Readonly<Vector3>;
  gripLeft?: Readonly<Vector3>;
  gripRight?: Readonly<Vector3>;
  handLeft?: Readonly<Vector3>;
  handRight?: Readonly<Vector3>;
  jawAnchor?: Readonly<Vector3>;
  joints?: Partial<Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>>>;
}

const scratchWorldScale = new Vector3();

export function resolveProceduralCharacterPoseDiagnostics(input: {
  leftPalmInwardDot: number;
  pose: ProceduralCharacterPose;
  rig: ResolvedCharacterRig;
  rightPalmInwardDot: number;
  root: Group;
  sockets?: ProceduralCharacterDiagnosticSockets;
}): ProceduralCharacterPoseDiagnostics {
  input.root.updateWorldMatrix(true, false);
  const scale = resolveWorldScale(input.root);
  const solverJoints = resolveWorldJoints(input.pose, input.root);
  const joints = { ...solverJoints, ...input.sockets?.joints };
  const socketHands = {
    left: input.sockets?.handLeft ? toTuple(input.sockets.handLeft) : null,
    right: input.sockets?.handRight ? toTuple(input.sockets.handRight) : null,
  } as const;
  const socketGrips = {
    left: input.sockets?.gripLeft ? toTuple(input.sockets.gripLeft) : null,
    right: input.sockets?.gripRight ? toTuple(input.sockets.gripRight) : null,
  } as const;
  const headRadius = input.rig.morphology.headRadius * scale;
  const arms = {
    left: resolveArmDiagnostics(joints, "left", socketHands.left, solverJoints.wristLeft, headRadius),
    right: resolveArmDiagnostics(joints, "right", socketHands.right, solverJoints.wristRight, headRadius),
  } as const;
  const legs = {
    left: resolveLegDiagnostics(joints, "left"),
    right: resolveLegDiagnostics(joints, "right"),
  } as const;
  const finite = Object.values(joints).every((joint) => joint.every(Number.isFinite));
  const issues = resolvePoseIssues({ arms, finite, scale });
  const rootPosition = new Vector3();
  input.root.getWorldPosition(rootPosition);
  return {
    arms,
    finite,
    feet: {
      left: {
        contact: input.pose.feet.left.cycle.contact,
        position: solverJoints.ankleLeft,
        progress: round(input.pose.feet.left.cycle.progress),
      },
      right: {
        contact: input.pose.feet.right.cycle.contact,
        position: solverJoints.ankleRight,
        progress: round(input.pose.feet.right.cycle.progress),
      },
    },
    headRadius: round(headRadius),
    issues,
    jawAnchor: input.sockets?.jawAnchor ? toTuple(input.sockets.jawAnchor) : null,
    joints,
    legs,
    palmInwardDot: {
      left: round(input.leftPalmInwardDot),
      right: round(input.rightPalmInwardDot),
    },
    phase: round(input.pose.phase),
    rootPosition: toTuple(rootPosition),
    rotations: {
      chest: input.pose.parts.chest.quaternion,
      head: input.pose.parts.head.quaternion,
      pelvis: input.pose.parts.pelvis.quaternion,
    },
    scale: round(scale),
    socketDrawGripRight: input.sockets?.drawRight ? toTuple(input.sockets.drawRight) : null,
    solverWristTargets: { left: solverJoints.wristLeft, right: solverJoints.wristRight },
    socketGrips,
    socketHands,
  };
}

function resolveLegDiagnostics(
  joints: Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>>,
  side: "left" | "right",
): ProceduralLegPoseDiagnostics {
  const suffix = side === "left" ? "Left" : "Right";
  const hip = fromTuple(joints[`hip${suffix}`]);
  const knee = fromTuple(joints[`knee${suffix}`]);
  const ankle = fromTuple(joints[`ankle${suffix}`]);
  return {
    kneeDegrees: round(resolveJointAngleDegrees(hip, knee, ankle)),
    lowerLegLength: round(knee.distanceTo(ankle)),
    upperLegLength: round(hip.distanceTo(knee)),
  };
}

function resolveWorldJoints(
  pose: ProceduralCharacterPose,
  root: Group,
): Record<ProceduralHumanoidJointId, Vector3Tuple> {
  const local = {
    ankleLeft: resolveSegmentEndpoint(pose, "shinLeft"),
    ankleRight: resolveSegmentEndpoint(pose, "shinRight"),
    chest: fromTuple(pose.parts.chest.position),
    elbowLeft: fromTuple(pose.parts.forearmLeft.jointAnchor),
    elbowRight: fromTuple(pose.parts.forearmRight.jointAnchor),
    head: fromTuple(pose.parts.head.position),
    hipLeft: fromTuple(pose.parts.thighLeft.jointAnchor),
    hipRight: fromTuple(pose.parts.thighRight.jointAnchor),
    kneeLeft: fromTuple(pose.parts.shinLeft.jointAnchor),
    kneeRight: fromTuple(pose.parts.shinRight.jointAnchor),
    pelvis: fromTuple(pose.parts.pelvis.position),
    shoulderLeft: fromTuple(pose.parts.upperArmLeft.jointAnchor),
    shoulderRight: fromTuple(pose.parts.upperArmRight.jointAnchor),
    wristLeft: resolveSegmentEndpoint(pose, "forearmLeft"),
    wristRight: resolveSegmentEndpoint(pose, "forearmRight"),
  } satisfies Record<ProceduralHumanoidJointId, Vector3>;
  return Object.fromEntries(
    Object.entries(local).map(([id, position]) => [id, toTuple(root.localToWorld(position))]),
  ) as Record<ProceduralHumanoidJointId, Vector3Tuple>;
}

function resolveArmDiagnostics(
  joints: Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>>,
  side: "left" | "right",
  socketHand: Vector3Tuple | null,
  solverWristTarget: Vector3Tuple,
  headRadius: number,
): ProceduralArmPoseDiagnostics {
  const suffix = side === "left" ? "Left" : "Right";
  const shoulder = fromTuple(joints[`shoulder${suffix}`]);
  const elbow = fromTuple(joints[`elbow${suffix}`]);
  const wrist = fromTuple(joints[`wrist${suffix}`]);
  const head = fromTuple(joints.head);
  return {
    elbowDegrees: round(resolveJointAngleDegrees(shoulder, elbow, wrist)),
    forearmLength: round(elbow.distanceTo(wrist)),
    handHeadClearance: socketHand ? round(fromTuple(socketHand).distanceTo(head) - headRadius) : null,
    solverSocketError: socketHand ? round(fromTuple(socketHand).distanceTo(fromTuple(solverWristTarget))) : null,
    upperArmLength: round(shoulder.distanceTo(elbow)),
  };
}

function resolvePoseIssues(input: {
  arms: Readonly<Record<"left" | "right", ProceduralArmPoseDiagnostics>>;
  finite: boolean;
  scale: number;
}): string[] {
  const issues: string[] = [];
  if (!input.finite) issues.push("non-finite-joint");
  (["left", "right"] as const).forEach((side) => {
    const arm = input.arms[side];
    if (arm.elbowDegrees < 8) issues.push(`${side}-elbow-overfolded`);
    if (arm.elbowDegrees > 174) issues.push(`${side}-elbow-hyperextended`);
    if (arm.handHeadClearance !== null && arm.handHeadClearance < -0.025 * input.scale) {
      issues.push(`${side}-hand-inside-head`);
    }
    if (arm.solverSocketError !== null && arm.solverSocketError > 0.3 * input.scale) {
      issues.push(`${side}-solver-socket-diverged`);
    }
  });
  return issues;
}

function resolveSegmentEndpoint(
  pose: ProceduralCharacterPose,
  partId: "forearmLeft" | "forearmRight" | "shinLeft" | "shinRight",
): Vector3 {
  const part = pose.parts[partId];
  return fromTuple(part.position).multiplyScalar(2).sub(fromTuple(part.jointAnchor));
}

function resolveJointAngleDegrees(start: Vector3, joint: Vector3, end: Vector3): number {
  const toStart = start.clone().sub(joint).normalize();
  const toEnd = end.clone().sub(joint).normalize();
  return (Math.acos(Math.min(1, Math.max(-1, toStart.dot(toEnd)))) * 180) / Math.PI;
}

function resolveWorldScale(root: Group): number {
  root.getWorldScale(scratchWorldScale);
  return (Math.abs(scratchWorldScale.x) + Math.abs(scratchWorldScale.y) + Math.abs(scratchWorldScale.z)) / 3;
}

function fromTuple(tuple: readonly [number, number, number]): Vector3 {
  return new Vector3(tuple[0], tuple[1], tuple[2]);
}

function toTuple(vector: Readonly<Vector3>): Vector3Tuple {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
