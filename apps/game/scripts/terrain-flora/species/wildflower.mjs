import { addFrustum, addTriangle, createFloraMesh, createRandom } from "../flora-geometry.mjs";
import { colour as linearColour } from "../../biome-creatures/creature-coat.mjs";

const STEM = linearColour("#5f8a3c");
const PETALS = ["#e8c84a", "#f2f0e4", "#c86ab0"].map(linearColour);

export const wildflower = {
  id: "wildflower",
  height: 0.18,
  variants: 3,
  build(seed) {
    const rng = createRandom(seed * 15485903 + 59);
    const mesh = createFloraMesh();
    const petals = PETALS[seed % PETALS.length];
    const turn = rng() * Math.PI * 2;
    const stems = [3, 4, 2][seed % 3];
    for (let stem = 0; stem < stems; stem++) {
      const angle = turn + (stem / stems) * Math.PI * 2;
      const foot = [Math.cos(angle) * this.height * 0.15, 0, Math.sin(angle) * this.height * 0.15];
      const head = [foot[0] * 1.6, this.height * (0.75 + rng() * 0.3), foot[2] * 1.6];
      addFrustum(mesh, {
        from: foot,
        to: head,
        fromRadius: this.height * 0.03,
        toRadius: this.height * 0.02,
        sides: 2,
        colour: STEM,
        rng,
        foliage: true,
        bend: ([, y]) => Math.min(1, Math.max(0, y / this.height - 0.05) / 0.95),
      });
      const size = this.height * 0.16;
      const corners = [0, 1, 2].map((corner) => {
        const petal = angle + (corner / 3) * Math.PI * 2;
        return [head[0] + Math.cos(petal) * size, head[1] + size * 0.3, head[2] + Math.sin(petal) * size];
      });
      addTriangle(mesh, [corners[0], corners[2], corners[1]], petals, [1, 1, 1], { foliage: true });
    }
    return mesh;
  },
};
