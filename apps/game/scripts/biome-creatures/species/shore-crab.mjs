import { sculptArthropod, splayedLegs } from "../arthropod.mjs";
import { colour, countershade, mixColour } from "../creature-coat.mjs";
import { bothSides, mass, taperedLimb } from "../creature-volume.mjs";

const SHELL = colour("#b03a22");
const UNDERSIDE = colour("#efc9a0");
const LEG = colour("#c4532f");
const FINGERTIP = colour("#2b1d18");
const EYE = colour("#141010");

const frontTeeth = [
  [0.24, 0.33],
  [0.34, 0.29],
  [0.43, 0.22],
  [0.49, 0.13],
].map(([x, z]) => mass("body", [x, 0.2, z], [0.045, 0.035, 0.045], { blend: 0.03 }));

const carapace = [
  mass("body", [0, 0.17, 0], [0.52, 0.13, 0.34], { blend: 0.06 }),
  mass("body", [0, 0.18, 0.12], [0.46, 0.11, 0.22], { blend: 0.06 }),
  mass("body", [0, 0.1, -0.02], [0.4, 0.06, 0.28], { blend: 0.06, tag: "underside" }),
  ...frontTeeth.flatMap(bothSides),
  ...bothSides(taperedLimb("body", [0.1, 0.25, 0.32], [0.12, 0.36, 0.36], 0.026, 0.022, 0.02)),
  ...bothSides(mass("body", [0.12, 0.38, 0.37], [0.036, 0.036, 0.036], { blend: 0.012, tag: "eye" })),
];

const legs = splayedLegs({
  rim: [0.47, 0.3],
  hipHeight: 0.12,
  kneeHeight: 0.31,
  reach: 0.42,
  angles: [0.5, 0.17, -0.17, -0.55],
  radii: { root: 0.055, knee: 0.05, ankle: 0.038, tip: 0.018 },
});

const claw = {
  shoulder: [0.26, 0.18, 0.28],
  hinge: [0.29, 0.36, 0.71],
  arm: {
    sections: [
      [0.26, 0.18, 0.28, 0.06],
      [0.42, 0.24, 0.38, 0.065],
      [0.44, 0.3, 0.48, 0.07],
    ],
  },
  palm: { centre: [0.36, 0.34, 0.56], radii: [0.12, 0.11, 0.16], yaw: -0.9 },
  fixedFinger: [
    [0.22, 0.31, 0.64, 0.055],
    [0.14, 0.31, 0.72, 0.04],
    [0.07, 0.32, 0.79, 0.02],
  ],
  movingFinger: [
    [0.28, 0.36, 0.73, 0.048],
    [0.26, 0.37, 0.85, 0.035],
    [0.21, 0.38, 0.95, 0.02],
  ],
};

function paint({ normal, joint, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "fingertip") return mixColour(SHELL, FINGERTIP, 0.85);
  if (tag === "tip") return mixColour(LEG, FINGERTIP, 0.5);
  const shell = joint.startsWith("leg") ? LEG : SHELL;
  return mixColour(countershade(shell, UNDERSIDE, normal), UNDERSIDE, tag === "underside" ? 0.6 : 0);
}

export const shoreCrab = {
  id: "shore-crab",
  profile: "crab",
  triangles: 4000,
  roughness: 0.55,
  sculpt: () => sculptArthropod({ body: carapace, legs, claw }),
  paint,
};
