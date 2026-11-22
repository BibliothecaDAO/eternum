import { addFrond, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const FROND_LIGHT = linearColour("#6fa04e");
const FROND_DARK = linearColour("#2f5a2c");

export const fern = {
  id: "fern",
  height: 0.28,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 179424673 + 23);
    const mesh = createFloraMesh();
    const turn = rng() * Math.PI * 2;
    const fronds = [4, 5, 6][seed % 3];
    for (let frond = 0; frond < fronds; frond++) {
      addFrond(mesh, {
        base: [0, this.height * 0.15, 0],
        angle: turn + ((frond + (rng() - 0.5) * 0.4) / fronds) * Math.PI * 2,
        length: this.height * (1.3 + rng() * 0.3),
        width: this.height * 0.32,
        rng,
        light: FROND_LIGHT,
        dark: FROND_DARK,
        steps: 2,
        floor: this.height * 0.02,
        rise: this.height * 0.5,
        lift: 1.4,
        droop: 0.6,
      });
    }
    return mesh;
  },
};
