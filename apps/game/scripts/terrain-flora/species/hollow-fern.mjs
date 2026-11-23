import { addFrond, addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const FROND_LIGHT = linearColour("#a08a52");
const FROND_DARK = linearColour("#5c4a2a");
const CURL = linearColour("#c9a35c");
const CURL_GLOW = 0.8;
const CURL_STEPS = 4;

export const hollowFern = {
  id: "hollow-fern",
  height: 0.3,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 15485863 + 7);
    const mesh = createFloraMesh();
    const height = this.height;
    const fronds = 4 + (seed % 2);
    const turn = rng() * Math.PI * 2;
    for (let frond = 0; frond < fronds; frond++) {
      addFrond(mesh, {
        base: [0, height * 0.12, 0],
        angle: turn + ((frond + (rng() - 0.5) * 0.4) / fronds) * Math.PI * 2,
        length: height * (1.1 + rng() * 0.3),
        width: height * 0.26,
        rng,
        light: FROND_LIGHT,
        dark: FROND_DARK,
        steps: 2,
        floor: height * 0.02,
        rise: height * 0.5,
        lift: 1.9,
        droop: 0.5,
      });
    }
    for (let curl = 0; curl < 1 + (seed % 2); curl++) addFiddlehead(mesh, rng, height, turn + Math.PI * (curl + 0.5));
    return mesh;
  },
};

function addFiddlehead(mesh, rng, height, angle) {
  const out = [Math.cos(angle), Math.sin(angle)];
  let point = [out[0] * height * 0.05, 0, out[1] * height * 0.05];
  let heading = 0.15;
  for (let step = 0; step < CURL_STEPS; step++) {
    const length = height * (step === 0 ? 0.5 : 0.14);
    const next = [
      point[0] + out[0] * Math.sin(heading) * length,
      point[1] + Math.cos(heading) * length,
      point[2] + out[1] * Math.sin(heading) * length,
    ];
    addFrustum(mesh, {
      from: point,
      to: next,
      fromRadius: height * (0.035 - step * 0.004),
      toRadius: height * (0.03 - step * 0.004),
      sides: 4,
      colour: CURL,
      rng,
      glow: step === 0 ? 0.2 : CURL_GLOW,
    });
    point = next;
    heading += step === 0 ? 1.2 : 1.1 + rng() * 0.2;
  }
}
