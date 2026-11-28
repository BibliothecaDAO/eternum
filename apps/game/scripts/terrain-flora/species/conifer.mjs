import { addFrustum, addLeafCloud, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#3f2c20");
const NEEDLES_DARK = linearColour("#142e28");
const NEEDLES_LIGHT = linearColour("#386a58");
const NEEDLES_UNDER = linearColour("#0c1d19");
/** A fir is a stack of flat boughs narrowing to its tip, each a mass of long thin needles. */
/** `reach` keeps the needles' tips inside the width the tree had, so a taiga holds as many firs as before. */
const BOUGH = { reach: 0.76, flatness: 0.62, needlesAtWidest: 78, needleSize: 0.27, needlePoint: 2.4 };
/** The dark of the tree seen between its needles: one cone inside the boughs, this share of their width. */
const HEART = 0.46;

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
      to: [lean[0] * 0.6, height * 0.6, lean[2] * 0.6],
      fromRadius: height * 0.03,
      toRadius: height * 0.016,
      sides: 5,
      colour: BARK,
      rng,
    });
    const first = height * 0.2;
    const last = height * 0.9;
    const boughs = Array.from({ length: tiers }, (_, tier) => {
      const share = tier / (tiers - 1);
      const width = 1 - share * 0.82;
      const centre = at((first + (last - first) * share) / height);
      return {
        centre: [centre[0], first + (last - first) * share, centre[2]],
        radius: widest * BOUGH.reach * width * (0.9 + rng() * 0.2),
        squash: BOUGH.flatness + share * 0.5,
        needles: Math.ceil(BOUGH.needlesAtWidest * (0.35 + width * 0.65)),
      };
    });
    const tip = at(1);
    addFrustum(mesh, {
      from: [boughs[0].centre[0], first - height * 0.04, boughs[0].centre[2]],
      to: [tip[0], height * 0.98, tip[2]],
      fromRadius: widest * HEART,
      toRadius: height * 0.004,
      sides: 7,
      colour: NEEDLES_UNDER,
      rng,
      foliage: true,
      bend,
    });
    for (const bough of boughs) {
      addLeafCloud(mesh, bough, {
        rng,
        count: bough.needles,
        size: bough.radius * BOUGH.needleSize,
        pointed: BOUGH.needlePoint,
        light: NEEDLES_LIGHT,
        dark: NEEDLES_DARK,
        attach: [0, height * 0.1, 0],
        reach: height,
        rise: height * 0.5,
      });
    }
    return mesh;
  },
};
