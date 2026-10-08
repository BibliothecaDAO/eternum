import { Quaternion, Vector3 } from "three";

import type { ProceduralMeleeArmPose, ProceduralMeleeArmPoses } from "./procedural-melee-weapon-catalog";

/** How far an arm has moved on from carrying the gear: the weights of the chain carry, guard, windup, contact, follow. */
export interface ProceduralMeleeArmWeights {
  /** How far towards guard: the attack's action weight, or a guard held for another reason, whichever is more. */
  guardWeight: number;
  followThrough: number;
  strikeProgress: number;
  windupProgress: number;
}

const scratchPosition = new Vector3();
const scratchTurn = new Quaternion();

/**
 * The arm's pose for the moment: it starts at `carry` and the controller's own blend chain moves it on, guard by the
 * guard weight, then windup by the windup progress, contact by the strike progress and follow by the follow-through,
 * each of those three scaled by the guard weight. The hand's turn is blended with the same weights.
 */
export function blendProceduralMeleeArmPoses(
  poses: ProceduralMeleeArmPoses,
  weights: ProceduralMeleeArmWeights,
): ProceduralMeleeArmPose {
  const chain: readonly (readonly [ProceduralMeleeArmPose | undefined, number])[] = [
    [poses.guard, weights.guardWeight],
    [poses.windup, weights.windupProgress * weights.guardWeight],
    [poses.contact, weights.strikeProgress * weights.guardWeight],
    [poses.follow, weights.followThrough * weights.guardWeight],
  ];
  const elbow = new Vector3(...poses.carry.elbow);
  const wrist = new Vector3(...poses.carry.wrist);
  const handTurn = new Quaternion(...poses.carry.handTurn);
  for (const [pose, weight] of chain) {
    if (!pose) continue;
    elbow.lerp(scratchPosition.set(...pose.elbow), weight);
    wrist.lerp(scratchPosition.set(...pose.wrist), weight);
    handTurn.slerp(scratchTurn.set(...pose.handTurn), weight);
  }
  return {
    elbow: elbow.toArray(),
    handTurn: handTurn.normalize().toArray() as [number, number, number, number],
    wrist: wrist.toArray(),
  };
}
