import { colour, countershade } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const FUR = colour("#f1f2ef");
const SHADOW = colour("#c7cfd4");
const DARK = colour("#191716");
const EAR = colour("#b9aca4");

const paw = { pastern: 0.03, height: 0.04, reach: 0.03, top: 0.04, sole: 0.045 };

const anatomy = {
  trunk: [
    mass("body", [0, 0.62, 0.3], [0.17, 0.2, 0.22], { blend: 0.1 }),
    mass("body", [0, 0.62, -0.02], [0.18, 0.19, 0.36], { blend: 0.1 }),
    mass("body", [0, 0.63, -0.34], [0.17, 0.19, 0.22], { blend: 0.1 }),
  ],
  foreleg: {
    x: 0.1,
    z: 0.3,
    hipHeight: 0.46,
    upper: 0.28,
    lower: 0.188,
    radii: { top: 0.062, joint: 0.04, cannon: 0.032 },
    belly: { radii: [0.052, 0.09, 0.058], shift: 0 },
    muscle: { spread: 1, rise: 0.12, shift: 0.02, radii: [0.075, 0.16, 0.11], pitch: -0.3 },
    jointShift: 0.003,
    foot: paw,
  },
  hindleg: {
    x: 0.1,
    z: -0.32,
    hipHeight: 0.5,
    upper: 0.3,
    lower: 0.222,
    radii: { top: 0.078, joint: 0.042, cannon: 0.032 },
    belly: { radii: [0.062, 0.1, 0.078], shift: 0 },
    muscle: { spread: 0.95, rise: 0.1, shift: 0, radii: [0.09, 0.16, 0.14], pitch: 0.1 },
    jointShift: -0.003,
    point: 0.03,
    foot: paw,
  },
  neck: {
    root: [0.68, 0.44],
    solids: chain(
      "neck",
      [
        [0, 0.68, 0.42, 0.15],
        [0, 0.8, 0.56, 0.12],
        [0, 0.88, 0.64, 0.11],
      ],
      0.08,
    ),
  },
  head: {
    poll: [0.9, 0.66],
    solids: [
      mass("head", [0, 0.9, 0.72], [0.115, 0.105, 0.12]),
      taperedLimb("head", [0, 0.87, 0.8], [0, 0.82, 0.98], 0.065, 0.035, 0.04),
      mass("head", [0, 0.825, 1.0], [0.025, 0.022, 0.025], { blend: 0.01, tag: "nose" }),
      ...bothSides(mass("head", [0.07, 0.85, 0.74], [0.06, 0.06, 0.07])),
      ...bothSides(mass("head", [0.075, 1.01, 0.68], [0.045, 0.065, 0.025], { blend: 0.02, tag: "ear" })),
      ...bothSides(mass("head", [0.062, 0.92, 0.82], [0.016, 0.018, 0.02], { blend: 0.01, tag: "eye" })),
    ],
  },
  // The brush: as long as the body is deep, and as thick as a leg is long.
  tail: {
    blend: 0.12,
    sections: [
      { y: 0.62, z: -0.48, radius: 0.07 },
      { y: 0.54, z: -0.7, radius: 0.1 },
      { y: 0.44, z: -0.92, radius: 0.11 },
      { y: 0.37, z: -1.12, radius: 0.085 },
      { y: 0.34, z: -1.26, radius: 0.04 },
    ],
  },
};

function paint({ normal, tag }) {
  if (tag === "nose" || tag === "eye") return DARK;
  if (tag === "ear") return EAR;
  return countershade(FUR, SHADOW, normal);
}

export const arcticFox = {
  id: "arctic-fox",
  biome: "tundra",
  profile: "fox",
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
