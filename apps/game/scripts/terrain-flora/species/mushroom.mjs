import { addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const STEM = linearColour("#e6dcc4");
const CAP = linearColour("#b4442e");

export const mushroom = {
  id: "mushroom",
  height: 0.26,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 122949829 + 47);
    const mesh = createFloraMesh();
    const turn = rng() * Math.PI * 2;
    const caps = [2, 3, 1][seed % 3];
    for (let cap = 0; cap < caps; cap++) {
      const scale = this.height * (cap === 0 ? 1 : 0.65);
      const angle = turn + cap * Math.PI;
      const at = cap === 0 ? [0, 0, 0] : [Math.cos(angle) * this.height * 0.4, 0, Math.sin(angle) * this.height * 0.4];
      const capBase = [at[0], scale * 0.62, at[2]];
      addFrustum(mesh, {
        from: at,
        to: capBase,
        fromRadius: scale * 0.12,
        toRadius: scale * 0.1,
        sides: 4,
        colour: STEM,
        rng,
      });
      addFrustum(mesh, {
        from: capBase,
        to: [at[0], scale, at[2]],
        fromRadius: scale * 0.42,
        toRadius: scale * 0.04,
        sides: 5,
        colour: CAP,
        rng,
      });
    }
    return mesh;
  },
};
