import { colour, countershade, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const BACK = colour("#8f5a36");
const BELLY = colour("#b99570");
const MANE = colour("#5d3c27");
const RUMP = colour("#dcc9a6");
const SHANK = colour("#4d3626");
const ANTLER = colour("#cdb891");
const DARK = colour("#1f1814");

const hoof = { pastern: 0.06, height: 0.055, reach: 0.02, top: 0.038, sole: 0.045 };

const antler = [
  ...chain(
    "head",
    [
      [0.05, 1.7, 0.72, 0.028],
      [0.17, 1.95, 0.6, 0.025],
      [0.26, 2.2, 0.6, 0.023],
      [0.22, 2.42, 0.72, 0.02],
    ],
    0.02,
    "antler",
  ),
  taperedLimb("head", [0.06, 1.74, 0.74], [0.11, 1.84, 0.96], 0.024, 0.02, 0.02, "antler"),
  taperedLimb("head", [0.17, 1.95, 0.6], [0.27, 2.04, 0.82], 0.023, 0.02, 0.02, "antler"),
  taperedLimb("head", [0.26, 2.2, 0.6], [0.39, 2.38, 0.52], 0.022, 0.02, 0.02, "antler"),
];

const anatomy = {
  trunk: [
    mass("body", [0, 0.98, 0.36], [0.21, 0.27, 0.27], { blend: 0.12 }),
    mass("body", [0, 0.98, -0.04], [0.24, 0.25, 0.44], { blend: 0.12 }),
    mass("body", [0, 1.02, -0.46], [0.24, 0.27, 0.3], { blend: 0.12 }),
    mass("body", [0, 1.19, 0.32], [0.08, 0.09, 0.2], { blend: 0.12 }),
    mass("body", [0, 1.2, -0.44], [0.14, 0.09, 0.22], { blend: 0.12 }),
    mass("body", [0, 0.88, 0.5], [0.13, 0.17, 0.12], { blend: 0.12 }),
    ...bothSides(mass("body", [0.09, 0.95, -0.68], [0.1, 0.17, 0.1], { blend: 0.12 })),
  ],
  foreleg: {
    x: 0.13,
    z: 0.38,
    hipHeight: 0.8,
    upper: 0.4,
    lower: 0.4125,
    radii: { top: 0.078, joint: 0.045, cannon: 0.031 },
    belly: { radii: [0.055, 0.13, 0.072], shift: 0 },
    muscle: { spread: 1, rise: 0.18, shift: 0.03, radii: [0.09, 0.24, 0.16], pitch: -0.4 },
    jointShift: 0.006,
    foot: hoof,
  },
  hindleg: {
    x: 0.14,
    z: -0.46,
    hipHeight: 0.86,
    upper: 0.44,
    lower: 0.444,
    radii: { top: 0.098, joint: 0.048, cannon: 0.033 },
    belly: { radii: [0.065, 0.15, 0.092], shift: 0 },
    muscle: { spread: 0.95, rise: 0.14, shift: 0, radii: [0.11, 0.25, 0.2], pitch: 0.15 },
    jointShift: -0.004,
    point: 0.045,
    foot: hoof,
  },
  neck: {
    root: [1.04, 0.5],
    solids: [
      ...chain(
        "neck",
        [
          [0, 1.04, 0.48, 0.18],
          [0, 1.34, 0.62, 0.12],
          [0, 1.62, 0.72, 0.09],
        ],
        0.1,
      ),
      // A stag's neck carries a heavy mane below.
      mass("neck", [0, 1.2, 0.6], [0.13, 0.2, 0.14], { pitch: -0.4, blend: 0.08, tag: "mane" }),
    ],
  },
  head: {
    poll: [1.64, 0.73],
    solids: [
      taperedLimb("head", [0, 1.63, 0.76], [0, 1.44, 1.04], 0.088, 0.048, 0.05),
      mass("head", [0, 1.56, 0.82], [0.075, 0.09, 0.09]),
      mass("head", [0, 1.43, 1.06], [0.04, 0.042, 0.045], { tag: "muzzle" }),
      ...bothSides(taperedLimb("head", [0.06, 1.68, 0.72], [0.2, 1.76, 0.66], 0.038, 0.016, 0.02, "ear")),
      ...bothSides(mass("head", [0.074, 1.6, 0.86], [0.02, 0.024, 0.028], { blend: 0.012, tag: "eye" })),
      ...antler.flatMap(bothSides),
    ],
  },
  tail: {
    sections: [
      { y: 1.12, z: -0.72, radius: 0.04 },
      { y: 1.0, z: -0.78, radius: 0.03 },
      { y: 0.9, z: -0.79, radius: 0.02 },
    ],
  },
};

function paint({ y, z, normal, joint, tag }) {
  if (tag === "antler") return ANTLER;
  if (tag === "muzzle" || tag === "foot" || tag === "eye") return DARK;
  if (tag === "mane") return MANE;
  const coat = countershade(BACK, BELLY, normal);
  const rumpPatch = smoothstep(-0.56, -0.7, z) * smoothstep(0.82, 0.95, y);
  const shank = joint.startsWith("knee") ? smoothstep(0.5, 0.25, y) * 0.7 : 0;
  return mixColour(mixColour(coat, RUMP, rumpPatch), SHANK, shank);
}

export const redDeer = {
  id: "red-deer",
  biome: "temperate-deciduous-forest",
  profile: "deer",
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
