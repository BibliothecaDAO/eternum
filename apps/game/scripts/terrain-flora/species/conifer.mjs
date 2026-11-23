import { addFrustum, addSkirt, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#3f2c20");
const NEEDLES_DARK = linearColour("#142e28");
const NEEDLES_LIGHT = linearColour("#386a58");
const NEEDLES_UNDER = linearColour("#0c1d19");

export const conifer = {
  id: "conifer",
  height: 1.9,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 104729 + 31);
    const mesh = createFloraMesh();
    const height = this.height;
    const tiers = 6 + Math.floor(rng() * 3);
    const widest = height / 4.4;
    const lean = [(rng() - 0.5) * height * 0.05, 0, (rng() - 0.5) * height * 0.05];
    const at = (share) => [lean[0] * share, 0, lean[2] * share];
    const bend = ([x, y, z]) => Math.min(1, Math.hypot(x, z) / widest) * Math.min(1, 0.25 + (y / height) * 0.9);
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: [lean[0] * 0.3, height * 0.3, lean[2] * 0.3],
      fromRadius: height * 0.03,
      toRadius: height * 0.016,
      sides: 5,
      colour: BARK,
      rng,
    });
    const first = height * 0.14;
    const last = height * 0.82;
    for (let tier = 0; tier < tiers; tier++) {
      const share = tier / (tiers - 1);
      const bottom = first + (last - first) * share;
      const top = bottom + height * (0.16 - share * 0.05);
      addSkirt(mesh, {
        centre: at(top / height),
        innerRadius: height * 0.012,
        outerRadius: widest * (1 - share * 0.78) * (0.9 + rng() * 0.2),
        top,
        bottom,
        sides: 14,
        notch: 0.42,
        rng,
        light: NEEDLES_LIGHT,
        dark: NEEDLES_DARK,
        under: NEEDLES_UNDER,
        bend,
      });
    }
    const tip = at(1);
    addFrustum(mesh, {
      from: [tip[0], height * 0.9, tip[2]],
      to: [tip[0], height, tip[2]],
      fromRadius: height * 0.035,
      toRadius: height * 0.003,
      sides: 5,
      colour: NEEDLES_LIGHT,
      rng,
      foliage: true,
      bend,
    });
    return mesh;
  },
};
