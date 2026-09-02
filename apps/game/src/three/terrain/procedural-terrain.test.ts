import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { Group, InstancedMesh, Mesh } from "three";
import { describe, expect, it, vi } from "vitest";

import { terrainHexToWorld } from "./terrain-coordinates";
import { ProceduralTerrain } from "./procedural-terrain";
import { TerrainPropPools } from "./terrain-prop-pools";
import type { TerrainCellInput } from "./terrain-types";

vi.mock("./terrain-prop-asset-cache", async () => {
  const { createTerrainPropCatalogFixture } = await import("./verification/terrain-prop-catalog-fixture");
  return { loadTerrainPropCatalog: () => Promise.resolve({ scene: createTerrainPropCatalogFixture() }) };
});

describe("ProceduralTerrain", () => {
  it("atomically presents, reuses, replaces, and disposes page geometry", () => {
    const terrain = new ProceduralTerrain();
    const first = terrain.preparePage(request(BiomeType.Grassland, false));
    const firstSummary = terrain.present([first]);
    const firstMesh = terrain.object3d.getObjectByName("procedural-terrain-land") as Mesh;
    const dispose = vi.spyOn(firstMesh.geometry, "dispose");

    expect(firstSummary.pages).toBe(1);
    const sameContent = terrain.preparePage(request(BiomeType.Grassland, false));
    expect(sameContent.fingerprint).toBe(first.fingerprint);
    terrain.present([sameContent]);
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

  it("keeps newly explored terrain covered until commit and finishes the reveal without retained state", () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(unknownRequest())]);
    expect(terrain.getShroudStats()).toMatchObject({ activeReveals: 0, instances: 1 });

    terrain.queueShroudReveal(0, 0);
    terrain.present([terrain.preparePage(request(BiomeType.Grassland, false))]);
    expect(terrain.getShroudStats()).toMatchObject({ activeReveals: 1, instances: 1 });
    for (let frame = 0; frame < 20; frame += 1) terrain.update(0.05);
    expect(terrain.getShroudStats()).toMatchObject({ activeReveals: 0, instances: 0 });
    terrain.dispose();
  });

  it("writes only the changed page's prop slots and fog sub-rect on a later present", async () => {
    const terrain = new ProceduralTerrain();
    await terrain.loadProps();
    const west = terrain.preparePage(blockRequest("west", 0));
    const east = terrain.preparePage(blockRequest("east", 10));
    terrain.present([west]);
    const westUploads = collectPropUploads(terrain);
    clearPropUploads(terrain);
    terrain.present([west, east]);
    clearPropUploads(terrain);
    const settled = terrain.getUploadMetrics();
    expect(settled).toMatchObject({ fogMaskFullRebuilds: 2, fogMaskPageWrites: 0, propPoolPageWrites: 2 });
    expect(settled.propPoolFullRewrites).toBe(0);

    terrain.present([west, east]);
    expect(terrain.getUploadMetrics()).toEqual(settled);
    expect(collectPropUploads(terrain)).toHaveLength(0);

    const changedEast = terrain.preparePage(blockRequest("east", 10, { exploredCell: [12, 6] }));
    expect(changedEast.fingerprint).not.toBe(east.fingerprint);
    terrain.present([west, changedEast]);
    const eastUploads = collectPropUploads(terrain);

    expect(eastUploads.length).toBeGreaterThan(0);
    expect(eastUploads.filter((upload) => westUploads.includes(upload))).toEqual([]);
    expect(terrain.getUploadMetrics()).toMatchObject({
      fogMaskFullRebuilds: 2,
      fogMaskPageWrites: 1,
      propPoolFullRewrites: 0,
      propPoolPageWrites: 3,
    });

    terrain.present([west]);
    expect(terrain.getPropStats().instances).toBe(west.propInstances.length);
    expect(terrain.getShroudStats().instances).toBe(west.shroudInstances.length);
    terrain.dispose();
  });

  it("writes every retained page once when the prop catalog arrives after the pages", async () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(blockRequest("west", 0)), terrain.preparePage(blockRequest("east", 10))]);
    expect(terrain.getUploadMetrics()).toMatchObject({ propPoolFullRewrites: 0, propPoolPageWrites: 0 });

    await terrain.loadProps();

    expect(terrain.getUploadMetrics()).toMatchObject({ propPoolFullRewrites: 1, propPoolPageWrites: 2 });
    expect(terrain.getPropStats().instances).toBeGreaterThan(0);
    terrain.dispose();
  });

  it("retains a requested quality tier while the catalog loads", async () => {
    const pools = {
      dispose: vi.fn(),
      getStats: vi.fn(() => ({ groundCoverInstances: 0, instances: 0, triangles: 0 })),
      object3d: new Group(),
      setLod: vi.fn(),
      setWindStrength: vi.fn(),
      writePage: vi.fn(),
    };
    const load = vi.spyOn(TerrainPropPools, "load").mockResolvedValue(pools as unknown as TerrainPropPools);
    const terrain = new ProceduralTerrain();

    terrain.setQualityTier("overview");
    await terrain.loadProps();

    expect(pools.setLod).toHaveBeenCalledWith("far");
    expect(pools.setWindStrength).toHaveBeenCalledWith(0.12);
    expect(terrain.getQualityTier()).toBe("overview");
    terrain.dispose();
    load.mockRestore();
  });

  it("presents bounded movement effects according to the terrain quality tier", () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(request(BiomeType.Bare, false))]);
    terrain.setMovementInteractions([
      { entityId: 3, isMoving: true, mode: "naval", worldX: 2, worldY: 0, worldZ: 4, yaw: 0.5 },
      { entityId: 8, isMoving: false, mode: "naval", worldX: 5, worldY: 0, worldZ: 6, yaw: 0 },
      { entityId: 13, isMoving: true, mode: "ground", worldX: 0, worldY: 0, worldZ: 0, yaw: 0 },
    ]);
    terrain.update(0);

    expect(terrain.getMovementInteractionStats()).toMatchObject({
      drawCalls: 2,
      dust: { activeParticles: 1, emitters: 1, triangles: 2 },
      triangles: 6,
      water: { instances: 2, triangles: 4, wakes: 1 },
    });
    terrain.setQualityTier("overview");
    expect(terrain.getMovementInteractionStats()).toMatchObject({
      drawCalls: 0,
      dust: { activeParticles: 0, emitters: 0 },
      water: { instances: 0, triangles: 0, wakes: 0 },
    });
    terrain.setQualityTier("detail");
    terrain.update(0);
    expect(terrain.getMovementInteractionStats()).toMatchObject({
      drawCalls: 2,
      dust: { activeParticles: 1, emitters: 1 },
      water: { instances: 2, triangles: 4, wakes: 1 },
    });
    terrain.dispose();
  });

  it("counts a settlement influence once when it overlaps multiple prepared pages", () => {
    const terrain = new ProceduralTerrain();
    const anchor = { col: 0, level: 2, row: 0, structureId: "realm", structureType: StructureType.Realm };
    const first = terrain.preparePage({
      ...request(BiomeType.Grassland, true),
      pageKey: "first",
      settlementAnchors: [anchor],
    });
    const second = terrain.preparePage({
      ...request(BiomeType.Grassland, false),
      cells: [
        {
          biome: BiomeType.Grassland,
          col: 1,
          explored: true,
          occupied: false,
          previewBiome: BiomeType.Grassland,
          row: 0,
        },
      ],
      pageKey: "second",
      settlementAnchors: [anchor],
    });

    expect(terrain.present([first, second]).settlementSites).toBe(1);
    terrain.dispose();
  });
});

