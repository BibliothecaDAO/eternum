import { sculptArthropod, splayedLegs } from "../arthropod.mjs";
import { colour, mixColour, smoothstep } from "../creature-coat.mjs";
import { bothSides, chain, mass, taperedLimb } from "../creature-volume.mjs";

const ELYTRA = colour("#e0441b");
const EMBER = colour("#ffb23a");
const CHITIN = colour("#141214");
const EYE = colour("#050505");

const SPOTS = [
  [0.12, -0.02],
  [0.1, -0.22],
].flatMap(([x, z]) => [
  [x, z],
  [-x, z],
]);

const body = [
  mass("body", [0, 0.26, -0.08], [0.24, 0.15, 0.32], { blend: 0.05, tag: "elytra" }),
  mass("body", [0, 0.16, -0.02], [0.2, 0.06, 0.3], { blend: 0.05 }),
  mass("body", [0, 0.25, 0.26], [0.19, 0.1, 0.12], { blend: 0.04 }),
  mass("body", [0, 0.22, 0.4], [0.1, 0.07, 0.08], { blend: 0.04 }),
  ...bothSides(taperedLimb("body", [0.05, 0.2, 0.46], [0.02, 0.19, 0.56], 0.025, 0.012, 0.012, "tip")),
  ...bothSides(mass("body", [0.075, 0.25, 0.44], [0.022, 0.022, 0.022], { blend: 0.01, tag: "eye" })),
  ...chain(
    "body",
    [
      [0.06, 0.27, 0.44, 0.02],
      [0.16, 0.33, 0.6, 0.017],
      [0.22, 0.31, 0.7, 0.015],
    ],
    0.012,
  ).flatMap(bothSides),
];

const legs = splayedLegs({
  rim: [0.17, 0.2],
  centre: 0.08,
  hipHeight: 0.14,
  kneeHeight: 0.26,
  reach: 0.36,
  angles: [0.7, 0.05, -0.65],
  radii: { root: 0.035, knee: 0.03, ankle: 0.022, tip: 0.012 },
});

function elytraColour(x, z, normal) {
  const spot = Math.min(...SPOTS.map(([sx, sz]) => Math.hypot(x - sx, z - sz)));
  const seam = smoothstep(0.012, 0.025, Math.abs(x));
  const shell = mixColour(ELYTRA, EMBER, smoothstep(0.6, 1, normal[1]) * 0.35);
  return mixColour(CHITIN, shell, Math.min(seam, smoothstep(0.065, 0.085, spot)));
}

function paint({ x, z, normal, tag }) {
  if (tag === "eye") return EYE;
  if (tag === "elytra") return elytraColour(x, z, normal);
  return CHITIN;
}

export const fireBeetle = {
  id: "fire-beetle",
  profile: "beetle",
  triangles: 4000,
  roughness: 0.35,
  sculpt: () => sculptArthropod({ body, legs }),
  paint,
};
