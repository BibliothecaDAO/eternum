import { addFrustum, addLump, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const STEM = linearColour("#d8ccae");
const CAP = linearColour("#a87a44");
const CAP_CROWN = linearColour("#c4965a");
const MOSS_LIGHT = linearColour("#4a4428");
const MOSS_DARK = linearColour("#2b2716");
const CAP_GLOW = 0.85;
const CROWN_GLOW = 1;
const STEM_GLOW = 0.12;

export const glowcap = {
  id: "glowcap",
  height: 0.42,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 40503 + 911);
    const mesh = createFloraMesh();
    const height = this.height;
    addLump(
      mesh,
      { centre: [0, 0, 0], radius: height * 0.34, squash: 0.32, coarse: true },
      { rng, roughness: 0.18, light: MOSS_LIGHT, dark: MOSS_DARK, flat: true, foliage: false },
    );
    const count = 3 + (seed % 3);
    const turn = rng() * Math.PI * 2;
    for (let index = 0; index < count; index++) {
      const tallest = index === 0;
      const share = tallest ? 1 : 0.38 + rng() * 0.45;
      const angle = turn + (index / count) * Math.PI * 2 + (rng() - 0.5) * 0.6;
      const out = tallest ? height * 0.04 : height * (0.16 + rng() * 0.2);
      addCap(mesh, rng, {
        foot: [Math.cos(angle) * out, height * 0.04, Math.sin(angle) * out],
        lean: [Math.cos(angle) * height * 0.08 * (1 - share), 0, Math.sin(angle) * height * 0.08 * (1 - share)],
        tall: height * share,
      });
    }
    return mesh;
  },
};

function addCap(mesh, rng, { foot, lean, tall }) {
  const radius = tall * (0.36 + rng() * 0.08);
  const capY = tall * 0.7;
  const capBase = [foot[0] + lean[0], foot[1] + capY, foot[2] + lean[2]];
  addFrustum(mesh, {
    from: foot,
    to: capBase,
    fromRadius: tall * 0.075,
    toRadius: tall * 0.055,
    sides: 4,
    colour: STEM,
    rng,
    glow: STEM_GLOW,
  });
  const shoulder = [capBase[0], capBase[1] + radius * 0.32, capBase[2]];
  addFrustum(mesh, {
    from: capBase,
    to: shoulder,
    fromRadius: radius,
    toRadius: radius * 0.74,
    sides: 6,
    colour: CAP,
    rng,
    glow: CAP_GLOW,
  });
  addFrustum(mesh, {
    from: shoulder,
    to: [shoulder[0], shoulder[1] + radius * 0.26, shoulder[2]],
    fromRadius: radius * 0.74,
    toRadius: radius * 0.18,
    sides: 6,
    colour: CAP_CROWN,
    rng,
    twist: 0.5,
    glow: CROWN_GLOW,
  });
}
