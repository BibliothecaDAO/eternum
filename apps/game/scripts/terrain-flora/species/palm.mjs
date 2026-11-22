import { addFrond, addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK_LIGHT = linearColour("#8a6a46");
const BARK_DARK = linearColour("#5f442c");
const FROND_LIGHT = linearColour("#73a85c");
const FROND_DARK = linearColour("#2c5a35");

export const palm = {
  id: "palm",
  height: 1.6,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 49979687 + 3);
    const mesh = createFloraMesh();
    const height = this.height;
    const sway = rng() * Math.PI * 2;
    const curve = height * (0.1 + rng() * 0.1);
    const trunkAt = (share) => [
      Math.cos(sway) * curve * share * share,
      height * 0.86 * share,
      Math.sin(sway) * curve * share * share,
    ];
    for (let ring = 0; ring < 4; ring++) {
      addFrustum(mesh, {
        from: trunkAt(ring / 4),
        to: trunkAt((ring + 1) / 4),
        fromRadius: height * (0.055 - ring * 0.005),
        toRadius: height * (0.05 - ring * 0.005),
        sides: 5,
        colour: ring % 2 === 0 ? BARK_LIGHT : BARK_DARK,
        rng,
      });
    }
    const crown = trunkAt(1);
    const fronds = 7 + Math.round(rng());
    for (let frond = 0; frond < fronds; frond++) {
      const angle = sway + ((frond + (rng() - 0.5) * 0.4) / fronds) * Math.PI * 2;
      addFrond(mesh, {
        base: crown,
        angle,
        length: height * (0.39 + rng() * 0.08),
        width: height * (0.095 + rng() * 0.025),
        rng,
        light: FROND_LIGHT,
        dark: FROND_DARK,
        steps: 4,
        lift: 0.25 + rng() * 0.15,
      });
    }
    return mesh;
  },
};
