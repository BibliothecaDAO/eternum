import { addFluffyCrown, addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#4e3524");
const LEAF_LIGHT = linearColour("#93c659");
const LEAF_DARK = linearColour("#2c6639");

/**
 * The crown is built in tiers of leaf masses around the fork: boughs at its waist, a cap above them and a skirt
 * hanging below. Each tier says how many masses, how far out and how high they sit, and how large they are.
 */
const CROWN_TIERS = [
  { name: "boughs", count: 6, out: 0.2, height: [0.52, 0.62], radius: [0.11, 0.16], branch: true },
  { name: "cap", count: 4, out: 0.1, height: [0.8, 0.88], radius: [0.09, 0.12], branch: false },
  { name: "skirt", count: 3, out: 0.27, height: [0.42, 0.48], radius: [0.07, 0.1], branch: false },
];
const FOLIAGE = { leaves: 46, leafSize: 0.42 };
const LEAF_CORE = linearColour("#2f6b3a");
const between = ([low, high], rng) => low + rng() * (high - low);

export const broadleaf = {
  id: "broadleaf",
  height: 1.5,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 7919 + 17);
    const mesh = createFloraMesh();
    const height = this.height;
    const lean = [(rng() - 0.5) * 0.06 * height, 0, (rng() - 0.5) * 0.06 * height];
    const fork = [lean[0], height * 0.32, lean[2]];
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: [0, height * 0.05, 0],
      fromRadius: height * 0.13,
      toRadius: height * 0.075,
      sides: 5,
      colour: BARK,
      rng,
    });
    addFrustum(mesh, {
      from: [0, height * 0.05, 0],
      to: fork,
      fromRadius: height * 0.075,
      toRadius: height * 0.055,
      sides: 5,
      colour: BARK,
      rng,
      twist: 0.5,
    });
    const heart = { centre: [fork[0], height * 0.7, fork[2]], radius: height * 0.2, squash: 0.9 };
    const tiers = CROWN_TIERS.map((tier) => {
      const turn = rng() * Math.PI * 2;
      return Array.from({ length: tier.count }, (_, side) => {
        const angle = turn + (side * Math.PI * 2) / tier.count + (rng() - 0.5) * 0.7;
        const radius = height * between(tier.radius, rng);
        const out = height * tier.out + radius * 0.5;
        return {
          centre: [
            fork[0] + Math.cos(angle) * out,
            height * between(tier.height, rng),
            fork[2] + Math.sin(angle) * out,
          ],
          radius,
          squash: 0.8 + rng() * 0.14,
          branch: tier.branch,
        };
      });
    });
    const lumps = [heart, ...tiers.flat()];
    for (const lump of lumps.filter((lump) => lump.branch)) {
      const reachTo = [
        lump.centre[0] * 0.7 + fork[0] * 0.3,
        lump.centre[1] - lump.radius * 0.5,
        lump.centre[2] * 0.7 + fork[2] * 0.3,
      ];
      addFrustum(mesh, {
        from: fork,
        to: reachTo,
        fromRadius: height * 0.042,
        toRadius: height * 0.022,
        sides: 4,
        colour: BARK,
        rng,
      });
    }
    addFluffyCrown(mesh, lumps, {
      rng,
      ...FOLIAGE,
      light: LEAF_LIGHT,
      dark: LEAF_DARK,
      core: LEAF_CORE,
      attach: fork,
      reach: height * 0.6,
    });
    return mesh;
  },
};
