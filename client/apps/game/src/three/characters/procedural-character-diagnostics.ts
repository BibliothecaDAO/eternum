import { Group, Quaternion, Vector3 } from "three";

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
  bendDistance: number;
  bendForwardDot: number | null;
  frontalDeviationDegrees: number | null;
  kneeDegrees: number;
  lowerLegLength: number;
  outwardDeviationRatio: number;
  upperLegLength: number;
}

export interface ProceduralFootPoseDiagnostics {
  contact: "stance" | "swing";
  forwardDot: number | null;
  outwardProgressionDegrees: number | null;
  position: Vector3Tuple;
  progress: number;
  rotation: QuaternionTuple | null;
  toePosition: Vector3Tuple | null;
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
  footFacing?: Readonly<Record<"left" | "right", { forwardDot: number; toePosition: Vector3Tuple }>>;
  footRotations?: Readonly<Record<"left" | "right", QuaternionTuple>>;
  joints?: Partial<Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>>>;
}

const scratchWorldScale = new Vector3();
const scratchRootQuaternion = new Quaternion();
const scratchRootForward = new Vector3();
const scratchRootLateral = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);
const LOCAL_LATERAL = new Vector3(1, 0, 0);
const MINIMUM_FORWARD_BEND_DISTANCE = 0.025;
const MINIMUM_FOOT_FORWARD_DOT = 0.25;
const MINIMUM_KNEE_FORWARD_DOT = -0.1;

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
  const rootQuaternion = input.root.getWorldQuaternion(scratchRootQuaternion);
  const rootForward = scratchRootForward.copy(LOCAL_FORWARD).applyQuaternion(rootQuaternion).normalize();
  const rootLateral = scratchRootLateral.copy(LOCAL_LATERAL).applyQuaternion(rootQuaternion).normalize();
  const arms = {
    left: resolveArmDiagnostics(joints, "left", socketHands.left, solverJoints.wristLeft, headRadius),
    right: resolveArmDiagnostics(joints, "right", socketHands.right, solverJoints.wristRight, headRadius),
  } as const;
  const legs = {
    left: resolveLegDiagnostics(joints, "left", rootForward, rootLateral),
    right: resolveLegDiagnostics(joints, "right", rootForward, rootLateral),
  } as const;
  const footFacing = input.sockets?.footFacing;
  const footRotations = input.sockets?.footRotations;
  const finite =
    Object.values(joints).every((joint) => joint.every(Number.isFinite)) &&
    Object.values(footFacing ?? {}).every(
      ({ forwardDot, toePosition }) => Number.isFinite(forwardDot) && toePosition.every(Number.isFinite),
    ) &&
    Object.values(footRotations ?? {}).every((rotation) => rotation.every(Number.isFinite));
  const issues = resolvePoseIssues({ arms, feet: footFacing, finite, legs, scale });
  const rootPosition = new Vector3();
  input.root.getWorldPosition(rootPosition);
  return {
    arms,
    finite,
    feet: {
      left: resolveFootDiagnostics(
        "left",
        input.pose,
        solverJoints.ankleLeft,
        footFacing?.left,
        footRotations?.left,
        rootForward,
        rootLateral,
      ),
      right: resolveFootDiagnostics(
        "right",
        input.pose,
        solverJoints.ankleRight,
        footFacing?.right,
        footRotations?.right,
        rootForward,
        rootLateral,
      ),
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

export function resolveQuaternionAngularDistanceDegrees(left: QuaternionTuple, right: QuaternionTuple): number {
  const leftLength = Math.hypot(...left);
  const rightLength = Math.hypot(...right);
  if (leftLength <= 1e-8 || rightLength <= 1e-8) return 0;
  const dot = Math.abs(left.reduce((sum, value, index) => sum + value * right[index], 0) / (leftLength * rightLength));
  return (2 * Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
}

function resolveLegDiagnostics(
  joints: Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>>,
  side: "left" | "right",
  rootForward: Readonly<Vector3>,
  rootLateral: Readonly<Vector3>,
): ProceduralLegPoseDiagnostics {
  const suffix = side === "left" ? "Left" : "Right";
  const hip = fromTuple(joints[`hip${suffix}`]);
  const knee = fromTuple(joints[`knee${suffix}`]);
  const ankle = fromTuple(joints[`ankle${suffix}`]);
  const hipToAnkle = ankle.clone().sub(hip);
  const projection = Math.min(
    1,
    Math.max(0, knee.clone().sub(hip).dot(hipToAnkle) / Math.max(hipToAnkle.lengthSq(), 1e-8)),
  );
  const bend = knee.clone().sub(hip.clone().addScaledVector(hipToAnkle, projection));
  const bendDistance = bend.length();
  const lowerLegLength = knee.distanceTo(ankle);
  const upperLegLength = hip.distanceTo(knee);
  return {
    bendDistance: round(bendDistance),
    bendForwardDot: bendDistance > 1e-5 ? round(bend.normalize().dot(rootForward)) : null,
    frontalDeviationDegrees: resolveFrontalKneeDeviationDegrees(hip, knee, ankle, rootForward),
    kneeDegrees: round(resolveJointAngleDegrees(hip, knee, ankle)),
    lowerLegLength: round(lowerLegLength),
    outwardDeviationRatio: resolveKneeOutwardDeviationRatio(
      side,
      hip,
      knee,
      ankle,
      rootForward,
      rootLateral,
      upperLegLength + lowerLegLength,
    ),
    upperLegLength: round(upperLegLength),
  };
}

function resolveKneeOutwardDeviationRatio(
  side: "left" | "right",
  hip: Readonly<Vector3>,
  knee: Readonly<Vector3>,
  ankle: Readonly<Vector3>,
  rootForward: Readonly<Vector3>,
  rootLateral: Readonly<Vector3>,
  legLength: number,
): number {
  const hipToAnkle = new Vector3().subVectors(ankle, hip);
  const hipToKnee = new Vector3().subVectors(knee, hip);
  hipToAnkle.addScaledVector(rootForward, -hipToAnkle.dot(rootForward));
  hipToKnee.addScaledVector(rootForward, -hipToKnee.dot(rootForward));
  const projection = Math.min(1, Math.max(0, hipToKnee.dot(hipToAnkle) / Math.max(hipToAnkle.lengthSq(), 1e-8)));
  const deviation = hipToKnee.addScaledVector(hipToAnkle, -projection);
  const sideSign = side === "left" ? 1 : -1;
  return round((deviation.dot(rootLateral) * sideSign) / Math.max(legLength, 1e-8));
}

function resolveFootDiagnostics(
  side: "left" | "right",
  pose: ProceduralCharacterPose,
  ankle: Vector3Tuple,
  facing: { forwardDot: number; toePosition: Vector3Tuple } | undefined,
  rotation: QuaternionTuple | undefined,
  rootForward: Readonly<Vector3>,
  rootLateral: Readonly<Vector3>,
): ProceduralFootPoseDiagnostics {
  const cycle = pose.feet[side].cycle;
  return {
    contact: cycle.contact,
    forwardDot: facing ? round(facing.forwardDot) : null,
    outwardProgressionDegrees: facing
      ? resolveOutwardFootProgressionDegrees(side, ankle, facing.toePosition, rootForward, rootLateral)
      : null,
    position: ankle,
    progress: round(cycle.progress),
    rotation: rotation ?? null,
    toePosition: facing?.toePosition ?? null,
  };
}

function resolveOutwardFootProgressionDegrees(
  side: "left" | "right",
  ankle: Vector3Tuple,
  toe: Vector3Tuple,
  rootForward: Readonly<Vector3>,
  rootLateral: Readonly<Vector3>,
): number | null {
  const direction = fromTuple(toe).sub(fromTuple(ankle));
  const forward = direction.dot(rootForward);
  const outward = direction.dot(rootLateral) * (side === "left" ? 1 : -1);
  if (Math.hypot(forward, outward) < 1e-8) return null;
  return round((Math.atan2(outward, forward) * 180) / Math.PI);
}

function resolveFrontalKneeDeviationDegrees(
  hip: Readonly<Vector3>,
  knee: Readonly<Vector3>,
  ankle: Readonly<Vector3>,
  rootForward: Readonly<Vector3>,
): number | null {
  const toHip = new Vector3().subVectors(hip, knee);
  const toAnkle = new Vector3().subVectors(ankle, knee);
  toHip.addScaledVector(rootForward, -toHip.dot(rootForward));
  toAnkle.addScaledVector(rootForward, -toAnkle.dot(rootForward));
  if (toHip.lengthSq() < 1e-8 || toAnkle.lengthSq() < 1e-8) return null;
  const dot = Math.min(1, Math.max(-1, toHip.normalize().dot(toAnkle.normalize())));
  return round(Math.abs(180 - (Math.acos(dot) * 180) / Math.PI));
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
  feet?: Readonly<Record<"left" | "right", { forwardDot: number }>>;
  finite: boolean;
  legs: Readonly<Record<"left" | "right", ProceduralLegPoseDiagnostics>>;
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
    const leg = input.legs[side];
    if (
      leg.bendDistance > MINIMUM_FORWARD_BEND_DISTANCE * input.scale &&
      leg.bendForwardDot !== null &&
      leg.bendForwardDot < MINIMUM_KNEE_FORWARD_DOT
    ) {
      issues.push(`${side}-knee-backward`);
    }
    if (input.feet && input.feet[side].forwardDot < MINIMUM_FOOT_FORWARD_DOT) {
      issues.push(`${side}-foot-backward`);
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
