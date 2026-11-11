import { colour, countershade, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, mass, chain, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const BACK = colour("#3b2a1f");
const BELLY = colour("#4a372a");
const SHANK = colour("#9a8a76");
const MUZZLE = colour("#6b5545");
const ANTLER = colour("#cbb890");
const DARK = colour("#16110e");

const hoof = { pastern: 0.09, height: 0.085, reach: 0.03, top: 0.062, sole: 0.074 };

/** A bull's antler: a short beam, a broad palm sweeping out and up, and tines along its edge. */
const antler = [
  taperedLimb("head", [0.08, 1.86, 1.2], [0.3, 1.96, 1.14], 0.045, 0.04, 0.03, "antler"),
  mass("head", [0.54, 2.08, 1.1], [0.34, 0.045, 0.25], { roll: -0.5, blend: 0.03, tag: "antler" }),
  ...[
    [0.36, 1.99, 1.3, 0.4, 2.12, 1.5],
    [0.58, 2.12, 1.3, 0.68, 2.32, 1.46],
    [0.78, 2.22, 1.18, 0.96, 2.44, 1.24],
    [0.8, 2.22, 1.02, 0.98, 2.44, 0.94],
    [0.6, 2.12, 0.9, 0.66, 2.3, 0.72],
  ].map(([fx, fy, fz, tx, ty, tz]) => taperedLimb("head", [fx, fy, fz], [tx, ty, tz], 0.032, 0.022, 0.03, "antler")),
];

const anatomy = {
  trunk: [
    mass("body", [0, 1.5, 0.45], [0.33, 0.42, 0.38], { blend: 0.14 }),
    mass("body", [0, 1.84, 0.42], [0.18, 0.2, 0.32], { blend: 0.14 }),
    mass("body", [0, 1.45, -0.05], [0.35, 0.36, 0.52], { blend: 0.14 }),
    mass("body", [0, 1.45, -0.55], [0.32, 0.34, 0.34], { blend: 0.14 }),
    mass("body", [0, 1.68, -0.5], [0.18, 0.1, 0.26], { blend: 0.14 }),
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
          [0, 1.5, 0.7, 0.27],
          [0, 1.62, 0.98, 0.2],
          [0, 1.7, 1.2, 0.16],
        ],
        0.12,
      ),
      // The bell hanging under the throat.
      mass("neck", [0, 1.38, 1.12], [0.05, 0.14, 0.07], { blend: 0.05 }),
    ],
  },
  head: {
    poll: [1.72, 1.22],
    solids: [
      taperedLimb("head", [0, 1.72, 1.25], [0, 1.42, 1.72], 0.15, 0.11, 0.06),
      mass("head", [0, 1.52, 1.42], [0.11, 0.13, 0.16], { pitch: 0.6 }),
      mass("head", [0, 1.38, 1.76], [0.115, 0.12, 0.13], { tag: "muzzle" }),
      mass("head", [0, 1.3, 1.78], [0.09, 0.07, 0.08], { tag: "muzzle" }),
      ...bothSides(taperedLimb("head", [0.1, 1.82, 1.2], [0.24, 1.98, 1.12], 0.055, 0.025, 0.02, "ear")),
      ...bothSides(mass("head", [0.125, 1.68, 1.36], [0.028, 0.032, 0.038], { blend: 0.015, tag: "eye" })),
      ...antler.flatMap(bothSides),
    ],
  },
  tail: {
    sections: [
      { y: 1.6, z: -0.86, radius: 0.045 },
      { y: 1.46, z: -0.9, radius: 0.028 },
    ],
  },
};

function paint({ y, normal, joint, tag }) {
  if (tag === "antler") return ANTLER;
  if (tag === "foot" || tag === "eye") return DARK;
  if (tag === "muzzle") return MUZZLE;
  const coat = countershade(BACK, BELLY, normal);
  // A moose's lower legs are pale against its dark body.
  const shank = joint.startsWith("knee") || joint.startsWith("hip") ? smoothstep(1.0, 0.55, y) : 0;
  return mixColour(coat, SHANK, shank * 0.85);
}

export const moose = {
  id: "moose",
  biome: "taiga",
  profile: "moose",
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
