import { mass, mirrored, taperedLimb } from "./creature-volume.mjs";

/** The walk's footfall order, as a share of the stride: left fore, left hind, right fore, right hind. */
const WALK_PHASES = { FL: 0, FR: Math.PI, BL: 1.7278759594743864, BR: 4.869468613064179 };
const FOOT_HEIGHT = 0.02;

/**
 * Builds a four-legged animal from its anatomy: the rig the animator drives and the solids that are its flesh.
 *
 * Trunk, neck, head and tail are sculpted freely by the species. A leg is described, because the rig depends on it:
 * the rig's leg is the part of a real leg that swings clear of the body, forearm and cannon in front (the joint
 * between them is the knee, which folds forward), gaskin and cannon behind (the hock, which folds back). Shoulder and
 * thigh are muscle on the trunk. Legs are bound hanging straight; the animator bends them to the ground, so a leg is
 * authored a little longer than its hip is high.
 */
export function sculptQuadruped(anatomy) {
  const joints = [{ name: "body", parent: null, at: [0, 0, 0], extras: { joint: "body" } }];
  const solids = [...anatomy.trunk];
  for (const [end, leg] of [
    ["F", anatomy.foreleg],
    ["B", anatomy.hindleg],
  ]) {
    const left = legSolids(leg, `hip_${end}L`, `knee_${end}L`);
    solids.push(...left, ...left.map((solid) => mirrored(solid, solid.joint.replace(/L$/, "R"))));
    for (const side of ["L", "R"]) joints.push(...legJoints(leg, end, side));
  }
  joints.push(
    { name: "neck", parent: "body", at: [0, ...anatomy.neck.root], extras: { joint: "neck" } },
    { name: "head", parent: "neck", at: [0, ...anatomy.head.poll], extras: { joint: "head" } },
    ...tailJoints(anatomy.tail),
  );
  solids.push(...anatomy.neck.solids, ...anatomy.head.solids, ...tailSolids(anatomy.tail));
  return { joints, solids };
}

function legJoints(leg, end, side) {
  const x = side === "L" ? -leg.x : leg.x;
  const hip = `hip_${end}${side}`;
  return [
    {
      name: hip,
      parent: "body",
      at: [x, leg.hipHeight, leg.z],
      extras: {
        joint: "hip",
        phase: WALK_PHASES[`${end}${side}`],
        upperLength: leg.upper,
        lowerLength: leg.lower,
        // The fore knee folds forward and the hock back: the reverse of an elbow and a stifle.
        bend: end === "F" ? -1 : 1,
        footHeight: FOOT_HEIGHT,
      },
    },
    { name: `knee_${end}${side}`, parent: hip, at: [x, leg.hipHeight - leg.upper, leg.z], extras: { joint: "knee" } },
  ];
}

/** The left leg, hanging straight from its hip: muscle above, a bony joint, a slim cannon, fetlock and foot. */
function legSolids(leg, hip, knee) {
  const x = -leg.x;
  const kneeY = leg.hipHeight - leg.upper;
  const soleY = kneeY - leg.lower;
  const footTop = soleY + leg.foot.height;
  const fetlockY = footTop + leg.foot.pastern;
  const { top, joint, cannon } = leg.radii;
  const solids = [
    // Muscle on the trunk that the leg swings from: shoulder in front, thigh behind.
    mass("body", [x * leg.muscle.spread, leg.hipHeight + leg.muscle.rise, leg.z + leg.muscle.shift], leg.muscle.radii, {
      pitch: leg.muscle.pitch,
      blend: leg.muscle.blend ?? 0.09,
    }),
    taperedLimb(hip, [x, leg.hipHeight, leg.z], [x, kneeY, leg.z], top, joint * 0.9, 0.06),
    mass(hip, [x, leg.hipHeight - leg.upper * 0.3, leg.z + leg.belly.shift], leg.belly.radii, { blend: 0.05 }),
    mass(knee, [x, kneeY, leg.z + leg.jointShift], [joint, joint * 1.15, joint * 1.1], { blend: 0.03 }),
    taperedLimb(knee, [x, kneeY, leg.z], [x, fetlockY, leg.z], joint * 0.82, cannon, 0.03),
    mass(knee, [x, fetlockY, leg.z], [cannon * 1.25, cannon * 1.3, cannon * 1.35], { blend: 0.02 }),
    taperedLimb(knee, [x, fetlockY, leg.z], [x, footTop, leg.z + leg.foot.reach], cannon, cannon, 0.02),
    taperedLimb(
      knee,
      [x, footTop, leg.z + leg.foot.reach],
      [x, soleY + leg.foot.sole, leg.z + leg.foot.reach * 1.4],
      leg.foot.top,
      leg.foot.sole,
      0.015,
      "foot",
    ),
  ];
  if (leg.point) solids.push(hockPoint(knee, x, kneeY, leg));
  return solids;
}

/** The point of the hock, standing out behind the joint. */
function hockPoint(knee, x, kneeY, leg) {
  const { joint } = leg.radii;
  return mass(knee, [x, kneeY + leg.point, leg.z - joint], [joint * 0.6, leg.point * 1.2, joint * 0.75], {
    blend: 0.03,
  });
}

function tailJoints(tail) {
  return tail.sections.slice(0, -1).map((section, index) => ({
    name: `tail_${index}`,
    parent: index === 0 ? "body" : `tail_${index - 1}`,
    at: [0, section.y, section.z],
    extras: { joint: "tail", segment: index },
  }));
}

/** One limb per tail joint, then whatever hair the species hangs on them. */
function tailSolids(tail) {
  const dock = tail.sections.slice(0, -1).map((section, index) => {
    const next = tail.sections[index + 1];
    const blend = tail.blend ?? 0.03;
    return taperedLimb(
      `tail_${index}`,
      [0, section.y, section.z],
      [0, next.y, next.z],
      section.radius,
      next.radius,
      blend,
    );
  });
  return [...dock, ...(tail.solids ?? [])];
}
