import { BufferAttribute, InstancedMesh, Matrix4 } from "three";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TERRAIN_PROP_ARCHETYPE_IDS, type TerrainPropArchetypeId } from "./terrain-prop-catalog";
import { TERRAIN_PROP_PAGE_SLOT_CAPACITY, TERRAIN_PROP_POOL_PAGE_SLOTS, TerrainPropPools } from "./terrain-prop-pools";
import type { TerrainPropInstance } from "./terrain-types";

vi.mock("./terrain-prop-asset-cache", async () => {
  const { createTerrainPropCatalogFixture } = await import("./verification/terrain-prop-catalog-fixture");
  return { loadTerrainPropCatalog: () => Promise.resolve({ scene: createTerrainPropCatalogFixture() }) };
});

const MATRIX_FLOATS = 16;

describe("TerrainPropPools", () => {
  let pools: TerrainPropPools;

  beforeAll(async () => {
    pools = await TerrainPropPools.load();
  });

  it("sizes every pool as one fixed slot per composed page and never grows it", () => {
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      const mesh = poolMesh(pools, archetype);
      expect(mesh.instanceMatrix.count).toBe(TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype] * TERRAIN_PROP_POOL_PAGE_SLOTS);
      expect(mesh.count).toBe(0);
      expect(mesh.visible).toBe(false);
    }
  });

  it("writes a page into its own slot sub-range and uploads only that range", () => {
    pools.writePage("east", instances("conifer", 3));
    pools.writePage("west", instances("conifer", 2));
    const mesh = poolMesh(pools, "conifer");
    const capacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY.conifer;
    clearUploads(pools);

    pools.writePage("west", instances("conifer", 5));

    expect(mesh.instanceMatrix.updateRanges).toEqual([{ count: 5 * MATRIX_FLOATS, start: capacity * MATRIX_FLOATS }]);
    expect(mesh.instanceColor?.updateRanges).toEqual([{ count: 5 * 3, start: capacity * 3 }]);
    expect(ecologyRanges(mesh)).toEqual([{ count: 5 * 3, start: capacity * 3 }]);
    expect(mesh.count).toBe(capacity + 5);
    expect(pools.getStats().instances).toBe(8);
    expect(pools.getMetrics()).toMatchObject({ paddingInstances: capacity - 3, pageWrites: 3 });
    pools.releasePage("east");
    pools.releasePage("west");
  });

  it("zero-scales the tail a shrinking page leaves behind and uploads it with the page", () => {
    pools.writePage("only", instances("boulder", 4));
    const mesh = poolMesh(pools, "boulder");
    clearUploads(pools);

    pools.writePage("only", instances("boulder", 1));

    expect(mesh.instanceMatrix.updateRanges).toEqual([{ count: 4 * MATRIX_FLOATS, start: 0 }]);
    expect(mesh.count).toBe(1);
    const stale = new Matrix4();
    mesh.getMatrixAt(3, stale);
    expect(stale.elements.slice(0, 15).every((element) => element === 0)).toBe(true);
    expect(pools.getMetrics().instancesUploaded).toBeGreaterThanOrEqual(8);
    pools.releasePage("only");
  });

  it("releases a page's slot so a later page reuses it and the drawn prefix shrinks", () => {
    pools.writePage("first", instances("shrub", 2));
    pools.writePage("second", instances("shrub", 2));
    const mesh = poolMesh(pools, "shrub");
    const capacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY.shrub;
    expect(mesh.count).toBe(capacity + 2);

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
