import { colour, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptSwimmer } from "../swimmer.mjs";

const HIDE = colour("#6e5b4b");
const BELLY = colour("#a08b72");
const MOUTH = colour("#4a1414");
const TOOTH = colour("#f4efe2");
const LURE = colour("#ffe680");
const EYE = colour("#0a0a0a");

const teeth = [0.06, 0.13, 0.19, 0.24].map((x, index) =>
  taperedLimb("body", [x, 0.69, 0.44 - index * 0.04], [x * 0.9, 0.8, 0.46 - index * 0.04], 0.024, 0.012, 0.01, "tooth"),
);

const anatomy = {
  body: [
    mass("body", [0, 0.8, 0.05], [0.32, 0.31, 0.38], { blend: 0.08 }),
    mass("body", [0, 0.82, -0.35], [0.18, 0.2, 0.25], { blend: 0.1 }),
    mass("body", [0, 0.64, 0.28], [0.28, 0.11, 0.2], { pitch: -0.2, blend: 0.05, tag: "jaw" }),
    mass("body", [0, 0.73, 0.36], [0.24, 0.035, 0.08], { blend: 0.02, tag: "mouth" }),
    ...teeth.flatMap(bothSides),
    ...bothSides(mass("body", [0.17, 0.96, 0.3], [0.035, 0.035, 0.035], { blend: 0.012, tag: "eye" })),
    mass("body", [0, 1.08, -0.15], [0.025, 0.08, 0.14], { blend: 0.04 }),
  ],
  flippers: [
    {
      at: [0.3, 0.74, 0.08],
      solids: [mass("flipper_0_1", [0.36, 0.73, 0.02], [0.12, 0.03, 0.09], { roll: 0.5, blend: 0.04 })],
    },
  ],
  lure: {
    at: [0, 1.08, 0.2],
    solids: [
      ...chain(
        "lure",
        [
          [0, 1.06, 0.2, 0.026],
          [0, 1.28, 0.3, 0.022],
          [0, 1.34, 0.46, 0.02],
        ],
        0.02,
      ),
      mass("lure", [0, 1.31, 0.54], [0.065, 0.065, 0.065], { blend: 0.02, tag: "lure" }),
    ],
  },
  tail: {
    at: [
      [0, 0.84, -0.55],
      [0, 0.84, -0.69],
      [0, 0.84, -0.83],
    ],
    solids: [
      taperedLimb("tail_0", [0, 0.84, -0.5], [0, 0.84, -0.69], 0.12, 0.08, 0.05),
      taperedLimb("tail_1", [0, 0.84, -0.69], [0, 0.84, -0.83], 0.08, 0.05, 0.04),
      mass("tail_2", [0, 0.84, -0.95], [0.03, 0.17, 0.12], { blend: 0.04 }),
    ],
  },
};

function paint({ normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "tooth") return TOOTH;
  if (tag === "lure") return LURE;
  if (tag === "mouth") return MOUTH;
  return mixColour(BELLY, HIDE, smoothstep(-0.6, 0.2, normal[1]));
}

export const lanternAnglerfish = {
  id: "lantern-anglerfish",
  profile: "angler",
  triangles: 5000,
  roughness: 0.45,
  sculpt: () => sculptSwimmer(anatomy),
  paint,
};
