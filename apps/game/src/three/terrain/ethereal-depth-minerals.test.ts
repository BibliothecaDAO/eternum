import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { InstancedMesh } from "three";
import { expect, it, vi } from "vitest";
import { ProceduralTerrain } from "./procedural-terrain";
import { prepareTerrainPage } from "./terrain-page-builder";

const cells = Array.from({ length: 400 }, (_, index) => ({
  col: index % 20,
  row: Math.floor(index / 20),
  biome: BiomeType.Grassland,
  previewBiome: BiomeType.Grassland,
  explored: true,
  occupied: false,
  surfacePresentation: 2 as const,
}));
const request = {
  cells,
  halo: [],
  climate: NEUTRAL_BIOME_CLIMATE,
  mapCenter: 0,
  pageKey: "minerals",
  roadSegments: [],
  settlementAnchors: [],
  subdivisions: 2,
};

it("keeps mineral clusters deterministic, clear of occupancy and absent in unrevealed land", () => {
  const terrain = new ProceduralTerrain();
  const page = prepareTerrainPage(request);
  terrain.present([page]);
  let mesh: InstancedMesh | undefined;
  terrain.object3d.traverse((object) => {
    if (object instanceof InstancedMesh && object.userData.etherealDepth === 2) mesh = object;
  });
  expect(mesh).toBeDefined();
  const minerals = mesh!;
  expect(minerals.count).toBeGreaterThan(0);
  const original = Array.from(minerals.instanceMatrix.array);
  const count = minerals.count;
  const geometryDispose = vi.spyOn(minerals.geometry, "dispose");
  const material = Array.isArray(minerals.material) ? minerals.material[0] : minerals.material;
  const materialDispose = vi.spyOn(material, "dispose");
  terrain.refreshPropOccupancy(() => true);
  expect(minerals.count).toBe(0);
  terrain.refreshPropOccupancy(() => false);
  expect(minerals.count).toBe(count);
  expect(Array.from(minerals.instanceMatrix.array)).toEqual(original);
  const hidden = prepareTerrainPage({
    ...request,
    cells: cells.map((cell) => ({ ...cell, explored: false, biome: null })),
  });
  terrain.present([hidden]);
  expect(terrain.getEtherealPresentation()).toEqual([]);
  expect(geometryDispose).not.toHaveBeenCalled();
  expect(materialDispose).not.toHaveBeenCalled();
  terrain.dispose();
  expect(geometryDispose).toHaveBeenCalledOnce();
  expect(materialDispose).toHaveBeenCalledOnce();
});
