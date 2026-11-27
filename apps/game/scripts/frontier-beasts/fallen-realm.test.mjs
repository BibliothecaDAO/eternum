import { it, expect } from "vitest";
import { Mesh } from "three";
import { DEEPLESS_FOURTH_LAYER_BEASTS, StructureType, beastModel, beastsOfFamily } from "@bibliothecadao/types";
import { frontierBeast } from "../../src/three/structures/frontier-beast";
import { RUIN_VARIANTS, createRuinKit } from "../../src/three/structures/ruin-kit";
import { measureBeastPlacement } from "../frontier/verify-beast-placement.mjs";

function extractRuinGeometry(variant) {
  const kit = createRuinKit(variant);
  const vertices = [];
  const triangles = [];
  kit.scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const position = child.geometry.getAttribute("position");
    const offset = vertices.length;
    for (let index = 0; index < position.count; index++) {
      vertices.push([position.getX(index), position.getY(index), position.getZ(index)]);
    }
    const indices = child.geometry.getIndex();
    const count = indices ? indices.count : position.count;
    for (let index = 0; index < count; index += 3) {
      triangles.push([0, 1, 2].map((corner) => offset + (indices ? indices.getX(index + corner) : index + corner)));
    }
    child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material.dispose();
  });
  return { vertices, triangles };
}

for (const { layer: depth, name, scale, ...row } of [...beastsOfFamily("ruin"), DEEPLESS_FOURTH_LAYER_BEASTS.ruin]) {
  const beast = beastModel(row);
  for (const variant of RUIN_VARIANTS) {
    it(`depth ${depth}: ${name} (${beast}) clears procedural ruin variant ${variant} at runtime scale ${scale}`, async () => {
      const ruin = extractRuinGeometry(variant);
      const result = await measureBeastPlacement(beast, scale, ruin);
      console.log(JSON.stringify({ depth, variant, ...result }));
      expect(result.fitsTile).toBe(true);
      expect(result.masonryContacts).toBe(0);
      expect(result.passed).toBe(true);
    });
  }
}

for (const band of ["lowly", "stronger"]) {
  it(`${band} roaming beast fits its tile with no structure`, async () => {
    const { beast, scale } = frontierBeast(0, StructureType.Beasts, band);
    const result = await measureBeastPlacement(beast, scale);
    console.log(JSON.stringify({ band, ...result }));
    expect(result.fitsTile).toBe(true);
    expect(result.masonryContacts).toBe(0);
    expect(result.passed).toBe(true);
  });
}
