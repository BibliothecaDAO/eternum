import { Group, Vector3 } from "three";

import { HORSE_HOOF_IDS, type HorseHoofId } from "./procedural-horse-gait";
import type { ProceduralHorsePose } from "./procedural-horse-pose";
import type { HorseVector3Tuple } from "./procedural-horse-rig";

export interface ProceduralHorseLegPoseDiagnostics {
  bendAlignment: number;
  contact: "stance" | "swing";
  hoofWorld: HorseVector3Tuple;
  jointAnglesDegrees: readonly number[];
  jointsWorld: readonly HorseVector3Tuple[];
}

export interface ProceduralHorsePoseDiagnostics {
  finite: boolean;
  gait: ProceduralHorsePose["gait"];
  headWorld: HorseVector3Tuple;
  issues: readonly string[];
  legs: Readonly<Record<HorseHoofId, ProceduralHorseLegPoseDiagnostics>>;
  phase: number;
  saddleWorld: HorseVector3Tuple;
  stanceHoofCount: number;
}

export function resolveProceduralHorsePoseDiagnostics(
  pose: ProceduralHorsePose,
  root: Group,
): ProceduralHorsePoseDiagnostics {
  root.updateWorldMatrix(true, false);
  const legs = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => [hoofId, resolveHorseLegDiagnostics(pose, root, hoofId)]),
  ) as Record<HorseHoofId, ProceduralHorseLegPoseDiagnostics>;
  const headWorld = toWorldTuple(root, pose.headPosition);
  const saddleWorld = toWorldTuple(root, pose.saddlePosition);
  const finite =
    Number.isFinite(pose.phase) &&
    headWorld.every(Number.isFinite) &&
    saddleWorld.every(Number.isFinite) &&
    Object.values(legs).every(
      ({ hoofWorld, jointsWorld }) =>
        hoofWorld.every(Number.isFinite) && jointsWorld.every((joint) => joint.every(Number.isFinite)),
    );
  const issues = resolveHorsePoseIssues(legs, finite);
  return {
    finite,
    gait: pose.gait,
    headWorld,
    issues,
    legs,
    phase: round(pose.phase),
    saddleWorld,
    stanceHoofCount: Object.values(legs).filter(({ contact }) => contact === "stance").length,
  };
}

function resolveHorseLegDiagnostics(
  pose: ProceduralHorsePose,
  root: Group,
  hoofId: HorseHoofId,
): ProceduralHorseLegPoseDiagnostics {
  const leg = pose.legs[hoofId];
  const jointsWorld = leg.joints.map((joint) => toWorldTuple(root, joint));
  const hoofWorld = toWorldTuple(root, leg.hoofTarget);
  const anglePoints = [...jointsWorld, hoofWorld];
  return {
    bendAlignment: round(leg.bendAlignment),
    contact: leg.cycle.contact,
    hoofWorld,
    jointAnglesDegrees: anglePoints
      .slice(1, -1)
      .map((joint, index) => round(resolveJointAngleDegrees(anglePoints[index], joint, anglePoints[index + 2]))),
    jointsWorld,
  };
}

function resolveHorsePoseIssues(
  legs: Readonly<Record<HorseHoofId, ProceduralHorseLegPoseDiagnostics>>,
  finite: boolean,
): string[] {
  const issues: string[] = [];
  if (!finite) issues.push("horse-non-finite-joint");
  HORSE_HOOF_IDS.forEach((hoofId) => {
    if (legs[hoofId].bendAlignment < 0) issues.push(`${hoofId}-bend-inverted`);
  });
  return issues;
}

function resolveJointAngleDegrees(start: HorseVector3Tuple, joint: HorseVector3Tuple, end: HorseVector3Tuple): number {
  const toStart = new Vector3(...start).sub(new Vector3(...joint)).normalize();
  const toEnd = new Vector3(...end).sub(new Vector3(...joint)).normalize();
  return (Math.acos(Math.min(1, Math.max(-1, toStart.dot(toEnd)))) * 180) / Math.PI;
}

function toWorldTuple(root: Group, tuple: HorseVector3Tuple): HorseVector3Tuple {
  const world = root.localToWorld(new Vector3(...tuple));
  return [round(world.x), round(world.y), round(world.z)];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
