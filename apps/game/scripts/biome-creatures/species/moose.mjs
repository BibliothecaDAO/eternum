import { colour, countershade, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, mass, chain, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const BACK = colour("#1b1511");
const BELLY = colour("#2b221c");
const SHANK = colour("#a39684");
const MUZZLE = colour("#4a3c32");
const ANTLER = colour("#8a6a48");
const ANTLER_TIP = colour("#e0d2b4");
const DARK = colour("#0f0c0a");

const hoof = { pastern: 0.09, height: 0.085, reach: 0.03, top: 0.062, sole: 0.074 };

const PALM = { centre: [0.58, 2.02, 1.0], half: [0.34, 0.045, 0.23], yaw: 0.55, roll: 0.55 };
const BROW = { centre: [0.42, 1.96, 1.27], half: [0.13, 0.04, 0.09], yaw: -0.55, roll: 0.35 };

function inPalm({ centre, yaw, roll }, [x, y, z]) {
  const rolledX = x * Math.cos(roll) - y * Math.sin(roll);
  const rolledY = x * Math.sin(roll) + y * Math.cos(roll);
  return [
    centre[0] + rolledX * Math.cos(yaw) + z * Math.sin(yaw),
    centre[1] + rolledY,
    centre[2] - rolledX * Math.sin(yaw) + z * Math.cos(yaw),
  ];
}

function palmSolids(palm, cup) {
  const [a, thickness, b] = palm.half;
  const plate = (x, z, scale) =>
    mass("head", inPalm(palm, [x, cup * (x / a) ** 2, z]), [a * scale, thickness, b * scale], {
      yaw: palm.yaw,
      roll: palm.roll,
      blend: 0.05,
      tag: "antler",
    });
  return [plate(-a * 0.35, 0, 0.66), plate(a * 0.15, 0, 0.8), plate(a * 0.55, 0, 0.62)];
}

function tines(palm, angles, length, cup) {
  const [a, , b] = palm.half;
  return angles.map((angle) => {
    const [x, z] = [Math.cos(angle) * a * 0.82, Math.sin(angle) * b * 0.82];
    const lift = cup * (x / a) ** 2;
    const [dx, dz] = [Math.cos(angle) * length, Math.sin(angle) * length];
    const from = inPalm(palm, [x, lift, z]);
    const to = inPalm(palm, [x + dx, lift + length * 0.3, z + dz]);
    return taperedLimb("head", from, to, 0.03, 0.016, 0.03, "antler");
  });
}

const antler = [
  ...chain(
    "head",
    [
      [0.05, 1.79, 1.17, 0.058],
      [0.17, 1.86, 1.15, 0.052],
      [0.3, 1.93, 1.12, 0.05],
    ],
    0.04,
    "antler",
  ),
  ...palmSolids(PALM, 0.07),
  ...palmSolids(BROW, 0.03),
  ...tines(PALM, [-1.2, -0.85, -0.5, -0.15, 0.2, 0.55, 0.9, 1.25, 1.6], 0.085, 0.07),
  ...tines(BROW, [-0.6, -0.1, 0.4], 0.075, 0.03),
];

const anatomy = {
  trunk: [
    mass("body", [0, 1.5, 0.45], [0.33, 0.42, 0.38], { blend: 0.14 }),
    mass("body", [0, 1.83, 0.34], [0.19, 0.22, 0.4], { blend: 0.18 }),
    mass("body", [0, 1.45, -0.05], [0.35, 0.36, 0.52], { blend: 0.14 }),
    mass("body", [0, 1.42, -0.55], [0.31, 0.33, 0.34], { blend: 0.14 }),
    mass("body", [0, 1.6, -0.48], [0.17, 0.1, 0.26], { blend: 0.14 }),
    mass("body", [0, 1.3, 0.66], [0.2, 0.25, 0.16], { blend: 0.14 }),
  ],
  foreleg: {
    x: 0.2,
    z: 0.5,
    hipHeight: 1.18,
    upper: 0.6,
    lower: 0.608,
    radii: { top: 0.115, joint: 0.068, cannon: 0.047 },
    belly: { radii: [0.085, 0.2, 0.105], shift: 0 },
    muscle: { spread: 1, rise: 0.28, shift: 0.03, radii: [0.14, 0.36, 0.24], pitch: -0.35 },
    jointShift: 0.01,
    foot: hoof,
  },
  hindleg: {
    x: 0.2,
    z: -0.55,
    hipHeight: 1.22,
    upper: 0.63,
    lower: 0.633,
    radii: { top: 0.145, joint: 0.072, cannon: 0.049 },
    belly: { radii: [0.1, 0.22, 0.135], shift: 0 },
    muscle: { spread: 0.95, rise: 0.2, shift: 0, radii: [0.15, 0.34, 0.27], pitch: 0.15 },
    jointShift: -0.006,
    point: 0.07,
    foot: hoof,
  },
  neck: {
    root: [1.5, 0.72],
    solids: [
      ...chain(
        "neck",
        [
          [0, 1.52, 0.7, 0.28],
          [0, 1.62, 0.98, 0.21],
          [0, 1.7, 1.2, 0.16],
        ],
        0.12,
      ),
      mass("neck", [0, 1.3, 1.12], [0.06, 0.22, 0.09], { blend: 0.06 }),
      mass("neck", [0, 1.1, 1.13], [0.035, 0.07, 0.05], { blend: 0.04 }),
    ],
  },
  head: {
    poll: [1.72, 1.22],
    solids: [
      taperedLimb("head", [0, 1.72, 1.25], [0, 1.44, 1.84], 0.15, 0.11, 0.06),
      mass("head", [0, 1.53, 1.44], [0.11, 0.13, 0.17], { pitch: 0.6 }),
      mass("head", [0, 1.4, 1.86], [0.125, 0.13, 0.15], { tag: "muzzle" }),
      mass("head", [0, 1.28, 1.92], [0.1, 0.08, 0.09], { tag: "muzzle" }),
      ...bothSides(taperedLimb("head", [0.1, 1.82, 1.18], [0.25, 1.96, 1.08], 0.055, 0.025, 0.02, "ear")),
      ...bothSides(mass("head", [0.125, 1.68, 1.38], [0.028, 0.032, 0.038], { blend: 0.015, tag: "eye" })),
      ...antler.flatMap(bothSides),
    ],
  },
  tail: {
    sections: [
      { y: 1.56, z: -0.86, radius: 0.045 },
      { y: 1.42, z: -0.9, radius: 0.028 },
    ],
  },
};

function paint({ y, normal, joint, tag }) {
  if (tag === "antler") return mixColour(ANTLER, ANTLER_TIP, smoothstep(2.1, 2.3, y) * 0.7);
  if (tag === "foot" || tag === "eye") return DARK;
  if (tag === "muzzle") return MUZZLE;
  const coat = countershade(BACK, BELLY, normal);
  const shank = joint.startsWith("knee") || joint.startsWith("hip") ? smoothstep(1.0, 0.55, y) : 0;
  return mixColour(coat, SHANK, shank * 0.85);
}

export const moose = {
  id: "moose",
  profile: "moose",
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
