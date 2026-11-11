import { colour, countershade } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const FLEECE = colour("#efeadd");
const SHADOW = colour("#c9c2b2");
const HORN = colour("#1c1916");

const hoof = { pastern: 0.04, height: 0.05, reach: 0.015, top: 0.044, sole: 0.052 };

const anatomy = {
  trunk: [
    mass("body", [0, 0.78, 0.3], [0.24, 0.32, 0.28], { blend: 0.12 }),
    mass("body", [0, 1.0, 0.26], [0.13, 0.14, 0.22], { blend: 0.12 }),
    mass("body", [0, 0.76, -0.05], [0.26, 0.28, 0.4], { blend: 0.12 }),
    mass("body", [0, 0.78, -0.4], [0.24, 0.27, 0.27], { blend: 0.12 }),
  ],
  foreleg: {
    x: 0.13,
    z: 0.32,
    hipHeight: 0.52,
    upper: 0.26,
    lower: 0.261,
    // Shaggy to the knee, like trousers.
    radii: { top: 0.09, joint: 0.058, cannon: 0.042 },
    belly: { radii: [0.075, 0.11, 0.085], shift: 0 },
    muscle: { spread: 1, rise: 0.16, shift: 0.02, radii: [0.1, 0.22, 0.15], pitch: -0.3 },
    jointShift: 0.005,
    foot: hoof,
  },
  hindleg: {
    x: 0.13,
    z: -0.38,
    hipHeight: 0.56,
    upper: 0.28,
    lower: 0.288,
    radii: { top: 0.105, joint: 0.06, cannon: 0.044 },
    belly: { radii: [0.085, 0.12, 0.1], shift: 0 },
    muscle: { spread: 0.95, rise: 0.12, shift: 0, radii: [0.12, 0.2, 0.18], pitch: 0.1 },
    jointShift: -0.004,
    point: 0.035,
    foot: hoof,
  },
  neck: {
    root: [0.86, 0.46],
    solids: chain(
      "neck",
      [
        [0, 0.86, 0.44, 0.2],
        [0, 1.04, 0.6, 0.14],
        [0, 1.16, 0.7, 0.11],
      ],
      0.1,
    ),
  },
  head: {
    poll: [1.18, 0.72],
    solids: [
      taperedLimb("head", [0, 1.17, 0.74], [0, 0.98, 0.98], 0.095, 0.055, 0.05),
      mass("head", [0, 0.96, 1.0], [0.05, 0.05, 0.055], { tag: "muzzle" }),
      // The beard.
      taperedLimb("head", [0, 1.0, 0.9], [0, 0.84, 0.9], 0.042, 0.018, 0.03),
      ...bothSides(taperedLimb("head", [0.08, 1.2, 0.7], [0.2, 1.22, 0.64], 0.036, 0.016, 0.02, "ear")),
      ...bothSides(mass("head", [0.072, 1.13, 0.84], [0.02, 0.022, 0.026], { blend: 0.012, tag: "eye" })),
      ...chain(
        "head",
        [
          [0.045, 1.26, 0.74, 0.03],
          [0.055, 1.42, 0.7, 0.025],
          [0.06, 1.54, 0.6, 0.018],
        ],
        0.02,
        "horn",
      ).flatMap(bothSides),
    ],
  },
  tail: {
    sections: [
      { y: 0.9, z: -0.62, radius: 0.045 },
      { y: 0.8, z: -0.68, radius: 0.03 },
    ],
  },
};

function paint({ normal, tag }) {
  if (tag === "horn" || tag === "foot" || tag === "muzzle" || tag === "eye") return HORN;
  return countershade(FLEECE, SHADOW, normal);
}

export const mountainGoat = {
  id: "mountain-goat",
  biome: "bare",
  profile: "goat",
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
