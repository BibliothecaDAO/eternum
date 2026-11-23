import { addFrustum, addLump, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK_WHITE = linearColour("#e4e0d2");
const BARK_BAND = linearColour("#3b3631");
const LEAF_LIGHT = linearColour("#a8c45a");
const LEAF_DARK = linearColour("#557a34");

export const birch = {
  id: "birch",
  height: 1.6,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 122949823 + 19);
    const mesh = createFloraMesh();
    const height = this.height;
    const lean = [(rng() - 0.5) * height * 0.1, 0, (rng() - 0.5) * height * 0.1];
    const trunkAt = (share) => [lean[0] * share, height * 0.5 * share, lean[2] * share];
    for (let band = 0; band < 4; band++) {
      addFrustum(mesh, {
        from: trunkAt(band / 4),
        to: trunkAt((band + 1) / 4),
        fromRadius: height * (0.042 - band * 0.004),
        toRadius: height * (0.038 - band * 0.004),
        sides: 5,
        colour: band % 2 === 1 ? BARK_BAND : BARK_WHITE,
        rng,
      });
    }
    const top = trunkAt(1);
    for (const side of [-1, 1]) {
      const angle = rng() * Math.PI * 2 * side;
      addFrustum(mesh, {
        from: top,
        to: [top[0] + Math.cos(angle) * height * 0.1, height * 0.62, top[2] + Math.sin(angle) * height * 0.1],
        fromRadius: height * 0.022,
        toRadius: height * 0.012,
        sides: 4,
        colour: BARK_WHITE,
        rng,
      });
    }
    const turn = rng() * Math.PI * 2;
    const lumps = [0, 1, 2, 3].map((index) => {
      const angle = turn + index * 2.4;
      const out = index === 0 ? 0 : height * (0.08 + rng() * 0.05);
      return {
        centre: [top[0] + Math.cos(angle) * out, height * (0.58 + index * 0.08), top[2] + Math.sin(angle) * out],
        radius: height * (0.15 - index * 0.015 + rng() * 0.02),
        squash: 1.05,
        coarse: true,
      };
    });
    lumps.forEach((lump, index) => {
      addLump(mesh, lump, {
        rng,
        roughness: 0.14,
        light: LEAF_LIGHT,
        dark: LEAF_DARK,
        attach: trunkAt(0.85),
        reach: height * 0.45,
        neighbours: lumps.filter((_, other) => other !== index),
      });
    });
    return mesh;
  },
};
