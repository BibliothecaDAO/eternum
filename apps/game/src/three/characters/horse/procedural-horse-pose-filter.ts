import { Quaternion } from "three";

import type { HorseQuaternionTuple, ProceduralHorsePose } from "./procedural-horse-pose";

/** Adds inertial overlap to axial chains while leaving body and hoof IK exact. */
export class ProceduralHorsePoseFilter {
  private readonly neckRotations: Quaternion[] = [];
  private readonly tailRotations: Quaternion[] = [];

  public apply(pose: ProceduralHorsePose, deltaSeconds: number, secondaryMotion: number): ProceduralHorsePose {
    return {
      ...pose,
      neckRotations: filterRotationChain(
        this.neckRotations,
        pose.neckRotations,
        deltaSeconds,
        secondaryMotion,
        8.5,
        0.7,
      ),
      tailRotations: filterRotationChain(
        this.tailRotations,
        pose.tailRotations,
        deltaSeconds,
        secondaryMotion,
        5.2,
        0.36,
      ),
    };
  }

  public reset(): void {
    this.neckRotations.length = 0;
    this.tailRotations.length = 0;
  }
}

function filterRotationChain(
  state: Quaternion[],
  targets: readonly HorseQuaternionTuple[],
  deltaSeconds: number,
  secondaryMotion: number,
  baseResponse: number,
  responseDrop: number,
): HorseQuaternionTuple[] {
  return targets.map((targetTuple, index) => {
    const target = new Quaternion(...targetTuple);
    const current = state[index];
    if (!current) {
      state[index] = target;
      return targetTuple;
    }
    const response = Math.max(1.8, baseResponse - index * responseDrop) / (0.65 + secondaryMotion * 0.6);
    current.slerp(target, 1 - Math.exp(-response * Math.max(0, deltaSeconds))).normalize();
    return [current.x, current.y, current.z, current.w];
  });
}
