import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { it, expect } from "vitest";
import { FRONTIER_BEASTS, largestBeastScale } from "../../src/three/structures/frontier-beast";
import { assertDeliveredAsset } from "../tripo/ship-model.mjs";
import { BEAST_BUDGET } from "./beast-budget.mjs";

const deliveries = Object.keys(FRONTIER_BEASTS).map((species) => ({
  species,
  directory: "public/models/frontier",
  maxScale: largestBeastScale(species),
}));

async function createBeastReader() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
}

it("keeps every pending delivery with its editable source in the lab archive", () => {
  const files = readdirSync(new URL("../../asset-sources/lab/frontier-beasts/", import.meta.url));
  const studies = deliveries.filter(({ directory }) => directory.startsWith("asset-sources/lab"));
  expect(files.filter((file) => /\.(glb|blend)$/.test(file)).sort()).toEqual(
    studies.flatMap(({ species }) => [`beast-${species}.glb`, `${species}.blend`]).sort(),
  );
  expect(files.some((file) => file.includes("minotaur"))).toBe(false);
});

it("keeps only catalogued production beast deliveries with no retired .blend sculpts", () => {
  const species = Object.keys(FRONTIER_BEASTS);
  const models = readdirSync(new URL("../../public/models/frontier/", import.meta.url));
  const sources = readdirSync(new URL("../../asset-sources/frontier-beasts/refined/", import.meta.url));
  expect(models.filter((name) => /^beast-.*\.glb$/.test(name)).sort()).toEqual(
    species.map((name) => `beast-${name}.glb`).sort(),
  );
  expect(sources.filter((name) => name.endsWith(".blend"))).toEqual([]);
});

for (const { species, directory, maxScale } of deliveries) {
  it(`${directory}/${species}: delivered beast fits the hex and retains paint, provenance and budgets`, async () => {
    const modelPath = fileURLToPath(new URL(`../../${directory}/beast-${species}.glb`, import.meta.url));
    const io = await createBeastReader();
    const { root, triangles } = await assertDeliveredAsset(io, modelPath, "beast", BEAST_BUDGET);
    expect(root.listAnimations()).toHaveLength(0);
    expect(triangles).toBeGreaterThan(BEAST_BUDGET.minTriangles);
    const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
    expect(primitives.some((primitive) => primitive.getMaterial()?.getBaseColorTexture() !== null)).toBe(true);
    expect(primitives.some((primitive) => primitive.getAttribute("TEXCOORD_0") !== null)).toBe(true);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const primitive of primitives) {
      const positions = primitive.getAttribute("POSITION");
      for (let i = 0; i < positions.getCount(); i++) {
        const [x, y, z] = positions.getElement(i, []);
        expect(Math.hypot(x, z) * maxScale).toBeLessThanOrEqual(Math.sqrt(3) / 2 + 0.001);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (species === "dark-fey") {
      expect(minY).toBeGreaterThan(0.2);
      expect(minY).toBeLessThan(0.4);
    } else {
      expect(minY).toBeLessThan(0.03);
    }
    expect(maxY).toBeGreaterThan(BEAST_BUDGET.minHeight);
    const model = root.listNodes().find((node) => node.getMesh());
    expect(model.getExtras().sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(model.getExtras().fitSha256).toMatch(/^[0-9a-f]{64}$/);
  });
}
