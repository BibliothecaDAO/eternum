import { BufferAttribute, InstancedMesh, Matrix4, Mesh } from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { TERRAIN_PROP_ARCHETYPE_IDS, type TerrainPropArchetypeId } from "./terrain-prop-catalog";
import { TERRAIN_PROP_PAGE_SLOT_CAPACITY, TERRAIN_PROP_POOL_PAGE_SLOTS, TerrainPropPools } from "./terrain-prop-pools";
import type { TerrainPropInstance } from "./terrain-types";

vi.mock("./terrain-prop-asset-cache", async () => {
  const { createTerrainPropCatalogFixture } = await import("./verification/terrain-prop-catalog-fixture");
  const scene = createTerrainPropCatalogFixture();
  for (const lod of ["near", "far"]) {
    (scene.getObjectByName(`grass-tuft-${lod}`) as Mesh).geometry.scale(0.12, 0.12, 0.12);
  }
  return { loadTerrainPropCatalog: () => Promise.resolve({ scene }) };
});

const MATRIX_FLOATS = 16;

describe("TerrainPropPools", () => {
  let pools: TerrainPropPools;

  beforeAll(async () => {
    pools = await TerrainPropPools.load();
  });
  afterAll(() => pools.dispose());

  it("normalizes grass bend from root to tip using the plant’s actual height", () => {
    const bend = poolMesh(pools, "grass-tuft").geometry.getAttribute("terrainPropBend");
    const weights = Array.from({ length: bend.count }, (_, index) => bend.getX(index));
    expect(Math.min(...weights)).toBe(0);
    expect(Math.max(...weights)).toBe(1);
    expect(bend.getY(0)).toBeCloseTo(0.12);
  });

  it("keeps world and local instance data isolated when they load the same cached catalog", async () => {
    const world = await TerrainPropPools.load();
    const local = await TerrainPropPools.load();
    try {
      const worldTree = poolMesh(world, "broadleaf");
      const localTree = poolMesh(local, "broadleaf");
      expect(worldTree.geometry).not.toBe(localTree.geometry);
      expect(ecologyAttribute(worldTree)).not.toBe(ecologyAttribute(localTree));
      world.writePage("forest", instances("broadleaf", 1));
      local.writePage("snow", [
        { ...instances("broadleaf", 1)[0], appearance: { moss: 0, snow: 1, tint: [1, 1, 1], windAmplitude: 0 } },
      ]);
      expect(ecologyAttribute(worldTree).getZ(0)).toBe(0);
      expect(ecologyAttribute(localTree).getZ(0)).toBe(1);
      local.setLod("far");
      const disposeFar = vi.spyOn(localTree.geometry, "dispose");
      local.dispose();
      expect(disposeFar).toHaveBeenCalledOnce();
      world.setLod("far");
      expect(ecologyAttribute(worldTree).getZ(0)).toBe(0);
      world.setLod("near");
      expect(ecologyAttribute(worldTree).getZ(0)).toBe(0);
    } finally {
      world.dispose();
      local.dispose();
    }
  });

  it("sizes every pool as one fixed slot per composed page and never grows it", () => {
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      const mesh = poolMesh(pools, archetype);
      expect(mesh.instanceMatrix.count).toBe(TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype] * TERRAIN_PROP_POOL_PAGE_SLOTS);
      expect(mesh.count).toBe(0);
      expect(mesh.visible).toBe(false);
    }
  });

  it("casts canopy shadows only at close zoom and leaves ground cover out of the shadow pass", () => {
    pools.setLod("near");
    expect(poolMesh(pools, "broadleaf").castShadow).toBe(true);
    expect(poolMesh(pools, "grass-tuft").castShadow).toBe(false);
    pools.setLod("far");
    expect(poolMesh(pools, "broadleaf").castShadow).toBe(false);
    pools.setLod("near");
    expect(poolMesh(pools, "broadleaf").castShadow).toBe(true);
  });

  it("packs pages into the live prefix and uploads only changed instances", () => {
    pools.writePage("east", instances("conifer", 3));
    pools.writePage("west", instances("conifer", 2));
    const mesh = poolMesh(pools, "conifer");
    const start = 3;
    clearUploads(pools);

    pools.writePage("west", instances("conifer", 5));

    expect(mesh.instanceMatrix.updateRanges).toEqual([{ count: 5 * MATRIX_FLOATS, start: start * MATRIX_FLOATS }]);
    expect(mesh.instanceColor?.updateRanges).toEqual([{ count: 5 * 3, start: start * 3 }]);
    expect(ecologyRanges(mesh)).toEqual([{ count: 5 * 3, start: start * 3 }]);
    expect(mesh.count).toBe(8);
    expect(pools.getStats().instances).toBe(8);
    expect(pools.getMetrics()).toMatchObject({ paddingInstances: 0, pageWrites: 3 });
    pools.releasePage("east");
    pools.releasePage("west");
  });

  it("excludes a shrinking page tail from the draw without uploading discarded instances", () => {
    pools.writePage("only", instances("boulder", 4));
    const mesh = poolMesh(pools, "boulder");
    clearUploads(pools);

    pools.writePage("only", instances("boulder", 1));

    expect(mesh.instanceMatrix.updateRanges).toEqual([{ count: MATRIX_FLOATS, start: 0 }]);
    expect(mesh.count).toBe(1);
    expect(pools.getMetrics().paddingInstances).toBe(0);
    pools.releasePage("only");
  });

  it("releases a page's slot so a later page reuses it and the drawn prefix shrinks", () => {
    pools.writePage("first", instances("shrub", 2));
    pools.writePage("second", instances("shrub", 2));
    const mesh = poolMesh(pools, "shrub");
    expect(mesh.count).toBe(4);

    pools.releasePage("second");
    expect(mesh.count).toBe(2);
    pools.releasePage("first");
    expect(mesh.count).toBe(0);
    expect(mesh.visible).toBe(false);

    clearUploads(pools);
    pools.writePage("third", instances("shrub", 1));
    expect(mesh.count).toBe(1);
    expect(mesh.instanceMatrix.updateRanges).toEqual([{ count: MATRIX_FLOATS, start: 0 }]);
    pools.releasePage("third");
  });

  it("preserves following transforms and ecology when an earlier page grows, shrinks, leaves and returns", () => {
    const follower = instances("shrub", 2).map((instance, index) => ({
      ...instance,
      worldX: 80 + index,
      appearance: { moss: 0.7, snow: 0.9, tint: [0.2, 0.4, 0.8] as [number, number, number], windAmplitude: 0.3 },
    }));
    pools.writePage("early", instances("shrub", 1));
    pools.writePage("later", follower);
    const mesh = poolMesh(pools, "shrub");
    const matrix = new Matrix4();
    const color = mesh.instanceColor!.array.slice(3, 6);
    const ecology = ecologyAttribute(mesh).array.slice(3, 6);
    for (const size of [5, 2, 0, 3]) {
      if (size === 0) pools.releasePage("early");
      else pools.writePage("early", instances("shrub", size));
      expect(mesh.count).toBe(size + 2);
      for (let index = 0; index < 2; index++) {
        mesh.getMatrixAt(size + index, matrix);
        expect(matrix.elements[12]).toBe(80 + index);
        expect(mesh.instanceColor!.array.slice((size + index) * 3, (size + index + 1) * 3)).toEqual(color);
        expect(ecologyAttribute(mesh).array.slice((size + index) * 3, (size + index + 1) * 3)).toEqual(ecology);
      }
      expect(pools.getMetrics().paddingInstances).toBe(0);
    }
    pools.releasePage("early");
    pools.releasePage("later");
  });

  it("fails loudly when a page outgrows its slot or the pool runs out of page slots", () => {
    const capacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY.wildflower;
    expect(() => pools.writePage("dense", instances("wildflower", capacity + 1))).toThrow(
      `Terrain page dense needs ${capacity + 1} wildflower props; a page slot holds ${capacity}`,
    );

    const pageKeys = Array.from({ length: TERRAIN_PROP_POOL_PAGE_SLOTS }, (_, index) => `page-${index}`);
    pageKeys.forEach((pageKey) => pools.writePage(pageKey, instances("fern", 1)));
    expect(() => pools.writePage("overflow", instances("fern", 1))).toThrow(
      `Terrain prop pool fern holds ${TERRAIN_PROP_POOL_PAGE_SLOTS} pages and has no slot left for page overflow`,
    );
    pageKeys.forEach((pageKey) => pools.releasePage(pageKey));
  });
});

