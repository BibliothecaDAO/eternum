import { colour, countershade, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const BACK = colour("#94805f");
const BELLY = colour("#ddd2bd");
const EAR_TIP = colour("#231d19");
const SCUT = colour("#f2eee6");
const DARK = colour("#1a1614");

const anatomy = {
  // An arched back over big haunches.
  trunk: [
    mass("body", [0, 0.46, 0.2], [0.13, 0.15, 0.17], { blend: 0.08 }),
    mass("body", [0, 0.5, -0.05], [0.16, 0.18, 0.28], { blend: 0.08 }),
    mass("body", [0, 0.5, -0.3], [0.17, 0.2, 0.2], { blend: 0.08 }),
  ],
  foreleg: {
    x: 0.08,
    z: 0.22,
    hipHeight: 0.36,
    upper: 0.2,
    lower: 0.16,
    radii: { top: 0.042, joint: 0.03, cannon: 0.026 },
    belly: { radii: [0.034, 0.06, 0.038], shift: 0 },
    muscle: { spread: 1, rise: 0.08, shift: 0.01, radii: [0.05, 0.11, 0.08], pitch: -0.3, blend: 0.06 },
    jointShift: 0.002,
    foot: { pastern: 0.02, height: 0.03, reach: 0.03, top: 0.03, sole: 0.034 },
  },
  // Long hind legs, kept folded under the haunch: the spring it bounds on.
  hindleg: {
    x: 0.11,
    z: -0.2,
    hipHeight: 0.27,
    upper: 0.27,
    lower: 0.25,
    radii: { top: 0.072, joint: 0.037, cannon: 0.032 },
    belly: { radii: [0.056, 0.09, 0.072], shift: 0 },
    muscle: { spread: 0.95, rise: 0.16, shift: -0.08, radii: [0.09, 0.15, 0.16], pitch: 0.1, blend: 0.06 },
    jointShift: -0.002,
    point: 0.02,
    foot: { pastern: 0.02, height: 0.03, reach: 0.06, top: 0.034, sole: 0.038 },
  },
  neck: {
    root: [0.54, 0.3],
    solids: chain(
      "neck",
      [
        [0, 0.54, 0.28, 0.12],
        [0, 0.64, 0.38, 0.1],
        [0, 0.7, 0.44, 0.095],
      ],
      0.06,
    ),
  },
  head: {
    poll: [0.72, 0.44],
    solids: [
      mass("head", [0, 0.72, 0.5], [0.085, 0.09, 0.11]),
      taperedLimb("head", [0, 0.7, 0.56], [0, 0.66, 0.66], 0.06, 0.042, 0.03),
      mass("head", [0, 0.668, 0.69], [0.02, 0.02, 0.02], { blend: 0.01, tag: "nose" }),
      ...bothSides(mass("head", [0.05, 0.68, 0.56], [0.045, 0.05, 0.06])),
      ...bothSides(mass("head", [0.076, 0.745, 0.53], [0.02, 0.024, 0.026], { blend: 0.01, tag: "eye" })),
      ...chain(
        "head",
        [
          [0.04, 0.78, 0.46, 0.03],
          [0.06, 1.02, 0.4, 0.046],
          [0.07, 1.22, 0.36, 0.034],
          [0.07, 1.3, 0.35, 0.02],
        ],
        0.02,
        "ear",
      ).flatMap(bothSides),
    ],
  },
  tail: {
    sections: [
      { y: 0.5, z: -0.5, radius: 0.05 },
      { y: 0.52, z: -0.58, radius: 0.04 },
    ],
    solids: [mass("tail_0", [0, 0.51, -0.56], [0.055, 0.055, 0.055], { blend: 0.02, tag: "scut" })],
  },
};

function paint({ y, normal, tag }) {
  if (tag === "nose" || tag === "eye") return DARK;
  if (tag === "scut") return mixColour(SCUT, DARK, smoothstep(0.2, 0.7, normal[1]));
  const coat = countershade(BACK, BELLY, normal);
  return tag === "ear" ? mixColour(coat, EAR_TIP, smoothstep(1.14, 1.24, y)) : coat;
}

export const jackrabbit = {
  id: "jackrabbit",
  biome: "temperate-desert",
  profile: "rabbit",
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
