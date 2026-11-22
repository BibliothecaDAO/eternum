import { addLump, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const STONE_LIGHT = linearColour("#9a948a");
const STONE_DARK = linearColour("#5a554e");

export const boulder = {
  id: "boulder",
  height: 0.3,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 32452843 + 11);
    const mesh = createFloraMesh();
    const height = this.height;
    const angle = rng() * Math.PI * 2;
    const main = { centre: [0, height * 0.42, 0], radius: height * 0.75, squash: 0.62 + rng() * 0.12, coarse: true };
    const pebble = {
      centre: [Math.cos(angle) * height * 0.75, height * 0.18, Math.sin(angle) * height * 0.75],
      radius: height * (0.3 + rng() * 0.1),
      squash: 0.7,
      coarse: true,
    };
    for (const [lump, neighbour] of [
      [main, pebble],
      [pebble, main],
    ]) {
      addLump(mesh, lump, {
        rng,
        roughness: 0.22,
        light: STONE_LIGHT,
        dark: STONE_DARK,
        neighbours: [neighbour],
        flat: true,
        foliage: false,
      });
    }
    return mesh;
  },
};
