import { sculptBird } from "../bird.mjs";
import { colour, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, mass, taperedLimb } from "../creature-volume.mjs";

const BACK = colour("#15171c");
const FRONT = colour("#f4f2ec");
const CHEST = colour("#f3dc96");
const EAR = colour("#f0a020");
const BEAK = colour("#24211f");
const BEAK_STRIPE = colour("#e8792a");
const FOOT = colour("#2a2a2a");
const EYE = colour("#050505");

const anatomy = {
  body: [
    mass("body", [0, 0.66, 0], [0.26, 0.46, 0.24], { blend: 0.08, tag: "front" }),
    mass("body", [0, 0.42, 0.02], [0.29, 0.3, 0.27], { blend: 0.08, tag: "front" }),
  ],
  neck: {
    at: [0, 1.06, 0.04],
    solids: [
      mass("neck", [0, 1.12, 0.05], [0.17, 0.15, 0.16], { blend: 0.08, tag: "front" }),
      mass("neck", [0, 1.3, 0.08], [0.13, 0.12, 0.14], { blend: 0.06 }),
      taperedLimb("neck", [0, 1.28, 0.2], [0, 1.24, 0.36], 0.04, 0.012, 0.02, "beak"),
      ...bothSides(mass("neck", [0.1, 1.23, 0.06], [0.05, 0.075, 0.05], { blend: 0.03, tag: "ear" })),
      ...bothSides(mass("neck", [0.085, 1.33, 0.17], [0.016, 0.016, 0.016], { blend: 0.008, tag: "eye" })),
    ],
  },
  tail: {
    at: [0, 0.28, -0.2],
    solids: [mass("tail_0", [0, 0.24, -0.27], [0.08, 0.03, 0.1], { pitch: 0.3, blend: 0.04 })],
  },
  wing: {
    shoulder: [0.24, 0.95, -0.01],
    solids: [mass("wing_1", [0.29, 0.72, 0], [0.035, 0.26, 0.09], { roll: -0.12, blend: 0.03 })],
  },
  foot: {
    at: [0.1, 0.06, 0.08],
    solids: [
      taperedLimb("foot_1", [0.1, 0.2, 0.02], [0.1, 0.05, 0.06], 0.045, 0.035, 0.03, "foot"),
      mass("foot_1", [0.1, 0.03, 0.11], [0.06, 0.025, 0.09], { blend: 0.02, tag: "foot" }),
    ],
  },
};

function paint({ y, normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "foot") return FOOT;
  if (tag === "ear") return EAR;
  if (tag === "beak") return mixColour(BEAK, BEAK_STRIPE, smoothstep(0.1, -0.5, normal[1]));
  if (tag !== "front") return BACK;
  const belly = mixColour(FRONT, CHEST, smoothstep(0.85, 1.1, y));
  return mixColour(BACK, belly, smoothstep(-0.15, 0.3, normal[2]));
}

export const emperorPenguin = {
  id: "emperor-penguin",
  profile: "penguin",
  triangles: 5000,
  roughness: 0.7,
  sculpt: () => sculptBird(anatomy),
  paint,
};
