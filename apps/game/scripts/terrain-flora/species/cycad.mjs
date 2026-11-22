import { addFrond, addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#6b5238");
const FROND_LIGHT = linearColour("#5e9a44");
const FROND_DARK = linearColour("#28502a");

export const cycad = {
  id: "cycad",
  height: 0.42,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 15485867 + 29);
    const mesh = createFloraMesh();
    const height = this.height;
    const crown = [0, height * 0.42, 0];
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: crown,
      fromRadius: height * 0.13,
      toRadius: height * 0.1,
      sides: 5,
      colour: BARK,
      rng,
    });
    const turn = rng() * Math.PI * 2;
    const fronds = [6, 7, 8][seed % 3];
    for (let frond = 0; frond < fronds; frond++) {
      addFrond(mesh, {
        base: crown,
        angle: turn + ((frond + (rng() - 0.5) * 0.3) / fronds) * Math.PI * 2,
        length: height * (0.8 + rng() * 0.2),
        width: height * 0.16,
        rng,
        light: FROND_LIGHT,
        dark: FROND_DARK,
        steps: 2,
        floor: height * 0.03,
        lift: 0.9,
        droop: 0.7,
      });
    }
    return mesh;
  },
};
