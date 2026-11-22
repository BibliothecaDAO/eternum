import { addFrustum, addTriangle, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const POLE = linearColour("#2a2e36");
const GAUZE_TOP = linearColour("#d6dbe0");
const GAUZE_TAIL = linearColour("#a4adb6");
const SEGMENTS = 3;

export const driftBanner = {
  id: "drift-banner",
  height: 0.7,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 31337 + 101);
    const mesh = createFloraMesh();
    const height = this.height;
    const arm = height * 0.3;
    addFrustum(mesh, {
      from: [0, 0, 0],
      to: [(rng() - 0.5) * height * 0.06, height, 0],
      fromRadius: height * 0.025,
      toRadius: height * 0.014,
      sides: 4,
      colour: POLE,
      rng,
    });
    addFrustum(mesh, {
      from: [0, height * 0.94, -height * 0.02],
      to: [0, height * 0.92, arm],
      fromRadius: height * 0.012,
      toRadius: height * 0.009,
      sides: 3,
      colour: POLE,
      rng,
    });
    const strips = 3 + (seed % 2);
    for (let strip = 0; strip < strips; strip++) {
      const at = arm * ((strip + 0.5) / strips);
      addStrip(mesh, rng, height, at, (arm / strips) * 0.62, 0.35 + rng() * 0.4);
    }
    return mesh;
  },
};

function addStrip(mesh, rng, height, at, width, drop) {
  const rows = Array.from({ length: SEGMENTS + 1 }, (_, step) => {
    const t = step / SEGMENTS;
    const sway = Math.sin(t * Math.PI + rng() * 0.8) * height * 0.05 * t;
    const fray = t === 1 ? width * 0.4 * rng() : width * (1 - t * 0.35);
    const y = height * (0.92 - t * drop);
    return { t, near: [sway, y, at - fray / 2], far: [sway, y - rng() * t * height * 0.04, at + fray / 2] };
  });
  for (let step = 0; step < SEGMENTS; step++) {
    const [upper, lower] = [rows[step], rows[step + 1]];
    const colour = GAUZE_TOP.map((channel, index) => channel + (GAUZE_TAIL[index] - channel) * upper.t);
    for (const face of [
      [upper.near, upper.far, lower.far],
      [upper.near, lower.far, lower.near],
    ]) {
      const weights = face.map((corner) => (corner === upper.near || corner === upper.far ? upper.t : lower.t));
      addTriangle(mesh, face, colour, weights, { foliage: true });
      addTriangle(mesh, face.toReversed(), colour, weights.toReversed(), { foliage: true });
    }
  }
}
