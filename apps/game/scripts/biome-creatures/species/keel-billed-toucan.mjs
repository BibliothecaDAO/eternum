import { PERCH_DROP } from "../../../src/three/terrain/creatures/biome-creature-animator.js";
import { sculptBird } from "../bird.mjs";
import { colour, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, mass, taperedLimb } from "../creature-volume.mjs";

const PLUMAGE = colour("#121212");
const SHEEN = colour("#2a2a30");
const BIB = colour("#f4c81c");
const VENT = colour("#d3271b");
const BILL_BASE = colour("#7db843");
const BILL_MIDDLE = colour("#f39a1e");
const BILL_TIP = colour("#c8251a");
const FOOT = colour("#6f8fd2");
const EYE_RING = colour("#a6d36a");
const EYE = colour("#060606");

const at = (x, y, z) => [x, y + PERCH_DROP, z];

const anatomy = {
  body: [
    mass("body", at(0, 0.27, 0), [0.13, 0.16, 0.19], { pitch: -0.5, blend: 0.06 }),
    mass("body", at(0, 0.35, 0.08), [0.115, 0.12, 0.11], { blend: 0.06, tag: "bib" }),
    mass("body", at(0, 0.13, -0.1), [0.075, 0.05, 0.08], { blend: 0.04, tag: "vent" }),
  ],
  neck: {
    at: at(0, 0.45, 0.1),
    solids: [
      mass("neck", at(0, 0.53, 0.12), [0.09, 0.09, 0.1], { blend: 0.05 }),
      mass("neck", at(0, 0.45, 0.12), [0.09, 0.07, 0.08], { blend: 0.05, tag: "bib" }),
      mass("neck", at(0, 0.52, 0.32), [0.045, 0.075, 0.16], { pitch: 0.15, blend: 0.03, tag: "bill" }),
      taperedLimb("neck", at(0, 0.51, 0.4), at(0, 0.47, 0.5), 0.05, 0.018, 0.02, "bill"),
      ...bothSides(mass("neck", at(0.065, 0.56, 0.15), [0.034, 0.034, 0.03], { blend: 0.01, tag: "ring" })),
      ...bothSides(mass("neck", at(0.08, 0.565, 0.155), [0.02, 0.02, 0.018], { blend: 0.006, tag: "eye" })),
    ],
  },
  tail: {
    at: at(0, 0.17, -0.16),
    solids: [mass("tail_0", at(0, 0.1, -0.34), [0.065, 0.025, 0.19], { pitch: -0.55, blend: 0.04 })],
  },
  wing: {
    shoulder: at(0.12, 0.35, 0),
    solids: [
      mass("wing_1", at(0.22, 0.35, -0.05), [0.14, 0.03, 0.13], { yaw: 0.35, roll: 0.7, blend: 0.06 }),
      mass("wing_1", at(0.33, 0.35, -0.09), [0.08, 0.025, 0.09], { yaw: 0.35, roll: 0.7, blend: 0.05 }),
    ],
  },
  foot: {
    at: at(0.06, 0.08, 0.02),
    solids: [
      taperedLimb("foot_1", at(0.06, 0.17, 0.02), at(0.06, 0.04, 0.04), 0.028, 0.02, 0.02, "foot"),
      taperedLimb("foot_1", at(0.06, 0.03, 0.04), at(0.09, 0.012, 0.12), 0.016, 0.012, 0.012, "foot"),
      taperedLimb("foot_1", at(0.06, 0.03, 0.04), at(0.035, 0.012, 0.12), 0.016, 0.012, 0.012, "foot"),
      taperedLimb("foot_1", at(0.06, 0.03, 0.04), at(0.06, 0.012, -0.05), 0.016, 0.012, 0.012, "foot"),
    ],
  },
};

function billColour(z) {
  const along = smoothstep(0.2, 0.5, z);
  return along < 0.5
    ? mixColour(BILL_BASE, BILL_MIDDLE, smoothstep(0.15, 0.5, along))
    : mixColour(BILL_MIDDLE, BILL_TIP, smoothstep(0.65, 0.95, along));
}

function paint({ z, normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "ring") return EYE_RING;
  if (tag === "bill") return billColour(z);
  if (tag === "bib") return BIB;
  if (tag === "vent") return VENT;
  if (tag === "foot") return FOOT;
  return mixColour(PLUMAGE, SHEEN, smoothstep(0.2, 0.9, normal[1]));
}

export const keelBilledToucan = {
  id: "keel-billed-toucan",
  profile: "toucan",
  triangles: 4000,
  roughness: 0.6,
  sculpt: () => sculptBird(anatomy),
  paint,
};
