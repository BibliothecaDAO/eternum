import { addFrustum, addLump, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#5a4632");
const LEAF_LIGHT = linearColour("#3e8a36");
const LEAF_DARK = linearColour("#14391b");

export const rainforestCanopy = {
  id: "rainforest-canopy",
  height: 2,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 86028121 + 13);
    const mesh = createFloraMesh();
    const height = this.height;
    const crownBase = [0, height * 0.66, 0];
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: crownBase,
      fromRadius: height * 0.05,
      toRadius: height * 0.03,
      sides: 5,
      colour: BARK,
      rng,
    });
    const turn = rng() * Math.PI * 2;
    for (let root = 0; root < 3; root++) {
      const angle = turn + (root * Math.PI * 2) / 3;
      addFrustum(mesh, {
        from: [Math.cos(angle) * height * 0.13, 0, Math.sin(angle) * height * 0.13],
        to: [Math.cos(angle) * height * 0.02, height * 0.16, Math.sin(angle) * height * 0.02],
        fromRadius: height * 0.03,
        toRadius: height * 0.012,
        sides: 4,
        colour: BARK,
        rng,
      });
    }
    const lumps = [
      { centre: [0, height * 0.84, 0], radius: height * 0.26, squash: 0.42 },
      ...[0, 1, 2, 3].map((side) => {
        const angle = turn + (side * Math.PI) / 2 + (rng() - 0.5) * 0.7;
        const out = height * (0.3 + rng() * 0.05);
        return {
          centre: [Math.cos(angle) * out, height * (0.78 + rng() * 0.04), Math.sin(angle) * out],
          radius: height * (0.17 + rng() * 0.04),
          squash: 0.45,
          coarse: true,
        };
      }),
    ];
    lumps.forEach((lump, index) => {
      addLump(mesh, lump, {
        rng,
        roughness: 0.12,
        light: LEAF_LIGHT,
        dark: LEAF_DARK,
        attach: crownBase,
        reach: height * 0.5,
        neighbours: lumps.filter((_, other) => other !== index),
      });
    });
    return mesh;
  },
};
