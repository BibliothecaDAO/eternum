import { addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const SLATE = linearColour("#262a33");
const SLATE_TOP = linearColour("#3a404c");
const CLUSTERS = [
  [
    { share: 1, at: [0, 0] },
    { share: 0.45, at: [0.16, 0.08] },
  ],
  [
    { share: 0.85, at: [-0.08, 0] },
    { share: 0.6, at: [0.1, 0.07] },
    { share: 0.35, at: [0.03, -0.12] },
  ],
  [{ share: 1, at: [0, 0] }],
];

export const standingStone = {
  id: "standing-stone",
  height: 0.9,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 7727 + 3);
    const mesh = createFloraMesh();
    for (const { share, at } of CLUSTERS[seed % CLUSTERS.length]) {
      addMonolith(mesh, rng, { foot: [at[0], 0, at[1]], tall: this.height * share });
    }
    return mesh;
  },
};

function addMonolith(mesh, rng, { foot, tall }) {
  const width = 0.08 + tall * 0.06;
  const lean = [(rng() - 0.5) * tall * 0.3, 0, (rng() - 0.5) * tall * 0.3];
  const shoulder = [foot[0] + lean[0] * 0.8, tall * 0.82, foot[2] + lean[2] * 0.8];
  addFrustum(mesh, {
    from: [foot[0], -0.02, foot[2]],
    to: shoulder,
    fromRadius: width,
    toRadius: width * 0.72,
    sides: 5,
    colour: SLATE,
    rng,
    twist: rng() * 0.4,
    jag: 0.18,
  });
  const broken = rng() < 0.6;
  addFrustum(mesh, {
    from: shoulder,
    to: [foot[0] + lean[0] * (broken ? 1.6 : 1), tall * (broken ? 0.94 : 1), foot[2] + lean[2] * (broken ? 1.6 : 1)],
    fromRadius: width * 0.72,
    toRadius: width * (broken ? 0.6 : 0.25),
    sides: 5,
    colour: SLATE_TOP,
    rng,
    jag: broken ? 0.45 : 0,
  });
}
