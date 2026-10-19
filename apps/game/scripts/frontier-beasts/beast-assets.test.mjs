import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { it, expect } from "vitest";
import { FRONTIER_BEASTS } from "../../src/three/structures/frontier-beast";

const deliveries = [
  ...Object.keys(FRONTIER_BEASTS).map((species) => ({
    species,
    directory: "public/models/frontier",
    sourceDirectory: "asset-sources/frontier-beasts/refined",
  })),
  ...["wyvern", "hydra"].map((species) => ({
    species,
    directory: "asset-sources/lab/frontier-beasts",
    sourceDirectory: "asset-sources/lab/frontier-beasts",
  })),
];

it("keeps only the two pending studies and their editable sculpts in the lab archive", () => {
  const files = readdirSync(new URL("../../asset-sources/lab/frontier-beasts/", import.meta.url));
  expect(files.filter((file) => /\.(glb|blend)$/.test(file)).sort()).toEqual([
    "beast-hydra.glb",
    "beast-wyvern.glb",
    "hydra.blend",
    "wyvern.blend",
  ]);
  expect(files.some((file) => file.includes("minotaur"))).toBe(false);
});

for (const { species, directory, sourceDirectory } of deliveries) {
  it(`${directory}/${species}: delivered sculpt fits the hex and retains paint, normals and editable provenance`, async () => {
    const path = new URL(`../../${directory}/beast-${species}.glb`, import.meta.url);
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
    const source = readFileSync(new URL(`../../${sourceDirectory}/${species}.blend`, import.meta.url));
    const model = root.listNodes().find((node) => node.getMesh());
    expect(model.getExtras().sourceSha256).toBe(createHash("sha256").update(source).digest("hex"));
    expect(model.getScale()).toEqual([1, 1, 1]);
  });
}
