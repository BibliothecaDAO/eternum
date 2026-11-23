import { chain, mass, mirrored, taperedLimb } from "./creature-volume.mjs";

const PHASE_STEP = Math.PI * 0.65;
const SIDES = [1, -1];

export function sculptArthropod(anatomy) {
  const joints = [{ name: "body", parent: null, at: [0, 0, 0], extras: { joint: "body" } }];
  const solids = [...anatomy.body];
  anatomy.legs.forEach((leg, index) => {
    for (const side of SIDES) {
      joints.push(...legJoints(leg, index, side));
      solids.push(...onSide(legSolids(leg, index), side));
    }
  });
  if (anatomy.claw)
    for (const side of SIDES) {
      joints.push(...clawJoints(anatomy.claw, side));
      solids.push(...onSide(clawSolids(anatomy.claw), side));
    }
  if (anatomy.stinger) {
    joints.push(...stingerJoints(anatomy.stinger));
    solids.push(...stingerSolids(anatomy.stinger));
  }
  return { joints, solids };
}

function onSide(solids, side) {
  return side === 1 ? solids : solids.map((solid) => mirrored(solid, solid.joint.replace(/_1(_|$)/, "_-1$1")));
}

export function splayedLegs({ rim, centre = 0, hipHeight, kneeHeight, reach, angles, radii }) {
  return angles.map((angle) => {
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
    const hip = [rim[0] * dx, hipHeight, centre + rim[1] * dz];
    const out = (share, height) => [hip[0] + dx * reach * share, height, hip[2] + dz * reach * share];
    return { hip, knee: out(0.45, kneeHeight), ankle: out(0.82, kneeHeight * 0.42), foot: out(1, 0.01), radii };
  });
}

const atSide = ([x, y, z], side) => [x * side, y, z];

function legJoints(leg, index, side) {
  const phase = (side === 1 ? Math.PI : 0) + index * PHASE_STEP;
  const hip = `leg_${side}_${index}`;
  return [
    { name: hip, parent: "body", at: atSide(leg.hip, side), extras: { joint: "splay_leg", side, phase } },
    {
      name: `leg_knee_${side}_${index}`,
      parent: hip,
      at: atSide(leg.knee, side),
      extras: { joint: "splay_knee", side, phase },
    },
  ];
}

function legSolids(leg, index) {
  const hip = `leg_1_${index}`;
  const knee = `leg_knee_1_${index}`;
  const { root, knee: kneeRadius, ankle: ankleRadius, tip: tipRadius } = leg.radii;
  return [
    taperedLimb(hip, leg.hip, leg.knee, root, kneeRadius, 0.02),
    mass(knee, leg.knee, [kneeRadius * 1.15, kneeRadius * 1.15, kneeRadius * 1.15], { blend: 0.015 }),
    taperedLimb(knee, leg.knee, leg.ankle, kneeRadius, ankleRadius, 0.015),
    mass(knee, leg.ankle, [ankleRadius * 1.15, ankleRadius * 1.15, ankleRadius * 1.15], { blend: 0.012 }),
    taperedLimb(knee, leg.ankle, leg.foot, ankleRadius, tipRadius, 0.012, "tip"),
  ];
}

function clawJoints(claw, side) {
  const shoulder = `claw_${side}`;
  return [
    { name: shoulder, parent: "body", at: atSide(claw.shoulder, side), extras: { joint: "claw", side } },
    { name: `pincer_${side}`, parent: shoulder, at: atSide(claw.hinge, side), extras: { joint: "pincer", side } },
  ];
}

function clawSolids(claw) {
  const { arm, palm, fixedFinger, movingFinger } = claw;
  return [
    ...chain("claw_1", arm.sections, 0.02),
    ...arm.sections
      .slice(1)
      .map(([x, y, z, radius]) =>
        mass("claw_1", [x, y, z], [radius * 1.2, radius * 1.2, radius * 1.2], { blend: 0.015 }),
      ),
    mass("claw_1", palm.centre, palm.radii, { yaw: palm.yaw, roll: palm.roll ?? 0, blend: 0.03 }),
    ...chain("claw_1", fixedFinger, 0.012, "fingertip"),
    mass("pincer_1", claw.hinge, [movingFinger[0][3] * 1.1, movingFinger[0][3] * 1.1, movingFinger[0][3] * 1.1], {
      blend: 0.015,
    }),
    ...chain("pincer_1", movingFinger, 0.012, "fingertip"),
  ];
}

function stingerJoints(stinger) {
  return stinger.sections.slice(0, -1).map((section, index) => ({
    name: `stinger_${index}`,
    parent: index === 0 ? "body" : `stinger_${index - 1}`,
    at: section.slice(0, 3),
    extras: { joint: "stinger", segment: index },
  }));
}

function stingerSolids(stinger) {
  const segments = stinger.sections.slice(0, -1).flatMap((section, index) => {
    const next = stinger.sections[index + 1];
    return [
      taperedLimb(`stinger_${index}`, section.slice(0, 3), next.slice(0, 3), section[3], next[3], 0.02),
      mass(`stinger_${index}`, section.slice(0, 3), [section[3] * 1.12, section[3] * 1.12, section[3] * 1.12], {
        blend: 0.02,
      }),
    ];
  });
  return [...segments, ...stinger.telson];
}
