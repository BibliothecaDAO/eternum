import { addFluffyCrown, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const LEAF_LIGHT = linearColour("#7c9a4c");
const LEAF_DARK = linearColour("#3b5a35");
const LEAF_CORE = linearColour("#2c4a2c");
const FOLIAGE = { leaves: 34, leafSize: 0.36 };

export const shrub = {
  id: "shrub",
  height: 0.5,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 15485863 + 7);
    const mesh = createFloraMesh();
    const height = this.height;
    const turn = rng() * Math.PI * 2;
    const lumps = [
      { centre: [0, height * 0.46, 0], radius: height * 0.48, squash: 0.95, coarse: true },
      ...[0, 1].map((side) => {
        const angle = turn + side * Math.PI * (0.8 + rng() * 0.4);
        const radius = height * (0.3 + rng() * 0.08);
        return {
          centre: [Math.cos(angle) * height * 0.42, radius * 0.8, Math.sin(angle) * height * 0.42],
          radius,
          squash: 0.85,
          coarse: true,
        };
      }),
    ];
    addFluffyCrown(mesh, lumps, {
      rng,
      ...FOLIAGE,
      light: LEAF_LIGHT,
      dark: LEAF_DARK,
      core: LEAF_CORE,
      attach: [0, 0, 0],
      reach: height * 1.1,
      rise: height * 0.8,
    });
    return mesh;
  },
};
