import { addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const BARK = linearColour("#5a4330");
const HEART = linearColour("#b08a5a");

export const fallenLog = {
  id: "fallen-log",
  height: 0.16,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 49979693 + 41);
    const mesh = createFloraMesh();
    const radius = this.height * 0.5;
    const length = this.height * (4 + rng() * 1.2);
    const tilt = (rng() - 0.5) * 0.4;
    const from = [-length / 2, radius, -tilt * length];
    const to = [length / 2, radius * 0.9, tilt * length];
    addFrustum(mesh, { from, to, fromRadius: radius, toRadius: radius * 0.85, sides: 6, colour: BARK, rng });
    addFrustum(mesh, {
      from: to,
      to: from,
      fromRadius: radius * 0.85,
      toRadius: radius * 0.02,
      sides: 6,
      colour: HEART,
      rng,
    });
    return mesh;
  },
};
