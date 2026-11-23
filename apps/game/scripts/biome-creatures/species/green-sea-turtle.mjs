import { colour, mixColour, scutePattern, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptSwimmer } from "../swimmer.mjs";

const PLATE = colour("#a8783a");
const SEAM = colour("#3b2614");
const PLASTRON = colour("#ecdfae");
const SKIN = colour("#a9a172");
const SKIN_SHADE = colour("#4d5132");
const EYE = colour("#050505");

const marginals = Array.from({ length: 24 }, (_, index) => {
  const angle = ((index + 0.5) / 24) * Math.PI * 2;
  return [Math.sin(angle) * 0.36, 0.42, Math.cos(angle) * 0.46 - 0.02];
});
const shellColour = scutePattern(
  [
    ...[-0.3, -0.15, 0, 0.15, 0.3].map((z) => [0, 0.56, z]),
    ...[-0.24, -0.08, 0.08, 0.24].flatMap((z) => [
      [0.2, 0.5, z],
      [-0.2, 0.5, z],
    ]),
    ...marginals,
  ],
  SEAM,
  PLATE,
);

const anatomy = {
  body: [
    mass("body", [0, 0.42, -0.02], [0.36, 0.11, 0.46], { blend: 0.05, tag: "shell" }),
    mass("body", [0, 0.48, -0.04], [0.28, 0.08, 0.36], { blend: 0.08, tag: "shell" }),
    mass("body", [0, 0.35, 0], [0.32, 0.06, 0.42], { blend: 0.04, tag: "plastron" }),
  ],
  flippers: [
    {
      at: [0.28, 0.4, 0.28],
      phase: 0,
      solids: [
        taperedLimb("flipper_0_1", [0.28, 0.4, 0.28], [0.52, 0.38, 0.24], 0.06, 0.05, 0.03),
        mass("flipper_0_1", [0.68, 0.37, 0.15], [0.22, 0.025, 0.08], { yaw: 0.4, blend: 0.03 }),
      ],
    },
    {
      at: [0.25, 0.38, -0.36],
      phase: 1.6,
      solids: [
        taperedLimb("flipper_1_1", [0.25, 0.38, -0.36], [0.37, 0.37, -0.46], 0.05, 0.04, 0.03),
        mass("flipper_1_1", [0.44, 0.36, -0.53], [0.1, 0.02, 0.075], { yaw: 0.6, blend: 0.025 }),
      ],
    },
  ],
  neck: {
    at: [0, 0.4, 0.42],
    solids: [
      ...chain(
        "neck",
        [
          [0, 0.4, 0.4, 0.08],
          [0, 0.41, 0.54, 0.07],
        ],
        0.05,
      ),
      mass("neck", [0, 0.42, 0.62], [0.08, 0.07, 0.1], { blend: 0.04 }),
      ...bothSides(mass("neck", [0.06, 0.45, 0.65], [0.018, 0.018, 0.018], { blend: 0.008, tag: "eye" })),
    ],
  },
  tail: {
    at: [
      [0, 0.38, -0.5],
      [0, 0.37, -0.62],
    ],
    solids: [
      taperedLimb("tail_0", [0, 0.38, -0.5], [0, 0.37, -0.62], 0.05, 0.035, 0.03),
      taperedLimb("tail_1", [0, 0.37, -0.62], [0, 0.36, -0.72], 0.035, 0.015, 0.02),
    ],
  },
};

function paint({ x, y, z, normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "shell") return shellColour(x, y, z);
  if (tag === "plastron") return PLASTRON;
  return mixColour(SKIN_SHADE, SKIN, smoothstep(-0.6, 0.5, normal[1]));
}

export const greenSeaTurtle = {
  id: "green-sea-turtle",
  profile: "turtle",
  triangles: 5000,
  roughness: 0.5,
  sculpt: () => sculptSwimmer(anatomy),
  paint,
};
