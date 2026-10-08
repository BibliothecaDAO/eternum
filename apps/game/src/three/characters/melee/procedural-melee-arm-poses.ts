import { Quaternion, Vector3 } from "three";

import type { ProceduralMeleeArmPose, ProceduralMeleeArmPoses } from "./procedural-melee-weapon-catalog";

/** How far the attack has moved an arm on from carrying the gear: the weights of the chain carry, guard, windup, contact, follow. */
export interface ProceduralMeleeArmWeights {
  attackWeight: number;
  followThrough: number;
  strikeProgress: number;
  windupProgress: number;
}

const scratchPosition = new Vector3();
const scratchTurn = new Quaternion();

/**
 * The arm's pose for the moment of the attack: it starts at `carry` and the controller's own blend chain moves it on,
 * guard by the action weight, windup by the windup progress, contact by the strike progress, follow by the
 * follow-through (each scaled by the action weight). The hand's turn is blended with the same weights.
 */
export function blendProceduralMeleeArmPoses(
  poses: ProceduralMeleeArmPoses,
  weights: ProceduralMeleeArmWeights,
): ProceduralMeleeArmPose {
  const chain: readonly (readonly [ProceduralMeleeArmPose | undefined, number])[] = [
    [poses.guard, weights.attackWeight],
    [poses.windup, weights.windupProgress * weights.attackWeight],
    [poses.contact, weights.strikeProgress * weights.attackWeight],
    [poses.follow, weights.followThrough * weights.attackWeight],
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
