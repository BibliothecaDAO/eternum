import { addFrustum, addLump, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#4e3524");
const LEAF_LIGHT = linearColour("#86ad48");
const LEAF_DARK = linearColour("#3e6b45");

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
      fromRadius: height * 0.1,
      toRadius: height * 0.07,
      sides: 5,
      colour: BARK,
      rng,
    });
    addFrustum(mesh, {
      from: [0, height * 0.05, 0],
      to: fork,
      fromRadius: height * 0.07,
      toRadius: height * 0.055,
      sides: 5,
      colour: BARK,
      rng,
      twist: 0.5,
    });
    const crown = [fork[0], height * 0.62, fork[2]];
    const turn = rng() * Math.PI * 2;
    const lumps = [
      { centre: [crown[0], height * 0.68, crown[2]], radius: height * 0.22, squash: 0.85 },
      ...[0, 1, 2, 3].map((side) => {
        const angle = turn + (side * Math.PI) / 2 + (rng() - 0.5) * 0.9;
        const radius = height * (0.12 + rng() * 0.09);
        const out = height * 0.12 + radius * 0.75;
        return {
          centre: [crown[0] + Math.cos(angle) * out, height * (0.46 + rng() * 0.12), crown[2] + Math.sin(angle) * out],
          radius,
          squash: 0.78 + rng() * 0.1,
          coarse: true,
        };
      }),
    ];
    for (const lump of lumps.slice(1)) {
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
    lumps.forEach((lump, index) => {
      addLump(mesh, lump, {
        rng,
        roughness: 0.1,
        light: LEAF_LIGHT,
        dark: LEAF_DARK,
        attach: fork,
        reach: height * 0.6,
        neighbours: lumps.filter((_, other) => other !== index),
      });
    });
    return mesh;
  },
};
