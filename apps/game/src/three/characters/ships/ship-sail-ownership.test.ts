import { readFileSync } from "node:fs";
import { MeshStandardMaterial, Texture } from "three";
import { afterEach, expect, it } from "vitest";
import { createPooledInstancedMaterial, releasePooledInstancedMaterial } from "../../managers/army-model-materials";
import { MaterialPool } from "../../utils/material-pool";

afterEach(() => MaterialPool.getInstance().dispose());
function readShip(army: string, tier: number) {
  const bytes = readFileSync(new URL(`../../../../public/models/ships/${army}-t${tier}.glb`, import.meta.url));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}
it("ships every sail with class artwork and ownership tint, leaving hull materials unmarked", () => {
  for (const army of ["knight", "crossbowman", "paladin"]) {
    for (const tier of [1, 2, 3]) {
      const asset = readShip(army, tier);
      const sails = asset.nodes.filter((node: any) => node.name?.startsWith("Sail_"));
      expect(sails).toHaveLength(tier === 1 ? 1 : 2);
      for (const node of asset.nodes.filter((node: any) => node.mesh !== undefined)) {
        const isSail = node.name.startsWith("Sail_");
        for (const primitive of asset.meshes[node.mesh].primitives) {
          const source = asset.materials[primitive.material];
          expect(source.extras?.ownershipColor === true).toBe(isSail);
          if (!isSail) continue;
          const texture = asset.textures[source.pbrMetallicRoughness.baseColorTexture.index];
          const image = asset.images[texture.extensions?.KHR_texture_basisu?.source ?? texture.source];
          expect(image.name).toContain(army);
          expect(image.mimeType).toBe("image/ktx2");
          const material = new MeshStandardMaterial({ map: new Texture() });
          material.name = source.name;
          material.userData = source.extras;
          const pooled = createPooledInstancedMaterial(material);
          expect(pooled.usesInstanceColor).toBe(true);
          expect((pooled.material as any).fragmentNode).toBeTruthy();
          expect((pooled.material as any).map).toBe(material.map);
          releasePooledInstancedMaterial(pooled.material);
        }
      }
    }
  }
});
