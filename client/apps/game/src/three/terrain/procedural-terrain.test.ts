import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { Group, Mesh } from "three";
import { describe, expect, it, vi } from "vitest";

import { terrainHexToWorld } from "./terrain-coordinates";
import { ProceduralTerrain } from "./procedural-terrain";
import { TerrainPropPools } from "./terrain-prop-pools";

describe("ProceduralTerrain", () => {
  it("atomically presents, reuses, replaces, and disposes page geometry", () => {
    const terrain = new ProceduralTerrain();
    const first = terrain.preparePage(request(BiomeType.Grassland, false));
    const firstSummary = terrain.present([first]);
    const firstMesh = terrain.object3d.getObjectByName("procedural-terrain-land") as Mesh;
    const dispose = vi.spyOn(firstMesh.geometry, "dispose");

    expect(firstSummary.pages).toBe(1);
    terrain.present([first]);
    expect(dispose).not.toHaveBeenCalled();

    const replacement = terrain.preparePage(request(BiomeType.Grassland, true));
    terrain.present([replacement]);
    expect(dispose).toHaveBeenCalledOnce();

    const replacementMesh = terrain.object3d.getObjectByName("procedural-terrain-land") as Mesh;
    const replacementDispose = vi.spyOn(replacementMesh.geometry, "dispose");
    terrain.dispose();
    terrain.dispose();
    expect(replacementDispose).toHaveBeenCalledOnce();
  });

  it("samples the presented surface and rejects use after disposal", () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(request(BiomeType.Bare, true))]);
    const center = terrainHexToWorld(0, 0);

    expect(terrain.sampleSurface(center.x, center.z).biome).toBe(BiomeType.Bare);
    terrain.dispose();
    expect(() => terrain.sampleSurface(center.x, center.z)).toThrow("ProceduralTerrain has been disposed");
  });

  it("keeps terrain out of the interaction raycast path", () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(request(BiomeType.Snow, false))]);
    const mesh = terrain.object3d.getObjectByName("procedural-terrain-land") as Mesh;

    expect(mesh.raycast.name).toBe("disableTerrainRaycast");
    terrain.dispose();
  });

  it("retains a requested prop LOD while the catalog loads", async () => {
    const pools = {
      dispose: vi.fn(),
      getStats: vi.fn(() => ({ instances: 0, triangles: 0 })),
      object3d: new Group(),
      setLod: vi.fn(),
      update: vi.fn(),
    };
    const load = vi.spyOn(TerrainPropPools, "load").mockResolvedValue(pools as unknown as TerrainPropPools);
    const terrain = new ProceduralTerrain();

    terrain.setPropLod("far");
    await terrain.loadProps();

    expect(pools.setLod).toHaveBeenCalledWith("far");
    terrain.dispose();
    load.mockRestore();
  });
});

function request(biome: BiomeType, occupied: boolean) {
  return {
    cells: [{ biome, col: 0, occupied, row: 0 }],
    climate: NEUTRAL_BIOME_CLIMATE,
    generation: 1,
    halo: [],
    mapCenter: 0,
    pageKey: "page",
    subdivisions: 2,
  };
}
