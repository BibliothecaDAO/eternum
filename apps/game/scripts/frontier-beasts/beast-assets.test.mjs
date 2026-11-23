import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { it, expect } from "vitest";
import { FRONTIER_BEASTS, largestBeastScale } from "../../src/three/structures/frontier-beast";
import { BEAST_BUDGET } from "./beast-budget.mjs";

const deliveries = [
  ...Object.keys(FRONTIER_BEASTS).map((species) => ({
    species,
    directory: "public/models/frontier",
    sourceDirectory: "asset-sources/frontier-beasts/refined",
    maxScale: largestBeastScale(species),
  })),
];

async function createBeastReader() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
}

function isTripoShipped(root) {
  return root.listNodes().some((node) => node.getMesh() && node.getExtras()?.assetKind === "beast");
}

it("keeps every pending delivery with its editable source in the lab archive", () => {
  const files = readdirSync(new URL("../../asset-sources/lab/frontier-beasts/", import.meta.url));
  const studies = deliveries.filter(({ directory }) => directory.startsWith("asset-sources/lab"));
  expect(files.filter((file) => /\.(glb|blend)$/.test(file)).sort()).toEqual(
    studies.flatMap(({ species }) => [`beast-${species}.glb`, `${species}.blend`]).sort(),
  );
  expect(files.some((file) => file.includes("minotaur"))).toBe(false);
});

it("keeps only catalogued production beast deliveries and editable sources for legacy sculpts", async () => {
  const species = Object.keys(FRONTIER_BEASTS);
  const models = readdirSync(new URL("../../public/models/frontier/", import.meta.url));
  const sources = readdirSync(new URL("../../asset-sources/frontier-beasts/refined/", import.meta.url));
  expect(models.filter((name) => /^beast-.*\.glb$/.test(name)).sort()).toEqual(
    species.map((name) => `beast-${name}.glb`).sort(),
  );
  const io = await createBeastReader();
  const legacySpecies = [];
  for (const name of species) {
    const path = new URL(`../../public/models/frontier/beast-${name}.glb`, import.meta.url);
    const root = (await io.read(path.pathname)).getRoot();
    if (!isTripoShipped(root)) legacySpecies.push(name);
  }
  expect(sources.filter((name) => name.endsWith(".blend")).sort()).toEqual(
    legacySpecies.map((name) => `${name}.blend`).sort(),
  );
});

for (const { species, directory, sourceDirectory, maxScale } of deliveries) {
  it(`${directory}/${species}: delivered sculpt fits the hex and retains paint, normals and provenance`, async () => {
    const path = new URL(`../../${directory}/beast-${species}.glb`, import.meta.url);
    const bytes = readFileSync(path);
    expect(bytes.length).toBeLessThanOrEqual(BEAST_BUDGET.maxBytes);
    const io = await createBeastReader();
    const root = (await io.read(path.pathname)).getRoot();
    expect(root.listAnimations()).toHaveLength(0);
    const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
    expect(primitives.length).toBeGreaterThanOrEqual(1);
    expect(primitives.length).toBeLessThanOrEqual(BEAST_BUDGET.maxDraws);
    const triangles = primitives.reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
    expect(triangles).toBeLessThanOrEqual(BEAST_BUDGET.maxTriangles);
    expect(triangles).toBeGreaterThan(BEAST_BUDGET.minTriangles);
    const tripo = isTripoShipped(root);
    const hasBaseColor = primitives.some((primitive) => primitive.getMaterial()?.getBaseColorTexture() !== null);
    expect(hasBaseColor).toBe(true);
    const hasUvs = primitives.some((primitive) => primitive.getAttribute("TEXCOORD_0") !== null);
    expect(hasUvs).toBe(true);
    let minY = Infinity,
      maxY = -Infinity;
    for (const primitive of primitives) {
      const positions = primitive.getAttribute("POSITION");
      for (let i = 0; i < positions.getCount(); i++) {
        const [x, y, z] = positions.getElement(i, []);
        expect(Math.hypot(x, z) * maxScale).toBeLessThanOrEqual(Math.sqrt(3) / 2 + 0.001);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        for (let side = 0; side < 6; side++)
          expect(x * Math.cos((side * Math.PI) / 3) + z * Math.sin((side * Math.PI) / 3)).toBeLessThanOrEqual(
            Math.sqrt(3) / 2 + 0.001,
          );
      }
    }
    expect(minY).toBeGreaterThanOrEqual(BEAST_BUDGET.minGroundY);
    if (species === "dark-fey") {
      expect(minY).toBeGreaterThan(0.2);
      expect(minY).toBeLessThan(0.4);
    } else expect(minY).toBeLessThan(0.03);
    expect(maxY).toBeGreaterThan(BEAST_BUDGET.minHeight);
    for (const texture of root.listTextures()) expect(texture.getMimeType()).toBe("image/ktx2");
    const model = root.listNodes().find((node) => node.getMesh());
    expect(model.getScale()).toEqual([1, 1, 1]);
    const blendUrl = new URL(`../../${sourceDirectory}/${species}.blend`, import.meta.url);
    if (tripo) {
      expect(existsSync(blendUrl)).toBe(false);
      expect(model.getExtras().sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(model.getExtras().fitSha256).toMatch(/^[0-9a-f]{64}$/);
      for (const material of root.listMaterials()) {
        expect(material.getDoubleSided()).toBe(true);
        expect(material.getExtras().tripoMaterial).toBe(true);
      }
    } else {
      expect(primitives).toHaveLength(1);
      expect(primitives[0].getMaterial().getNormalTexture()).not.toBeNull();
      const source = readFileSync(blendUrl);
      expect(model.getExtras().sourceSha256).toBe(createHash("sha256").update(source).digest("hex"));
    }
  });
}