function request(biome: BiomeType, occupied: boolean) {
  return {
    cells: [{ biome, col: 0, explored: true, occupied, previewBiome: biome, row: 0 }],
    climate: NEUTRAL_BIOME_CLIMATE,
    halo: [],
    mapCenter: 0,
    pageKey: "page",
    roadSegments: [],
    settlementAnchors: [],
    subdivisions: 2,
  };
}

function unknownRequest() {
  return {
    ...request(BiomeType.None, false),
    cells: [{ biome: null, col: 0, explored: false, occupied: false, previewBiome: BiomeType.Grassland, row: 0 }],
  };
}

/**
 * Six explored grassland columns from `minCol` over rows 0..5 plus two unexplored rows beneath them; `exploredCell`
 * explores one of the fogged cells, which changes both the page's props and its shroud.
 */
function blockRequest(pageKey: string, minCol: number, options: { exploredCell?: readonly [number, number] } = {}) {
  const cells: TerrainCellInput[] = [];
  for (let row = 0; row <= 7; row += 1) {
    for (let col = minCol; col < minCol + 6; col += 1) {
      const explored = row <= 5 || (col === options.exploredCell?.[0] && row === options.exploredCell?.[1]);
      cells.push({
        biome: explored ? BiomeType.Grassland : null,
        col,
        explored,
        occupied: false,
        previewBiome: BiomeType.Grassland,
        row,
      });
    }
  }
  return { ...request(BiomeType.Grassland, false), cells, pageKey };
}

function propPoolMeshes(terrain: ProceduralTerrain): InstancedMesh[] {
  const meshes: InstancedMesh[] = [];
  terrain.object3d.traverse((object) => {
    if (object instanceof InstancedMesh && object.name.startsWith("terrain-prop-pool:")) meshes.push(object);
  });
  return meshes;
}

/** Every queued instance-matrix upload as `pool@start`, the sub-range identity a page's slot owns. */
function collectPropUploads(terrain: ProceduralTerrain): string[] {
  return propPoolMeshes(terrain).flatMap((mesh) =>
    mesh.instanceMatrix.updateRanges.map((range) => `${mesh.name}@${range.start}`),
  );
}

/** What the renderer does to the asserted matrix ranges after consuming them on a draw. */
function clearPropUploads(terrain: ProceduralTerrain): void {
  propPoolMeshes(terrain).forEach((mesh) => mesh.instanceMatrix.clearUpdateRanges());
}
