import { Quaternion } from "three";

import type { ProceduralCharacterPose, QuaternionTuple } from "./procedural-character-pose";
import type { CharacterPartId } from "./procedural-character-rig";

const FILTERED_PARTS: ReadonlyArray<{ id: CharacterPartId; response: number }> = [
  { id: "pelvis", response: 13 },
  { id: "chest", response: 9 },
  { id: "head", response: 11 },
  { id: "upperArmLeft", response: 7 },
  { id: "upperArmRight", response: 7 },
  { id: "forearmLeft", response: 5.5 },
  { id: "forearmRight", response: 5.5 },
];

/** Filters non-contact body layers without softening leg IK targets. */
export class ProceduralCharacterPoseFilter {
  private readonly rotations = new Map<CharacterPartId, Quaternion>();

  public apply(pose: ProceduralCharacterPose, deltaSeconds: number, secondaryMotion: number): ProceduralCharacterPose {
    const parts = { ...pose.parts };
    for (const { id, response } of FILTERED_PARTS) {
      const target = new Quaternion(...pose.parts[id].quaternion);
      const current = this.rotations.get(id);
      if (!current) {
        this.rotations.set(id, target);
        continue;
      }
      const rate = response / (0.65 + Math.max(0, secondaryMotion) * 0.6);
      const blend = 1 - Math.exp(-rate * Math.max(0, deltaSeconds));
      current.slerp(target, blend).normalize();
      parts[id] = { ...pose.parts[id], quaternion: toQuaternionTuple(current) };
    }
    return { ...pose, parts };
  }

  public reset(): void {
    this.rotations.clear();
  }
}

function toQuaternionTuple(quaternion: Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}
