import { colour, fract, mix, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const WHITE = colour("#ece6d8");
const BLACK = colour("#1d1b1a");
const DARK = colour("#1c1a19");
/** Where the painting leaves the coat's own colour alone. */
const UNMARKED = [1, 1, 1];

const hoof = { pastern: 0.07, height: 0.07, reach: 0.02, top: 0.052, sole: 0.064 };

const anatomy = {
  trunk: [
    mass("body", [0, 1.02, 0.4], [0.26, 0.31, 0.3], { blend: 0.12 }),
    mass("body", [0, 1.01, -0.04], [0.33, 0.32, 0.5], { blend: 0.12 }),
    mass("body", [0, 1.07, -0.5], [0.3, 0.3, 0.34], { blend: 0.12 }),
    mass("body", [0, 1.24, 0.36], [0.1, 0.11, 0.24], { blend: 0.12 }),
    mass("body", [0, 1.26, -0.5], [0.17, 0.1, 0.26], { blend: 0.12 }),
    mass("body", [0, 0.9, 0.56], [0.17, 0.2, 0.14], { blend: 0.12 }),
    ...bothSides(mass("body", [0.11, 0.98, -0.76], [0.12, 0.2, 0.12], { blend: 0.12 })),
  ],
  foreleg: {
    x: 0.17,
    z: 0.44,
    hipHeight: 0.82,
    upper: 0.416,
    lower: 0.417,
    radii: { top: 0.1, joint: 0.058, cannon: 0.042 },
    belly: { radii: [0.075, 0.15, 0.095], shift: 0 },
    muscle: { spread: 1, rise: 0.2, shift: 0.03, radii: [0.11, 0.27, 0.19], pitch: -0.4 },
    jointShift: 0.008,
    foot: hoof,
  },
  hindleg: {
    x: 0.18,
    z: -0.52,
    hipHeight: 0.88,
    upper: 0.45,
    lower: 0.455,
    radii: { top: 0.12, joint: 0.062, cannon: 0.044 },
    belly: { radii: [0.085, 0.17, 0.115], shift: 0 },
    muscle: { spread: 0.95, rise: 0.16, shift: 0, radii: [0.13, 0.28, 0.23], pitch: 0.15 },
    jointShift: -0.005,
    point: 0.05,
    foot: hoof,
  },
  neck: {
    root: [1.08, 0.6],
    solids: [
      ...chain(
        "neck",
        [
          [0, 1.08, 0.58, 0.23],
          [0, 1.34, 0.8, 0.165],
          [0, 1.6, 0.97, 0.12],
        ],
        0.1,
      ),
      // The mane stands erect along the crest.
      mass("neck", [0, 1.48, 0.7], [0.022, 0.07, 0.36], { pitch: -0.71, blend: 0.03 }),
    ],
  },
  head: {
    poll: [1.62, 0.99],
    solids: [
      taperedLimb("head", [0, 1.6, 1.0], [0, 1.3, 1.27], 0.115, 0.07, 0.05),
      mass("head", [0, 1.5, 1.04], [0.095, 0.13, 0.12], { pitch: 0.7 }),
      mass("head", [0, 1.62, 1.07], [0.09, 0.08, 0.11]),
      mass("head", [0, 1.27, 1.29], [0.065, 0.07, 0.07], { tag: "muzzle" }),
      ...bothSides(mass("head", [0.075, 1.76, 0.95], [0.03, 0.1, 0.045], { pitch: -0.25, blend: 0.02 })),
      ...bothSides(mass("head", [0.097, 1.57, 1.08], [0.026, 0.03, 0.036], { blend: 0.015, tag: "eye" })),
    ],
  },
  tail: {
    sections: [
      { y: 1.25, z: -0.8, radius: 0.045 },
      { y: 1.05, z: -0.9, radius: 0.03 },
      { y: 0.78, z: -0.93, radius: 0.022 },
      { y: 0.55, z: -0.94, radius: 0.02 },
    ],
    solids: [mass("tail_2", [0, 0.62, -0.935], [0.035, 0.14, 0.04], { blend: 0.03, tag: "tuft" })],
  },
};

/** Stripes: upright on the flank, swinging round the haunch to band the legs, crosswise on the neck and face. */
function markings(y, z) {
  const wobble = 0.012 * Math.sin(13 * y + 7 * z) + 0.008 * Math.sin(29 * z - 11 * y);
  const haunch = smoothstep(-0.2, -0.7, z);
  const flank = z + haunch * 1.1 * (y - 1.36);
  const alongNeck = 0.58 + (y - 1.08) * 0.65 + (z - 0.58) * 0.76;
  const onNeck = smoothstep(0.5, 0.72, z) * smoothstep(1.0, 1.2, y);
  const body = mix(flank, alongNeck, onNeck);
  const onLeg = smoothstep(0.88, 0.72, y);
  const onHead = smoothstep(0.98, 1.06, z) * smoothstep(1.05, 1.2, y);
  const period = mix(mix(0.125, 0.085, onLeg), 0.06, onHead);
  const stripe = Math.abs(fract((mix(body, y * 1.05, onLeg) + wobble) / period) - 0.5) * 2;
  // The underside between the legs is unmarked.
  const belly = smoothstep(0.8, 0.73, y) * smoothstep(0.34, 0.24, z) * smoothstep(-0.38, -0.28, z);
  return mixColour(UNMARKED, BLACK, smoothstep(0.44, 0.56, stripe) * (1 - belly));
}

function paint({ tag }) {
  return tag === "muzzle" || tag === "foot" || tag === "tuft" || tag === "eye" ? DARK : WHITE;
}

export const plainsZebra = {
  id: "plains-zebra",
  biome: "grassland",
  profile: "zebra",
  sculpt: () => sculptQuadruped(anatomy),
  markings,
  paint,
};
