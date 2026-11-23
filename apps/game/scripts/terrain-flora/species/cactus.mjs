import { addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const SKIN = linearColour("#5c8b4c");
const SKIN_DARK = linearColour("#3e6638");

export const cactus = {
  id: "cactus",
  height: 0.75,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 32452867 + 37);
    const mesh = createFloraMesh();
    const height = this.height;
    const radius = height * 0.09;
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: [0, height * 0.55, 0],
      fromRadius: radius,
      toRadius: radius,
      sides: 6,
      colour: SKIN,
      rng,
    });
    addFrustum(mesh, {
      from: [0, height * 0.55, 0],
      to: [0, height, 0],
      fromRadius: radius,
      toRadius: radius * 0.75,
      sides: 6,
      colour: SKIN,
      rng,
    });
    const arms = 1 + Math.round(rng());
    const turn = rng() * Math.PI * 2;
    for (let arm = 0; arm < arms; arm++) {
      const angle = turn + arm * Math.PI;
      const out = [Math.cos(angle), 0, Math.sin(angle)];
      const base = height * (0.32 + rng() * 0.15);
      const elbow = [out[0] * height * 0.2, base + height * 0.04, out[2] * height * 0.2];
      addFrustum(mesh, {
        from: [0, base, 0],
        to: elbow,
        fromRadius: radius * 0.7,
        toRadius: radius * 0.65,
        sides: 4,
        colour: SKIN_DARK,
        rng,
      });
      addFrustum(mesh, {
        from: elbow,
        to: [elbow[0], base + height * (0.3 + rng() * 0.12), elbow[2]],
        fromRadius: radius * 0.65,
        toRadius: radius * 0.5,
        sides: 4,
        colour: SKIN_DARK,
        rng,
      });
    }
    return mesh;
  },
};
