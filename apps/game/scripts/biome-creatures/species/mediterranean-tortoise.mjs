import { colour, mixColour, scutePattern, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";
import { sculptQuadruped } from "../quadruped.mjs";

const SCUTE = colour("#d39a35");
const SEAM = colour("#2a1c12");
const PLASTRON = colour("#d9c487");
const SKIN = colour("#6f6450");
const SKIN_SHADE = colour("#4a4234");
const EYE = colour("#0e0b09");

const marginals = Array.from({ length: 22 }, (_, index) => {
  const angle = ((index + 0.5) / 22) * Math.PI * 2;
  return [Math.sin(angle) * 0.36, 0.2, Math.cos(angle) * 0.45];
});
const SCUTE_CENTRES = [
  ...[-0.3, -0.15, 0, 0.15, 0.3].map((z) => [0, 0.57, z]),
  ...[-0.24, -0.08, 0.08, 0.24].flatMap((z) => [
    [0.22, 0.46, z],
    [-0.22, 0.46, z],
  ]),
  ...marginals,
];

const leg = (z, hipHeight, top) => ({
  x: 0.25,
  z,
  hipHeight,
  upper: 0.11,
  lower: 0.12,
  radii: { top, joint: top * 0.92, cannon: top * 0.78 },
  belly: { radii: [top, top, top], shift: 0 },
  muscle: { spread: 1, rise: 0, shift: 0, radii: [top * 0.8, top * 0.8, top * 0.8], pitch: 0, blend: 0.02 },
  jointShift: 0,
  foot: { pastern: 0.005, height: 0.02, reach: 0.03, top: top * 0.75, sole: top * 0.85 },
});

const anatomy = {
  trunk: [
    mass("body", [0, 0.32, 0], [0.36, 0.2, 0.45], { blend: 0.05, tag: "shell" }),
    mass("body", [0, 0.4, -0.03], [0.28, 0.17, 0.35], { blend: 0.08, tag: "shell" }),
    mass("body", [0, 0.22, -0.3], [0.3, 0.06, 0.18], { blend: 0.05, tag: "shell" }),
    mass("body", [0, 0.17, 0], [0.31, 0.05, 0.38], { blend: 0.04, tag: "plastron" }),
  ],
  foreleg: leg(0.28, 0.2, 0.068),
  hindleg: leg(-0.28, 0.2, 0.072),
  neck: {
    root: [0.22, 0.36],
    solids: chain(
      "neck",
      [
        [0, 0.22, 0.36, 0.075],
        [0, 0.25, 0.48, 0.065],
        [0, 0.28, 0.56, 0.058],
      ],
      0.05,
    ),
  },
  head: {
    poll: [0.29, 0.58],
    solids: [
      mass("head", [0, 0.3, 0.63], [0.07, 0.065, 0.09]),
      taperedLimb("head", [0, 0.29, 0.68], [0, 0.27, 0.73], 0.05, 0.03, 0.03),
      ...bothSides(mass("head", [0.052, 0.32, 0.66], [0.016, 0.016, 0.016], { blend: 0.008, tag: "eye" })),
    ],
  },
  tail: {
    sections: [
      { y: 0.2, z: -0.4, radius: 0.045 },
      { y: 0.17, z: -0.5, radius: 0.03 },
      { y: 0.13, z: -0.56, radius: 0.012 },
    ],
  },
};

const scuteColour = scutePattern(SCUTE_CENTRES, SEAM, SCUTE);

function paint({ x, y, z, normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "shell") return scuteColour(x, y, z);
  if (tag === "plastron") return mixColour(PLASTRON, SEAM, 0.25 * smoothstep(0.2, -0.6, normal[1]));
  return mixColour(SKIN_SHADE, SKIN, smoothstep(-0.6, 0.4, normal[1]));
}

export const mediterraneanTortoise = {
  id: "mediterranean-tortoise",
  profile: "tortoise",
  triangles: 5000,
  roughness: 0.7,
  sculpt: () => sculptQuadruped(anatomy),
  paint,
};
