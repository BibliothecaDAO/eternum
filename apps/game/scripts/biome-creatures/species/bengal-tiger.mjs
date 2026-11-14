import { colour, countershade, fract, mix, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const ORANGE = colour("#cf7426");
const CREAM = colour("#f0e6d2");
const BLACK = colour("#17130f");
const DARK = colour("#1a1512");
const NOSE = colour("#b5645c");
/** Where the painting leaves the coat's own colour alone. */
const UNMARKED = [1, 1, 1];

const paw = { pastern: 0.03, height: 0.055, reach: 0.05, top: 0.062, sole: 0.07 };

const anatomy = {
  trunk: [
    mass("body", [0, 0.78, 0.42], [0.22, 0.27, 0.3], { blend: 0.12 }),
    mass("body", [0, 0.78, -0.02], [0.21, 0.23, 0.48], { blend: 0.12 }),
    mass("body", [0, 0.8, -0.35], [0.19, 0.2, 0.25], { blend: 0.12 }),
    mass("body", [0, 0.8, -0.6], [0.2, 0.23, 0.25], { blend: 0.12 }),
    mass("body", [0, 0.98, 0.4], [0.13, 0.09, 0.2], { blend: 0.12 }),
  ],
  foreleg: {
    x: 0.15,
    z: 0.42,
    hipHeight: 0.56,
    upper: 0.36,
    lower: 0.22,
    radii: { top: 0.092, joint: 0.062, cannon: 0.054 },
    belly: { radii: [0.078, 0.13, 0.088], shift: 0 },
    muscle: { spread: 1, rise: 0.16, shift: 0.02, radii: [0.12, 0.24, 0.17], pitch: -0.3 },
    jointShift: 0.004,
    foot: paw,
  },
  hindleg: {
    x: 0.15,
    z: -0.6,
    hipHeight: 0.6,
    upper: 0.37,
    lower: 0.267,
    radii: { top: 0.112, joint: 0.06, cannon: 0.05 },
    belly: { radii: [0.088, 0.14, 0.112], shift: 0 },
    muscle: { spread: 0.95, rise: 0.12, shift: 0, radii: [0.13, 0.22, 0.2], pitch: 0.1 },
    jointShift: -0.004,
    point: 0.04,
    foot: paw,
  },
  neck: {
    root: [0.86, 0.62],
    solids: chain(
      "neck",
      [
        [0, 0.86, 0.6, 0.2],
        [0, 0.94, 0.8, 0.17],
        [0, 0.98, 0.94, 0.16],
      ],
      0.1,
    ),
  },
  head: {
    poll: [1.0, 0.96],
    solids: [
      mass("head", [0, 1.0, 1.04], [0.15, 0.14, 0.15]),
      taperedLimb("head", [0, 0.96, 1.14], [0, 0.92, 1.26], 0.092, 0.072, 0.04, "muzzle"),
      mass("head", [0, 0.955, 1.325], [0.036, 0.028, 0.026], { blend: 0.01, tag: "nose" }),
      mass("head", [0, 0.88, 1.18], [0.075, 0.06, 0.09], { tag: "muzzle" }),
      // The ruff of the cheeks.
      ...bothSides(mass("head", [0.11, 0.93, 1.02], [0.07, 0.09, 0.07], { tag: "muzzle" })),
      ...bothSides(mass("head", [0.1, 1.14, 1.0], [0.05, 0.055, 0.025], { blend: 0.02, tag: "ear" })),
      ...bothSides(mass("head", [0.072, 1.035, 1.165], [0.02, 0.02, 0.022], { blend: 0.01, tag: "eye" })),
    ],
  },
  tail: {
    sections: [
      { y: 0.82, z: -0.82, radius: 0.05 },
      { y: 0.6, z: -1.05, radius: 0.042 },
      { y: 0.4, z: -1.3, radius: 0.038 },
      { y: 0.32, z: -1.58, radius: 0.036 },
      { y: 0.4, z: -1.8, radius: 0.03 },
    ],
  },
};

/** Narrow black stripes that break and taper: upright on the body, rings round the legs and tail. */
function markings(y, z) {
  const onTail = smoothstep(-0.8, -0.9, z);
  const onLeg = smoothstep(0.62, 0.5, y) * (1 - onTail);
  const warp = 0.035 * Math.sin(9 * y + 4 * z) + 0.02 * Math.sin(23 * z + 5 * y);
  const along = mix(mix(z + (y - 0.8) * 0.25, y, onLeg), z - y * 0.6, onTail);
  const period = mix(mix(0.13, 0.085, onLeg), 0.11, onTail);
  const band = Math.abs(fract((along + warp) / period) - 0.5) * 2;
  // A stripe is thickest on the flank and thins to nothing along the spine and under the belly.
  const body = smoothstep(0.52, 0.68, y) * smoothstep(1.1, 0.92, y);
  const thickness = mix(mix(0.34, 0.24, onLeg), 0.4, onTail) * mix(body, 1, Math.max(onLeg, onTail));
  const broken = 0.75 + 0.25 * Math.sin(31 * z + 17 * y);
  const stripe = smoothstep(1 - thickness * broken, 1 - thickness * broken + 0.1, band);
  return mixColour(UNMARKED, BLACK, stripe);
}

function paint({ normal, tag }) {
  if (tag === "eye") return DARK;
  if (tag === "nose") return NOSE;
  if (tag === "muzzle") return CREAM;
  if (tag === "ear") return mixColour(ORANGE, DARK, 0.6);
  return countershade(ORANGE, CREAM, normal);
}

export const bengalTiger = {
  id: "bengal-tiger",
  biome: "tropical-seasonal-forest",
  profile: "tiger",
  sculpt: () => sculptQuadruped(anatomy),
  markings,
  paint,
};
