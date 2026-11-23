import { addFrustum, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const STEM = linearColour("#5a3456");
const BRANCH = linearColour("#8a5486");
const TIP = linearColour("#d6a6d8");
const DEPTH_GLOW = [0.15, 0.45, 1];

export const bloomCoral = {
  id: "bloom-coral",
  height: 0.46,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 83492791 + 61);
    const mesh = createFloraMesh();
    const height = this.height;
    const arms = 3 + (seed % 2);
    const turn = rng() * Math.PI * 2;
    for (let arm = 0; arm < arms; arm++) {
      const angle = turn + (arm / arms) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const lean = 0.35 + rng() * 0.35;
      addBranch(mesh, rng, {
        from: [0, 0, 0],
        angle,
        lean,
        length: height * (0.42 + rng() * 0.12),
        radius: height * 0.06,
        depth: 0,
      });
    }
    return mesh;
  },
};

function addBranch(mesh, rng, { from, angle, lean, length, radius, depth }) {
  const to = [
    from[0] + Math.cos(angle) * Math.sin(lean) * length,
    from[1] + Math.cos(lean) * length,
    from[2] + Math.sin(angle) * Math.sin(lean) * length,
  ];
  const last = depth === DEPTH_GLOW.length - 1;
  addFrustum(mesh, {
    from,
    to,
    fromRadius: radius,
    toRadius: radius * (last ? 0.9 : 0.7),
    sides: 4,
    colour: [STEM, BRANCH, TIP][depth],
    rng,
    glow: DEPTH_GLOW[depth],
  });
  if (last) return;
  for (const fork of [-1, 1]) {
    addBranch(mesh, rng, {
      from: to,
      angle: angle + fork * (0.5 + rng() * 0.4),
      lean: Math.min(1.2, lean + 0.15 + rng() * 0.2),
      length: length * (0.6 + rng() * 0.15),
      radius: radius * 0.7,
      depth: depth + 1,
    });
  }
}
