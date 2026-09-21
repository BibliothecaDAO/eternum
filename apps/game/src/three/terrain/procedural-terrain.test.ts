import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { Group, InstancedMesh, Mesh, PerspectiveCamera, Scene } from "three";
import { describe, expect, it, vi } from "vitest";

import { terrainHexToWorld } from "./terrain-coordinates";
import { TerrainField } from "./terrain-field";
import { BASALT_SUPPORT_HEIGHT } from "./terrain-basalt";
import { TerrainFogField } from "./terrain-fog-field";
import { ProceduralTerrain } from "./procedural-terrain";
import { TerrainPropPools } from "./terrain-prop-pools";
import type { TerrainCellInput } from "./terrain-types";

vi.mock("./terrain-prop-asset-cache", async () => {
  const { createTerrainPropCatalogFixture } = await import("./verification/terrain-prop-catalog-fixture");
  return { loadTerrainPropCatalog: () => Promise.resolve({ scene: createTerrainPropCatalogFixture() }) };
});

describe("ProceduralTerrain", () => {
  it("uses one flat shared surface for every occupied state and camera distance", () => {
    const terrain = new ProceduralTerrain();
    const pages = [-1, 0].flatMap((pageRow) =>
      [-1, 0].map((pageCol) =>
        terrain.preparePage({
          ...request(BiomeType.Grassland, false),
          surfacePresentation: "ethereal",
          pageKey: `basalt:${pageCol}:${pageRow}`,
          cells: Array.from({ length: 144 }, (_, index) => ({
            biome: BiomeType.Grassland,
            previewBiome: BiomeType.Grassland,
            explored: true,
            occupied: index % 17 === 0,
            col: pageCol * 12 + (index % 12),
            row: pageRow * 12 + Math.floor(index / 12),
          })),
        }),
      ),
    );
    terrain.present(pages);
    const meshes: InstancedMesh[] = [];
    terrain.object3d.traverse((object) => {
      if (object instanceof InstancedMesh && object.userData.basaltInstances) meshes.push(object);
    });
    const far = meshes.filter((mesh) => mesh.name === "procedural-terrain-basalt");
    expect(meshes).toHaveLength(4);
    expect(far).toHaveLength(4);
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(1);
    const initialMatrices = meshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
    const initialTriangles = terrain.summarize(pages).triangles;
    const sharedDisposals = [...new Set(meshes.map((mesh) => mesh.geometry))].map((geometry) =>
      vi.spyOn(geometry, "dispose"),
    );
    const camera = new PerspectiveCamera();
    const draw = (height: number) => {
      camera.position.set(0, height, height);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      for (const mesh of far)
        mesh.onBeforeRender(
          // The shared instancing helper reads the backend on the first draw; a WebGL-shaped stub keeps it native.
          {} as Parameters<Mesh["onBeforeRender"]>[0],
          new Scene(),
          camera,
          mesh.geometry,
          Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
          null!,
        );
      expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(576);
    };
    for (const height of [35, 10, 2, 35]) {
      draw(height);
      expect(meshes.map((mesh) => Array.from(mesh.instanceMatrix.array))).toEqual(initialMatrices);
      expect(terrain.summarize(pages).triangles).toBe(initialTriangles);
      expect(terrain.summarize(pages).triangles).toBeLessThan(20_000);
    }
    expect(terrain.summarize(pages).geometryBytes).toBeLessThan(2 * 1024 * 1024);
    for (const page of pages) {
      const field = new TerrainField(page.request);
      for (const cell of page.request.cells) {
        const center = terrainHexToWorld(cell.col, cell.row);
        expect(field.sampleSurface(center.x, center.z).height).toBe(BASALT_SUPPORT_HEIGHT);
      }
    }
    terrain.present([pages[0]]);
    expect(sharedDisposals.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    terrain.dispose();
    expect(sharedDisposals.every((spy) => spy.mock.calls.length === 1)).toBe(true);
  });

  it("builds basalt without world textures and retains its material across quality changes", async () => {
    const terrain = new ProceduralTerrain();
    terrain.setSurfacePresentation("ethereal");
    const prepared = terrain.preparePage({ ...forestRequest(), surfacePresentation: "ethereal" });
    terrain.present([prepared]);
    const basalt = terrain.object3d.getObjectByName("procedural-terrain-basalt") as Mesh;
    const borders = terrain.object3d.getObjectByName("procedural-terrain-borders") as Mesh;
    expect(basalt).toBeDefined();
    expect(borders).toBeDefined();
    expect(terrain.object3d.getObjectByName("procedural-terrain-land")).toBeUndefined();
    expect(prepared.propInstances).toHaveLength(0);
    const material = basalt.material;
    const dispose = vi.spyOn(Array.isArray(material) ? material[0] : material, "dispose");
    terrain.setQualityTier("overview");
    terrain.setQualityTier("detail");
    expect(basalt.material).toBe(material);
    const basaltGeometryDispose = vi.spyOn(basalt.geometry, "dispose");
    const borderGeometryDispose = vi.spyOn(borders.geometry, "dispose");
    terrain.setSurfacePresentation("world");
    terrain.present([terrain.preparePage(forestRequest())]);
    expect(basaltGeometryDispose).not.toHaveBeenCalled();
    expect(borderGeometryDispose).toHaveBeenCalledOnce();
    expect(terrain.object3d.getObjectByName("procedural-terrain-land")).toBeDefined();
    terrain.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(basaltGeometryDispose).toHaveBeenCalledOnce();
  });

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

  it("clears occupied prop tiles atomically and restores them without rebuilding terrain", async () => {
    const terrain = new ProceduralTerrain();
    await terrain.loadProps();
    const page = terrain.preparePage(blockRequest("occupied", 0));
    terrain.present([page]);
    expect(page.propInstances.length).toBeGreaterThan(0);
    const mesh = terrain.object3d.getObjectByName("procedural-terrain-land") as Mesh;
    const geometry = mesh.geometry;
    const owner = page.propInstances[0];
    const occupied = (col: number, row: number) => col === owner.ownerCol && row === owner.ownerRow;
    terrain.refreshPropOccupancy(occupied);
    expect(terrain.getPropStats().instances).toBeLessThanOrEqual(
      page.propInstances.filter((p) => !occupied(p.ownerCol, p.ownerRow)).length,
    );
    expect(mesh.geometry).toBe(geometry);
    const metrics = terrain.getUploadMetrics();
    terrain.refreshPropOccupancy(occupied);
    expect(terrain.getUploadMetrics()).toEqual(metrics);
    terrain.refreshPropOccupancy(() => false);
    expect(terrain.getPropStats().instances).toBe(page.propInstances.length);
    terrain.dispose();
  });

  it("samples the presented surface and rejects use after disposal", () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(request(BiomeType.Bare, true))]);
    const center = terrainHexToWorld(0, 0);

    expect(terrain.sampleSurface(center.x, center.z).biome).toBe(BiomeType.Bare);
    terrain.dispose();
    expect(() => terrain.sampleSurface(center.x, center.z)).toThrow("ProceduralTerrain has been disposed");
  });

  it("samples the owning resident page instead of an earlier page's halo", () => {
    const terrain = new ProceduralTerrain();
    const covered = { ...unknownRequest(), pageKey: "covered" };
    const neighbor = {
      ...request(BiomeType.Bare, false),
      pageKey: "neighbor",
      cells: request(BiomeType.Bare, false).cells.map((cell) => ({ ...cell, col: 1 })),
      halo: request(BiomeType.Grassland, false).cells,
    };
    terrain.present([terrain.preparePage(neighbor), terrain.preparePage(covered)]);
    const expected = new TerrainField(covered).sampleSurface(0, 0);
    expect(terrain.sampleSurface(0, 0)).toEqual(expected);
    expect(expected.biome).toBeNull();
    expect(terrain.sampleSurface(-10, -10)).toEqual({ biome: null, height: 0, normal: [0, 1, 0] });
    terrain.dispose();
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
    expect(terrain.getShroudStats()).toMatchObject({ activeReveals: 1, instances: 0 });
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

  it("commits ready pages incrementally with the same writes as one full presentation", async () => {
    const terrain = new ProceduralTerrain();
    await terrain.loadProps();
    const west = terrain.preparePage(blockRequest("west", 0));
    const east = terrain.preparePage(blockRequest("east", 10));

    expect(terrain.isPagePresented(west)).toBe(false);
    terrain.commitPages([west]);
    terrain.commitPages([east]);
    expect(terrain.isPagePresented(west)).toBe(true);
    const stepped = terrain.summarize([west, east]);
    const settled = terrain.getUploadMetrics();
    clearPropUploads(terrain);

    expect(stepped.pages).toBe(2);
    expect(settled).toMatchObject({ fogMaskFullRebuilds: 2, propPoolFullRewrites: 0, propPoolPageWrites: 2 });
    expect(terrain.present([west, east])).toEqual(stepped);
    expect(terrain.getUploadMetrics()).toEqual(settled);
    expect(collectPropUploads(terrain)).toHaveLength(0);
    terrain.dispose();
  });

  it("restores the prior complete presentation when a grouped page write fails", async () => {
    const terrain = new ProceduralTerrain();
    await terrain.loadProps();
    const writeProps = vi.spyOn(TerrainPropPools.prototype, "writePage");
    const previous = terrain.preparePage(blockRequest("page", 0));
    terrain.present([previous]);
    const previousProps = writeProps.mock.calls.at(-1)![1];
    expect(previousProps.length).toBeGreaterThan(0);
    const previousMesh = terrain.object3d.getObjectByName("procedural-terrain-land") as Mesh;
    const disposePrevious = vi.spyOn(previousMesh.geometry, "dispose");
    const replacement = terrain.preparePage(request(BiomeType.Taiga, false));
    const added = terrain.preparePage({
      ...request(BiomeType.Beach, false),
      cells: [{ biome: null, col: 10, explored: false, occupied: false, previewBiome: BiomeType.Beach, row: 0 }],
      pageKey: "added",
    });
    const setPage = TerrainFogField.prototype.setPage;
    let rejectAddedPage = true;
    vi.spyOn(TerrainFogField.prototype, "setPage").mockImplementation(function (
      this: TerrainFogField,
      pageKey,
      instances,
    ) {
      if (pageKey === "added" && rejectAddedPage) {
        rejectAddedPage = false;
        throw new Error("injected fog write failure");
      }
      return setPage.call(this, pageKey, instances);
    });

    writeProps.mockClear();
    expect(() => terrain.commitPages([replacement, added])).toThrow("injected fog write failure");
    const restoredProps = writeProps.mock.calls.filter(([key]) => key === previous.request.pageKey).at(-1)![1];
    expect(restoredProps).toEqual(previousProps);
    expect(terrain.getPropStats().instances).toBe(previousProps.length);

    const center = terrainHexToWorld(0, 0);
    expect(terrain.isPagePresented(previous)).toBe(true);
    expect(terrain.isPagePresented(replacement)).toBe(false);
    expect(terrain.sampleSurface(center.x, center.z).biome).toBe(BiomeType.Grassland);
    expect(disposePrevious).not.toHaveBeenCalled();
    expect(terrain.object3d.getObjectByName("procedural-terrain-land")).toBe(previousMesh);

    terrain.commitPages([replacement, added]);
    expect(terrain.isPagePresented(replacement)).toBe(true);
    expect(disposePrevious).toHaveBeenCalledOnce();
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

  it("applies ambient motion preferences across LOD changes and releases its subscription", async () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(unknownRequest())]);
    await terrain.loadProps();
    const setWind = vi.spyOn(TerrainPropPools.prototype, "setWindStrength");
    const fogBefore = terrain.getShroudStats();
    useWorldAppearanceStore.getState().setReducedMotion(true);
    terrain.setQualityTier("overview");
    terrain.setQualityTier("detail");
    expect(setWind).toHaveBeenLastCalledWith(0);
    useWorldAppearanceStore.getState().setFogStyle("mist");
    expect(terrain.getShroudStats()).toEqual(fogBefore);
    terrain.dispose();
    setWind.mockClear();
    useWorldAppearanceStore.getState().setReducedMotion(false);
    useWorldAppearanceStore.getState().setFogStyle("clear");
    expect(setWind).not.toHaveBeenCalled();
    setWind.mockRestore();
  });

  it("hides wildlife for overview and reduced motion, then releases it with its terrain page", () => {
    const terrain = new ProceduralTerrain();
    terrain.present([terrain.preparePage(forestRequest())]);
    const wildlife = terrain.object3d.getObjectByName("terrain-wildlife")!;
    expect(terrain.getWildlifeStats().count).toBe(0); // Ambient spawning is deferred beyond the terrain commit.
    expect(wildlife.visible).toBe(true);
    terrain.setQualityTier("overview");
    expect(wildlife.visible).toBe(false);
    terrain.setQualityTier("detail");
    expect(wildlife.visible).toBe(true);
    useWorldAppearanceStore.getState().setReducedMotion(true);
    expect(wildlife.visible).toBe(false);
    terrain.present([]);
    expect(terrain.getWildlifeStats().count).toBe(0);
    terrain.dispose();
    useWorldAppearanceStore.getState().setReducedMotion(false);
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

function forestRequest() {
  const source = blockRequest("forest", 0);
  return {
    ...source,
    cells: source.cells.map((cell) => ({
      ...cell,
      biome: cell.explored ? BiomeType.TemperateRainForest : null,
      previewBiome: BiomeType.TemperateRainForest,
    })),
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
