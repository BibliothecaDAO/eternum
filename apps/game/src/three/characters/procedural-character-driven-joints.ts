import { Quaternion } from "three";

import type { HumanoidDrivenJointDefinition } from "./humanoid-rig-adapter";

const IDENTITY = new Quaternion();
const scratchDelta = new Quaternion();
const scratchTwist = new Quaternion();
const scratchSwing = new Quaternion();

/**
 * Turns a followed joint's rotation from rest (`followsDelta`) into the driven joint's rotation from rest.
 * `half` is slerp(identity, delta, share). `twist` is swing * slerp(identity, twist, share), with the twist taken
 * about the unit `axis` (the followed joint's rest direction in its parent's frame).
 *
 * The rule reads the delta in the followed joint's parent frame and applies it in the driven joint's parent frame, so
 * it holds only when both joints have the same parent (and so the same rest frame): `assertDrivenJointsShareParent`
 * enforces that where the bindings are made. `out` may be `followsDelta`.
 *
 * The twist is the part of the delta about the axis, taken on the short way round (w >= 0), so a roll that crosses
 * 180 degrees makes the helper's share jump (by 144 degrees at a 40% share): inherent to swing-twist.
 */
export function resolveDrivenJointRotation(
  definition: HumanoidDrivenJointDefinition,
  followsDelta: Readonly<Quaternion>,
  out: Quaternion,
): Quaternion {
  scratchDelta.copy(followsDelta);
  if (definition.rule === "half") return out.copy(IDENTITY).slerp(scratchDelta, definition.share);
  const [ax, ay, az] = definition.axis;
  const length = Math.hypot(ax, ay, az);
  const along = (scratchDelta.x * ax + scratchDelta.y * ay + scratchDelta.z * az) / length;
  scratchTwist.set((ax / length) * along, (ay / length) * along, (az / length) * along, scratchDelta.w);
  if (scratchTwist.lengthSq() < 1e-12) scratchTwist.identity();
  else if (scratchTwist.w < 0) scratchTwist.set(-scratchTwist.x, -scratchTwist.y, -scratchTwist.z, -scratchTwist.w);
  scratchTwist.normalize();
  scratchSwing.copy(scratchTwist).invert().premultiply(scratchDelta);
  return out.copy(IDENTITY).slerp(scratchTwist, definition.share).premultiply(scratchSwing);
}

/** The driven joint's local rotation for the followed joint's local rotation, both measured against their rest. */
export function resolveDrivenJointLocalRotation(
  definition: HumanoidDrivenJointDefinition,
  followsRotation: Readonly<Quaternion>,
  followsRestInverse: Readonly<Quaternion>,
  drivenRest: Readonly<Quaternion>,
  out: Quaternion,
): Quaternion {
  scratchDelta.copy(followsRotation).multiply(followsRestInverse);
  return resolveDrivenJointRotation(definition, scratchDelta, out).multiply(drivenRest);
}

/** Throws unless the driven joint and the joint it follows are siblings: the rule needs one shared rest frame. */
export function assertDrivenJointsShareParent(
  definition: HumanoidDrivenJointDefinition,
  driven: { parent: unknown },
  follows: { parent: unknown },
): void {
  if (!driven.parent || driven.parent !== follows.parent) {
    throw new Error(`Driven joint ${definition.bone} must share a parent with ${definition.follows}`);
  }
}
