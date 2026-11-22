import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { afterAll, describe, expect, it } from "vitest";

import { LAYER_BIOMES } from "../../src/three/terrain/layer-biomes";
import { LAYER_PROP_IDS, TERRAIN_PROP_ARCHETYPE_IDS } from "../../src/three/terrain/terrain-prop-catalog";
import { getLayerPropBiomes } from "../../src/three/terrain/terrain-props";

const SHIPPED = fileURLToPath(new URL("../../public/models/terrain-flora/", import.meta.url));
const BUILDER = fileURLToPath(new URL("./build-flora.mjs", import.meta.url));
const manifest = JSON.parse(readFileSync(join(SHIPPED, "manifest.json"), "utf8"));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const rebuilt = mkdtempSync(join(tmpdir(), "terrain-flora-"));
afterAll(() => rmSync(rebuilt, { recursive: true, force: true }));

async function readVariants(file) {
  const document = await io.readBinary(new Uint8Array(readFileSync(join(SHIPPED, file))));
  return document
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh())
    .map((node) => {
      const [primitive] = node.getMesh().listPrimitives();
      const read = (name) => {
        const accessor = primitive.getAttribute(name);
        const element = [];
        return Array.from({ length: accessor.getCount() }, (_, index) => [...accessor.getElement(index, element)]);
      };
      return {
        name: node.getName(),
        position: read("POSITION"),
        foliage: read("_WIND_WEIGHT"),
        bend: read("_WIND_BEND"),
        glow: read("_GLOW"),
      };
    });
}

const VARIANT_DIFFERENCE = 0.05;

describe("the map's procedural flora as shipped", () => {
  it("has a species for every prop kind the catalog names", () => {
    expect(manifest.species.map(({ id }) => id).toSorted()).toEqual([...TERRAIN_PROP_ARCHETYPE_IDS].toSorted());
  });

  it("ships exactly what the builder writes", () => {
    const result = spawnSync(process.execPath, [BUILDER, "--out", rebuilt], { encoding: "utf8" });
    expect(result.status).toBe(0);
    for (const { file, sha256 } of manifest.species) {
      const shipped = readFileSync(join(SHIPPED, file));
      expect(createHash("sha256").update(shipped).digest("hex")).toBe(sha256);
      expect(readFileSync(join(rebuilt, file)).equals(shipped)).toBe(true);
    }
  });

  it.each(manifest.species)("keeps $id still on its wood and at its base", async ({ file, triangles }) => {
    const variants = await readVariants(file);
    expect(variants.map(({ position }) => position.length / 3)).toEqual(triangles);
    for (const { position, foliage, bend } of variants) {
      const heights = position.map(([, y]) => y);
      const [lowest, highest] = [Math.min(...heights), Math.max(...heights)];
      bend.forEach(([weight], vertex) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
        const nearGround = (heights[vertex] - lowest) / (highest - lowest) <= 0.05;
        if (foliage[vertex][0] === 0 || nearGround) expect(weight).toBe(0);
      });
    }
  });

  it.each(manifest.species)(
    "keeps $id's glow within 0 to 1, lit in the Hollow and dark elsewhere",
    async ({ id, file }) => {
      const hollow =
        LAYER_PROP_IDS.includes(id) && getLayerPropBiomes(id).every((biome) => LAYER_BIOMES[2].includes(biome));
      const glows = (await readVariants(file)).map(({ glow }) => glow.map(([weight]) => weight));
      for (const weights of glows) {
        for (const weight of weights) {
          expect(weight).toBeGreaterThanOrEqual(0);
          expect(weight).toBeLessThanOrEqual(1);
          if (!hollow) expect(weight).toBe(0);
        }
        if (hollow) expect(Math.max(...weights)).toBeGreaterThan(0);
      }
    },
  );

  it.each(manifest.species)("grows $id's variants as different plants, never clones", async ({ file }) => {
    const variants = await readVariants(file);
    const shapes = variants.map(({ position }) => ({ triangles: position.length / 3, extents: extentsOf(position) }));
    shapes.forEach((shape, index) => {
      for (const other of shapes.slice(index + 1)) {
        const extentChange = Math.max(
          ...shape.extents.map(
            (extent, axis) => Math.abs(extent - other.extents[axis]) / Math.max(extent, other.extents[axis]),
          ),
        );
        expect(shape.triangles !== other.triangles || extentChange >= VARIANT_DIFFERENCE).toBe(true);
      }
    });
  });

  it("bends the palm's fronds from their roots, its tips the most", async () => {
    const palm = manifest.species.find(({ id }) => id === "palm");
    for (const { position, foliage, bend } of await readVariants(palm.file)) {
      const wood = position.filter((_, vertex) => foliage[vertex][0] === 0);
      const crown = Math.max(...wood.map(([, y]) => y));
      const top = wood.filter(([, y]) => y > crown - 0.05);
      const axis = [0, 2].map((axis) => top.reduce((sum, point) => sum + point[axis], 0) / top.length);
      const fronds = position
        .map((point, vertex) => ({
          reach: Math.hypot(point[0] - axis[0], point[2] - axis[1]),
          weight: bend[vertex][0],
        }))
        .filter((_, vertex) => foliage[vertex][0] === 1)
        .toSorted((a, b) => a.reach - b.reach);
      const share = Math.ceil(fronds.length * 0.15);
      const mean = (rows) => rows.reduce((sum, { weight }) => sum + weight, 0) / rows.length;
      expect(mean(fronds.slice(-share))).toBeGreaterThan(mean(fronds.slice(0, share)) + 0.4);
    }
  });
});

function extentsOf(position) {
  return [0, 1, 2].map((axis) => {
    const values = position.map((point) => point[axis]);
    return Math.max(...values) - Math.min(...values);
  });
}
