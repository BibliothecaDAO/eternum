import { addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#6e665c");
const BARK_DARK = linearColour("#4a443d");

export const deadTree = {
  id: "dead-tree",
  height: 1.3,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 86028157 + 43);
    const mesh = createFloraMesh();
    const height = this.height;
    const lean = [(rng() - 0.5) * height * 0.12, 0, (rng() - 0.5) * height * 0.12];
    const top = [lean[0], height * 0.8, lean[2]];
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: top,
      fromRadius: height * 0.05,
      toRadius: height * 0.018,
      sides: 5,
      colour: BARK,
      rng,
    });
    const turn = rng() * Math.PI * 2;
    const branches = [3, 4, 5][seed % 3];
    for (let branch = 0; branch < branches; branch++) {
      const share = 0.35 + branch * 0.15;
      const angle = turn + branch * 2.2;
      const from = [lean[0] * share, height * 0.8 * share, lean[2] * share];
      const reach = height * (0.32 - branch * 0.04);
      const to = [
        from[0] + Math.cos(angle) * reach,
        from[1] + reach * (0.6 + rng() * 0.4),
        from[2] + Math.sin(angle) * reach,
      ];
      addFrustum(mesh, {
        from,
        to,
        fromRadius: height * 0.02,
        toRadius: height * 0.005,
        sides: 4,
        colour: BARK_DARK,
        rng,
      });
    }
    return mesh;
  },
};
