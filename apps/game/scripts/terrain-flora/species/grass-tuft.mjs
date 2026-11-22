import { addTriangle, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BLADE_LIGHT = linearColour("#9ab65a");
const BLADE_DARK = linearColour("#56783a");

export const grassTuft = {
  id: "grass-tuft",
  height: 0.16,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 179424691 + 53);
    const mesh = createFloraMesh();
    const turn = rng() * Math.PI * 2;
    for (let blade = 0; blade < 6; blade++) {
      const angle = turn + (blade / 6) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const lean = this.height * (0.35 + rng() * 0.3);
      const tip = [Math.cos(angle) * lean, this.height * (0.75 + rng() * 0.35), Math.sin(angle) * lean];
      const side = [-Math.sin(angle) * this.height * 0.09, 0, Math.cos(angle) * this.height * 0.09];
      const left = [side[0], 0, side[2]];
      const right = [-side[0], 0, -side[2]];
      const colour = (blade % 2 === 0 ? BLADE_LIGHT : BLADE_DARK).map((channel) => channel * (0.92 + rng() * 0.16));
      addTriangle(mesh, [left, right, tip], colour, [0, 0, 1], { foliage: true });
      addTriangle(mesh, [right, left, tip], colour, [0, 0, 1], { foliage: true });
    }
    return mesh;
  },
};
