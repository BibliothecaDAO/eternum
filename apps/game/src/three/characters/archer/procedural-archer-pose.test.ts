import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "../procedural-character-config";
import { isProceduralCharacterPoseFinite, resolveProceduralCharacterPose } from "../procedural-character-pose";
import { resolveCharacterRig } from "../procedural-character-rig";
import { resolveProceduralArcherAim } from "./procedural-archer-aim";
import { createDefaultProceduralArcherConfig } from "./procedural-archer-config";
import { resolveProceduralArcherUpperBodyPose } from "./procedural-archer-pose";
import { createIdleProceduralArcherShotState } from "./procedural-archer-shot-cycle";

describe("procedural archer pose", () => {
  it("keeps both arms finite and aligns the drawn hands with the shot direction", () => {
    const characterConfig = { ...createDefaultProceduralCharacterConfig(), animationMode: "idle" as const };
    const archerConfig = createDefaultProceduralArcherConfig();
    const rig = resolveCharacterRig(characterConfig);
    const shotState = {
      ...createIdleProceduralArcherShotState(),
      phase: "aim" as const,
      phaseElapsedSeconds: archerConfig.aimSeconds * 0.5,
      shotGeneration: 1,
    };
    const aim = resolveProceduralArcherAim(new Vector3(0, 0, 5), archerConfig);
    const action = resolveProceduralArcherUpperBodyPose(shotState, archerConfig, aim, 0, characterConfig.seed);
    const pose = resolveProceduralCharacterPose(rig, characterConfig, 0, undefined, undefined, action);
    const leftWrist = resolveSegmentEnd(pose.parts.forearmLeft.position, pose.parts.forearmLeft.jointAnchor);
    const rightWrist = resolveSegmentEnd(pose.parts.forearmRight.position, pose.parts.forearmRight.jointAnchor);
    const leftShoulder = new Vector3().fromArray(pose.parts.upperArmLeft.jointAnchor);
    const rightShoulder = new Vector3().fromArray(pose.parts.upperArmRight.jointAnchor);
    const leftElbow = new Vector3().fromArray(pose.parts.forearmLeft.jointAnchor);
    const rightElbow = new Vector3().fromArray(pose.parts.forearmRight.jointAnchor);
    const head = new Vector3().fromArray(pose.parts.head.position);
    const handLine = leftWrist.clone().sub(rightWrist).normalize();

    expect(isProceduralCharacterPoseFinite(pose)).toBe(true);
    expect(leftWrist.distanceTo(rightWrist)).toBeGreaterThan(archerConfig.drawLength * 0.7);
    expect(handLine.dot(aim.direction)).toBeGreaterThan(0.92);
    expect(resolveJointAngle(leftShoulder, leftElbow, leftWrist)).toBeGreaterThan(70);
    expect(resolveJointAngle(rightShoulder, rightElbow, rightWrist)).toBeGreaterThan(70);
    expect(distancePointToSegment(head, rightWrist, leftWrist)).toBeGreaterThan(rig.morphology.headRadius * 0.9);
  });
});

function resolveSegmentEnd(centerTuple: readonly number[], startTuple: readonly number[]): Vector3 {
  const center = new Vector3().fromArray(centerTuple);
  const start = new Vector3().fromArray(startTuple);
  return center.multiplyScalar(2).sub(start);
}

function resolveJointAngle(start: Vector3, joint: Vector3, end: Vector3): number {
  const toStart = start.clone().sub(joint).normalize();
  const toEnd = end.clone().sub(joint).normalize();
  return (Math.acos(Math.min(1, Math.max(-1, toStart.dot(toEnd)))) * 180) / Math.PI;
}

function distancePointToSegment(point: Vector3, start: Vector3, end: Vector3): number {
  const segment = end.clone().sub(start);
  const progress = Math.min(1, Math.max(0, point.clone().sub(start).dot(segment) / segment.lengthSq()));
  return point.distanceTo(start.clone().addScaledVector(segment, progress));
}
