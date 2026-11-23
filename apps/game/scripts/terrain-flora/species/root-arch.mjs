import { addFrustum, addLump, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const ROOT_DARK = linearColour("#3e2b1e");
const ROOT_LIGHT = linearColour("#6a4a30");
const KNOT = linearColour("#c08a46");
const KNOT_GLOW = 1;
const SPAN = 0.3;
const STEPS = 7;

export const rootArch = {
  id: "root-arch",
  height: 0.18,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 69061 + 433);
    const mesh = createFloraMesh();
    const strands = 2 + (seed % 2);
    for (let strand = 0; strand < strands; strand++) {
      addStrand(mesh, rng, {
        rise: this.height * (0.75 + rng() * 0.25),
        offset: (strand - (strands - 1) / 2) * SPAN * 0.09,
        phase: rng() * Math.PI * 2,
        thickness: SPAN * (0.07 - strand * 0.012),
        colour: strand === 0 ? ROOT_DARK : ROOT_LIGHT,
      });
    }
    for (const end of [-1, 1]) addFoot(mesh, rng, end);
    const knots = 1 + (seed % 3);
    for (let knot = 0; knot < knots; knot++) {
      const along = (rng() - 0.5) * SPAN * 0.5;
      addLump(
        mesh,
        {
          centre: [along, archHeight(along, this.height) + SPAN * 0.02, (rng() - 0.5) * SPAN * 0.08],
          radius: SPAN * 0.045,
        },
        { rng, roughness: 0.15, light: KNOT, dark: KNOT, flat: true, foliage: false, glow: KNOT_GLOW },
      );
    }
    return mesh;
  },
};

function archHeight(along, rise) {
  const share = (along / (SPAN / 2)) ** 2;
  return rise * (1 - share);
}

function addStrand(mesh, rng, { rise, offset, phase, thickness, colour }) {
  const points = Array.from({ length: STEPS + 1 }, (_, step) => {
    const along = -SPAN / 2 + (step / STEPS) * SPAN;
    const twist = Math.sin(phase + step * 0.9) * SPAN * 0.03;
    return [along, Math.max(0, archHeight(along, rise)), offset + twist];
  });
  for (let step = 0; step < STEPS; step++) {
    const taper = 1 - Math.abs(step + 0.5 - STEPS / 2) / STEPS;
    addFrustum(mesh, {
      from: points[step],
      to: points[step + 1],
      fromRadius: thickness * (0.75 + taper * 0.5),
      toRadius: thickness * (0.75 + taper * 0.5),
      sides: 4,
      colour,
      rng,
      twist: 0.5,
    });
  }
}

function addFoot(mesh, rng, end) {
  const base = [end * SPAN * 0.5, 0, 0];
  for (let toe = 0; toe < 2; toe++) {
    const angle = (toe - 0.5) * 1.2 + (rng() - 0.5) * 0.4;
    addFrustum(mesh, {
      from: [base[0], SPAN * 0.04, base[2]],
      to: [base[0] + end * Math.cos(angle) * SPAN * 0.14, 0, base[2] + Math.sin(angle) * SPAN * 0.14],
      fromRadius: SPAN * 0.04,
      toRadius: SPAN * 0.012,
      sides: 3,
      colour: ROOT_DARK,
      rng,
    });
  }
}
