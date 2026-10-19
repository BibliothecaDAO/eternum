import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { it, expect } from "vitest";
import { FRONTIER_BEASTS } from "../../src/three/structures/frontier-beast";

const deliveries = [
  ...["minotaur", "cyclops"].map((species) => ({ species, directory: "", sourceDirectory: "" })),
  ...["troll", "wyvern", "hydra", "minotaur", "cyclops"].map((species) => ({
    species,
    directory: "studies/",
    sourceDirectory: "refined/",
  })),
];
for (const { species, directory, sourceDirectory } of deliveries) {
  it(`${directory}${species}: delivered sculpt fits the hex and retains paint, normals and editable provenance`, async () => {
    const path = new URL(`../../public/models/frontier/${directory}beast-${species}.glb`, import.meta.url);
    const bytes = readFileSync(path);
    expect(bytes.length).toBeLessThanOrEqual(324508);
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
    const root = (await io.read(path.pathname)).getRoot();
    expect(root.listAnimations()).toHaveLength(0);
    const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
    expect(primitives).toHaveLength(1);
    const primitive = primitives[0];
    expect(primitive.getIndices().getCount() / 3).toBeLessThanOrEqual(20121);
    expect(primitive.getIndices().getCount() / 3).toBeGreaterThan(1000);
    const material = primitive.getMaterial();
    expect(material.getBaseColorTexture()).not.toBeNull();
    expect(material.getNormalTexture()).not.toBeNull();
    expect(primitive.getAttribute("TEXCOORD_0")).not.toBeNull();
    const positions = primitive.getAttribute("POSITION");
    let minY = Infinity,
      maxY = -Infinity;
    for (let i = 0; i < positions.getCount(); i++) {
      const [x, y, z] = positions.getElement(i, []);
      if (sourceDirectory)
        expect(Math.hypot(x, z) * FRONTIER_BEASTS[species].maxScale).toBeLessThanOrEqual(Math.sqrt(3) / 2 + 0.001);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let side = 0; side < 6; side++)
        expect(x * Math.cos((side * Math.PI) / 3) + z * Math.sin((side * Math.PI) / 3)).toBeLessThanOrEqual(
          Math.sqrt(3) / 2 + 0.001,
        );
    }
    expect(minY).toBeGreaterThanOrEqual(-0.001);
    expect(minY).toBeLessThan(0.03);
    expect(maxY).toBeGreaterThan(0.7);
    for (const texture of root.listTextures()) expect(texture.getMimeType()).toBe("image/ktx2");
    const source = readFileSync(
      new URL(`../../asset-sources/frontier-beasts/${sourceDirectory}${species}.blend`, import.meta.url),
    );
    const model = root.listNodes().find((node) => node.getMesh());
    expect(model.getExtras().sourceSha256).toBe(createHash("sha256").update(source).digest("hex"));
    expect(model.getScale()).toEqual([1, 1, 1]);
  });
}
