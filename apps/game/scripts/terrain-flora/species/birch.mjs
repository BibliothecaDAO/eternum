import { addFluffyCrown, addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK_WHITE = linearColour("#e4e0d2");
const BARK_BAND = linearColour("#3b3631");
const LEAF_LIGHT = linearColour("#a8c45a");
const LEAF_DARK = linearColour("#557a34");
const LEAF_CORE = linearColour("#3f6a30");
/** A birch is airy: small leaves, and fewer of them, so its crown shows more of the light through it. */
const FOLIAGE = { leaves: 52, leafSize: 0.34 };

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
    const lumps = [0, 1, 2, 3, 4, 5].map((index) => {
      const angle = turn + index * 2.4;
      const out = index === 0 ? 0 : height * (0.08 + rng() * 0.05);
      return {
        centre: [top[0] + Math.cos(angle) * out, height * (0.56 + index * 0.065), top[2] + Math.sin(angle) * out],
        radius: height * (0.14 - index * 0.011 + rng() * 0.02),
        squash: 1.15,
        coarse: true,
      };
    });
    addFluffyCrown(mesh, lumps, {
      rng,
      ...FOLIAGE,
      light: LEAF_LIGHT,
      dark: LEAF_DARK,
      core: LEAF_CORE,
      attach: trunkAt(0.85),
      reach: height * 0.45,
    });
    return mesh;
  },
};
