import { colour, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const STRIPE = colour("#d4472a");
const FLANK = colour("#1e1c1d");
const BELLY = colour("#8f8d88");
const EYE = colour("#050505");

const leg = (z) => ({
  x: 0.12,
  splay: 0.09,
  z,
  hipHeight: 0.12,
  upper: 0.08,
  lower: 0.075,
  radii: { top: 0.036, joint: 0.028, cannon: 0.024 },
  belly: { radii: [0.03, 0.03, 0.03], shift: 0 },
  muscle: { spread: 0.85, rise: 0, shift: 0, radii: [0.045, 0.04, 0.05], pitch: 0, blend: 0.03 },
  jointShift: 0,
  foot: { pastern: 0.005, height: 0.015, reach: 0.03, top: 0.026, sole: 0.032 },
});

const anatomy = {
  trunk: [0.35, 0.1, -0.15, -0.4].map((z) => mass("body", [0, 0.14, z], [0.1, 0.07, 0.17], { blend: 0.06 })),
  foreleg: leg(0.36),
  hindleg: leg(-0.38),
  neck: {
    root: [0.14, 0.5],
    solids: chain(
      "neck",
      [
        [0, 0.14, 0.48, 0.085],
        [0, 0.14, 0.56, 0.08],
      ],
      0.05,
    ),
  },
  head: {
    poll: [0.15, 0.58],
    solids: [
      mass("head", [0, 0.14, 0.66], [0.085, 0.055, 0.11]),
      mass("head", [0, 0.13, 0.76], [0.06, 0.04, 0.05]),
      ...bothSides(mass("head", [0.055, 0.18, 0.68], [0.022, 0.022, 0.022], { blend: 0.01, tag: "eye" })),
    ],
  },
  tail: {
    blend: 0.04,
    sections: [
      { y: 0.14, z: -0.58, radius: 0.07 },
      { y: 0.13, z: -0.8, radius: 0.055 },
      { y: 0.12, z: -1.0, radius: 0.04 },
      { y: 0.11, z: -1.2, radius: 0.025 },
      { y: 0.1, z: -1.38, radius: 0.01 },
    ],
  },
};

function paint({ normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "foot") return FLANK;
  const side = mixColour(BELLY, FLANK, smoothstep(-0.7, -0.2, normal[1]));
  return mixColour(side, STRIPE, smoothstep(0.82, 0.93, normal[1]));
}

export const redBackedSalamander = {
  id: "red-backed-salamander",
  profile: "salamander",
  triangles: 4000,
  roughness: 0.4,
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
