import { addTriangle, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const ICE_LIGHT = linearColour("#e4ecf4");
const ICE_DARK = linearColour("#a8b6ca");

export const frostTuft = {
  id: "frost-tuft",
  height: 0.14,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 104729 + 19);
    const mesh = createFloraMesh();
    const blades = 5 + (seed % 3);
    const turn = rng() * Math.PI * 2;
    for (let blade = 0; blade < blades; blade++) {
      const angle = turn + (blade / blades) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const lean = this.height * (0.2 + rng() * 0.25);
      const tip = [Math.cos(angle) * lean, this.height * (0.7 + rng() * 0.4), Math.sin(angle) * lean];
      const side = [-Math.sin(angle) * this.height * 0.12, 0, Math.cos(angle) * this.height * 0.12];
      const left = [side[0], 0, side[2]];
      const right = [-side[0], 0, -side[2]];
      const colour = (blade % 2 === 0 ? ICE_LIGHT : ICE_DARK).map((channel) => channel * (0.94 + rng() * 0.1));
      addTriangle(mesh, [left, right, tip], colour, [0, 0, 1], { foliage: true });
      addTriangle(mesh, [right, left, tip], colour, [0, 0, 1], { foliage: true });
    }
    return mesh;
  },
};