function instances(archetype: TerrainPropArchetypeId, count: number): TerrainPropInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    appearance: { moss: 0.2, snow: 0, tint: [0.3, 0.5, 0.2], windAmplitude: 0.5 },
    archetype,
    ownerCol: index,
    ownerRow: 0,
    pageKey: "fixture",
    scale: 1,
    worldX: index * 1.7,
    worldY: 0,
    worldZ: 0,
    yaw: 0,
  }));
}

function poolMesh(pools: TerrainPropPools, archetype: TerrainPropArchetypeId): InstancedMesh {
  const mesh = pools.object3d.getObjectByName(`terrain-prop-pool:${archetype}`);
  if (!(mesh instanceof InstancedMesh)) throw new Error(`missing pool mesh for ${archetype}`);
  return mesh;
}

function ecologyAttribute(mesh: InstancedMesh): BufferAttribute {
  const attribute = mesh.geometry.getAttribute("terrainPropEcology");
  if (!(attribute instanceof BufferAttribute)) throw new Error(`${mesh.name} has no ecology buffer attribute`);
  return attribute;
}

function ecologyRanges(mesh: InstancedMesh): Array<{ count: number; start: number }> {
  return ecologyAttribute(mesh).updateRanges;
}

/** What the renderer does after consuming the ranges on a draw. */
function clearUploads(pools: TerrainPropPools): void {
  for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
    const mesh = poolMesh(pools, archetype);
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceColor?.clearUpdateRanges();
    ecologyAttribute(mesh).clearUpdateRanges();
  }
}
