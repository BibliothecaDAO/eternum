import { Quaternion } from "three";

import type { HumanoidDrivenJointDefinition } from "./humanoid-rig-adapter";

const IDENTITY = new Quaternion();
const scratchTwist = new Quaternion();
const scratchSwing = new Quaternion();

/**
 * Turns a followed joint's rotation from rest (`followsDelta`) into the driven joint's rotation from rest.
 * `half` is slerp(identity, delta, share). `twist` is swing * slerp(identity, twist, share), with the twist taken
 * about the unit `axis` (the followed joint's rest direction in its parent's frame).
 */
export function resolveDrivenJointRotation(
  definition: HumanoidDrivenJointDefinition,
  followsDelta: Readonly<Quaternion>,
  out: Quaternion,
): Quaternion {
  if (definition.rule === "half") return out.copy(IDENTITY).slerp(followsDelta, definition.share);
  const [ax, ay, az] = definition.axis;
  const length = Math.hypot(ax, ay, az);
  const along = (followsDelta.x * ax + followsDelta.y * ay + followsDelta.z * az) / length;
  scratchTwist.set((ax / length) * along, (ay / length) * along, (az / length) * along, followsDelta.w);
  if (scratchTwist.lengthSq() < 1e-12) scratchTwist.identity();
  else if (scratchTwist.w < 0) scratchTwist.set(-scratchTwist.x, -scratchTwist.y, -scratchTwist.z, -scratchTwist.w);
  scratchTwist.normalize();
  scratchSwing.copy(scratchTwist).invert().premultiply(followsDelta);
  return out.copy(IDENTITY).slerp(scratchTwist, definition.share).premultiply(scratchSwing);
}
