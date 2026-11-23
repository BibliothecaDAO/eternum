import { sculptArthropod, splayedLegs } from "../arthropod.mjs";
import { colour, countershade, mixColour } from "../creature-coat.mjs";
import { bothSides, mass, taperedLimb } from "../creature-volume.mjs";

const SHELL = colour("#2e2219");
const BELLY = colour("#5a4430");
const LEG = colour("#4c3727");
const STING = colour("#7a2a14");
const EYE = colour("#050404");

const segments = [
  [0.05, 0.19, 0.1],
  [-0.07, 0.2, 0.09],
  [-0.18, 0.19, 0.09],
  [-0.28, 0.16, 0.08],
  [-0.36, 0.12, 0.07],
].map(([z, width, length]) => mass("body", [0, 0.16, z], [width, 0.07, length], { blend: 0.03 }));

const body = [
  mass("body", [0, 0.16, 0.2], [0.17, 0.07, 0.16], { blend: 0.04 }),
  ...segments,
  ...bothSides(mass("body", [0.03, 0.235, 0.26], [0.016, 0.016, 0.016], { blend: 0.008, tag: "eye" })),
];

const legs = splayedLegs({
  rim: [0.14, 0.16],
  centre: 0.1,
  hipHeight: 0.12,
  kneeHeight: 0.24,
  reach: 0.36,
  angles: [0.75, 0.3, -0.15, -0.6],
  radii: { root: 0.035, knee: 0.03, ankle: 0.022, tip: 0.012 },
});

const claw = {
  shoulder: [0.1, 0.14, 0.33],
  hinge: [0.26, 0.19, 0.8],
  arm: {
    sections: [
      [0.1, 0.14, 0.33, 0.032],
      [0.26, 0.17, 0.42, 0.035],
      [0.27, 0.18, 0.55, 0.04],
    ],
  },
  palm: { centre: [0.22, 0.18, 0.68], radii: [0.07, 0.06, 0.14], yaw: -0.3 },
  fixedFinger: [
    [0.17, 0.17, 0.8, 0.032],
    [0.14, 0.17, 0.9, 0.022],
    [0.12, 0.18, 0.97, 0.012],
  ],
  movingFinger: [
    [0.26, 0.19, 0.81, 0.03],
    [0.27, 0.19, 0.92, 0.02],
    [0.24, 0.19, 1.0, 0.012],
  ],
};

const stinger = {
  sections: [
    [0, 0.17, -0.42, 0.06],
    [0, 0.24, -0.56, 0.055],
    [0, 0.36, -0.66, 0.05],
    [0, 0.5, -0.68, 0.048],
    [0, 0.62, -0.62, 0.046],
    [0, 0.68, -0.5, 0.042],
  ],
  telson: [
    mass("stinger_4", [0, 0.68, -0.43], [0.05, 0.05, 0.07], { blend: 0.03, tag: "sting" }),
    taperedLimb("stinger_4", [0, 0.67, -0.38], [0, 0.6, -0.32], 0.025, 0.012, 0.015, "sting"),
  ],
};

function paint({ normal, joint, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "sting") return STING;
  if (tag === "tip" || tag === "fingertip") return mixColour(SHELL, EYE, 0.5);
  return countershade(joint.startsWith("leg") ? LEG : SHELL, BELLY, normal);
}

export const desertScorpion = {
  id: "desert-scorpion",
  profile: "scorpion",
  triangles: 4000,
  roughness: 0.45,
  sculpt: () => sculptArthropod({ body, legs, claw, stinger }),
  paint,
};
