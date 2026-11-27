import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Mesh } from "three";
import { describe, expect, it } from "vitest";

import { FLORA_SPECIES, buildFloraSpeciesGeometry, buildFloraSpeciesMesh, getFloraSpeciesMetadata } from "./flora-kit";
import { LAYER_BIOMES, type LayerBiome } from "./layer-biomes";
import { loadTerrainPropCatalog } from "./terrain-prop-asset-cache";
import { LAYER_PROP_IDS, TERRAIN_PROP_ARCHETYPE_IDS } from "./terrain-prop-catalog";
import { getLayerPropBiomes } from "./terrain-props";

const VARIANT_DIFFERENCE = 0.05;
const SHIPPED_FLORA_DIRECTORY = fileURLToPath(new URL("../../../public/models/terrain-flora", import.meta.url));

describe("runtime procedural terrain flora kit", () => {
  it("ships zero terrain-flora GLB files and builds every catalog archetype in memory", async () => {
    const shippedFiles = existsSync(SHIPPED_FLORA_DIRECTORY)
      ? readdirSync(SHIPPED_FLORA_DIRECTORY).filter((file) => file.endsWith(".glb") || file === "manifest.json")
      : [];
    expect(shippedFiles).toEqual([]);
    expect(Object.keys(FLORA_SPECIES).toSorted()).toEqual([...TERRAIN_PROP_ARCHETYPE_IDS].toSorted());

    const catalog = await loadTerrainPropCatalog();
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      const object = catalog.scene.getObjectByName(archetype);
      expect(object, archetype).toBeInstanceOf(Mesh);
      const geometry = (object as Mesh).geometry;
      expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
      expect(geometry.getAttribute("normal").count).toBeGreaterThan(0);
      expect(geometry.getAttribute("color").count).toBeGreaterThan(0);
      expect(geometry.getAttribute("_wind_weight").count).toBeGreaterThan(0);
      expect(geometry.getAttribute("_wind_bend").count).toBeGreaterThan(0);
      expect(geometry.getAttribute("_glow").count).toBeGreaterThan(0);
    }
  });

  it.each(TERRAIN_PROP_ARCHETYPE_IDS)(
    "builds valid, non-degenerate, bounded geometry for %s across all variants",
    (archetype) => {
      const meta = getFloraSpeciesMetadata(archetype);
      expect(meta.height).toBeGreaterThan(0);
      expect(meta.radius).toBeGreaterThan(0);
      expect(meta.variants).toBeGreaterThanOrEqual(3);

      for (let seed = 0; seed < meta.variants; seed++) {
        const raw = buildFloraSpeciesMesh(archetype, seed);
        const triangleCount = raw.positions.length / 9;
        expect(triangleCount).toBe(meta.triangles[seed]);
        expect(triangleCount).toBeGreaterThan(0);
        expect(triangleCount).toBeLessThan(800);

        for (const value of raw.positions) expect(Number.isFinite(value)).toBe(true);
        for (const value of raw.normals) expect(Number.isFinite(value)).toBe(true);
        for (const value of raw.colours) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }

        for (let tri = 0; tri < raw.positions.length; tri += 9) {
          const ax = raw.positions[tri];
          const ay = raw.positions[tri + 1];
          const az = raw.positions[tri + 2];
          const abx = raw.positions[tri + 3] - ax;
          const aby = raw.positions[tri + 4] - ay;
          const abz = raw.positions[tri + 5] - az;
          const acx = raw.positions[tri + 6] - ax;
          const acy = raw.positions[tri + 7] - ay;
          const acz = raw.positions[tri + 8] - az;
          const cx = aby * acz - abz * acy;
          const cy = abz * acx - abx * acz;
          const cz = abx * acy - aby * acx;
          expect(Math.hypot(cx, cy, cz)).toBeGreaterThan(1e-10);
        }

        const geometry = buildFloraSpeciesGeometry(archetype, seed);
        expect(geometry.boundingBox).not.toBeNull();
        expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(0);
        geometry.dispose();
      }
    },
  );

  it.each(TERRAIN_PROP_ARCHETYPE_IDS)("keeps %s still on its wood and at its base", (archetype) => {
    const species = FLORA_SPECIES[archetype];
    for (let seed = 0; seed < species.variants; seed++) {
      const { positions, foliage, bend } = buildFloraSpeciesMesh(archetype, seed);
      const heights: number[] = [];
      for (let offset = 1; offset < positions.length; offset += 3) heights.push(positions[offset]);
      const lowest = Math.min(...heights);
      const highest = Math.max(...heights);
      bend.forEach((weight, vertex) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
        const nearGround = (heights[vertex] - lowest) / (highest - lowest) <= 0.05;
        if (foliage[vertex] === 0 || nearGround) expect(weight).toBe(0);
      });
    }
  });

  it.each(TERRAIN_PROP_ARCHETYPE_IDS)(
    "keeps %s glow within 0 to 1, lit in the Hollow and dark elsewhere",
    (archetype) => {
      const layerId = LAYER_PROP_IDS.find((id) => id === archetype);
      const hollowBiomes = new Set<LayerBiome>(LAYER_BIOMES[2]);
      const hollow = layerId !== undefined && getLayerPropBiomes(layerId).every((biome) => hollowBiomes.has(biome));
      const species = FLORA_SPECIES[archetype];
      for (let seed = 0; seed < species.variants; seed++) {
        const { glow } = buildFloraSpeciesMesh(archetype, seed);
        for (const weight of glow) {
          expect(weight).toBeGreaterThanOrEqual(0);
          expect(weight).toBeLessThanOrEqual(1);
          if (!hollow) expect(weight).toBe(0);
        }
        if (hollow) expect(Math.max(...glow)).toBeGreaterThan(0);
      }
    },
  );

  it.each(TERRAIN_PROP_ARCHETYPE_IDS)("grows %s variants as different plants, never clones", (archetype) => {
    const species = FLORA_SPECIES[archetype];
    const shapes = Array.from({ length: species.variants }, (_, seed) => {
      const { positions } = buildFloraSpeciesMesh(archetype, seed);
      return { triangles: positions.length / 9, extents: extentsOf(positions) };
    });
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

  it("bends the palm's fronds from their roots, its tips the most", () => {
    const species = FLORA_SPECIES.palm;
    for (let seed = 0; seed < species.variants; seed++) {
      const { positions, foliage, bend } = buildFloraSpeciesMesh("palm", seed);
      const points: readonly (readonly [number, number, number])[] = Array.from(
        { length: positions.length / 3 },
        (_, index) => [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]] as const,
      );
      const wood = points.filter((_, vertex) => foliage[vertex] === 0);
      const crown = Math.max(...wood.map(([, y]) => y));
      const top = wood.filter(([, y]) => y > crown - 0.05);
      const axis = [0, 2].map((coord) => top.reduce((sum, point) => sum + point[coord], 0) / top.length);
      const fronds = points
        .map((point, vertex) => ({
          reach: Math.hypot(point[0] - axis[0], point[2] - axis[1]),
          weight: bend[vertex],
        }))
        .filter((_, vertex) => foliage[vertex] === 1)
        .toSorted((a, b) => a.reach - b.reach);
      const share = Math.ceil(fronds.length * 0.15);
      const mean = (rows: readonly { weight: number }[]) =>
        rows.reduce((sum, { weight }) => sum + weight, 0) / rows.length;
      expect(mean(fronds.slice(-share))).toBeGreaterThan(mean(fronds.slice(0, share)) + 0.4);
    }
  });
});

function extentsOf(positions: readonly number[]): readonly [number, number, number] {
  const axes = [0, 1, 2].map((axis) => {
    let min = Infinity;
    let max = -Infinity;
    for (let offset = axis; offset < positions.length; offset += 3) {
      if (positions[offset] < min) min = positions[offset];
      if (positions[offset] > max) max = positions[offset];
    }
    return max - min;
  });
  return [axes[0], axes[1], axes[2]];
}
