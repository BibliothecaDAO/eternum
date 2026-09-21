import type { StructureSpatialProjectionChange, WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { Group, Matrix4, Scene } from "three";
import { describe, expect, it, vi } from "vitest";

const placedHeights = vi.hoisted(() => [] as number[]);
vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));
vi.mock("../structures/hyperstructure-kit", () => ({ createHyperstructureKit: () => ({ scene: new Group() }) }));
vi.mock("@/three/managers/instanced-model", () => ({
  default: class {
    group = new Group();
    private count = 0;
    setContactShadowsEnabled() {}
    getCount = () => this.count;
    setCount = (count: number) => (this.count = count);
    setMatrixAt = (_index: number, matrix: Matrix4) => placedHeights.push(matrix.elements[13]);
    setColorAt() {}
    removeInstance() {}
    needsUpdate() {}
    dispose() {}
  },
}));

import { changesTouchReservedSites, ReservedHyperstructureManager } from "./reserved-hyperstructure-manager";

const change = (input: {
  previous?: { reserved: boolean };
  current?: { reserved: boolean };
}): StructureSpatialProjectionChange =>
  ({
    kind: "structure",
    spatialId: "entity:1",
    previous: input.previous as never,
    current: input.current as never,
  }) as StructureSpatialProjectionChange;

describe("changesTouchReservedSites", () => {
  it("ignores ordinary structure churn", () => {
    expect(changesTouchReservedSites([change({ previous: { reserved: false }, current: { reserved: false } })])).toBe(
      false,
    );
    expect(changesTouchReservedSites([change({ current: { reserved: false } })])).toBe(false);
    expect(changesTouchReservedSites([])).toBe(false);
  });

  it("rebuilds when a reserved site appears, moves, or is claimed", () => {
    expect(changesTouchReservedSites([change({ current: { reserved: true } })])).toBe(true);
    expect(changesTouchReservedSites([change({ previous: { reserved: true }, current: { reserved: false } })])).toBe(
      true,
    );
    expect(changesTouchReservedSites([change({ previous: { reserved: true } })])).toBe(true);
  });
});

describe("reserved site terrain placement", () => {
  it("re-places the sites when their terrain arrives, and only when a height changed", async () => {
    let height = 0;
    const projection = {
      subscribeStructures: () => () => {},
      getStructures: () => [{ reserved: true, hexCoords: { col: 3, row: 4 } }],
    } as unknown as WorldSpatialProjection;
    const manager = new ReservedHyperstructureManager(new Scene(), projection, {
      sampleSurface: () => ({ biome: null, height, normal: [0, 1, 0] }),
    });
    await vi.waitFor(() => expect(placedHeights).toHaveLength(1));
    expect(placedHeights[0]).toBeCloseTo(0.05);

    manager.refreshTerrainPlacement();
    expect(placedHeights).toHaveLength(1);

    height = 0.12;
    manager.refreshTerrainPlacement();
    expect(placedHeights).toHaveLength(2);
    expect(placedHeights[1]).toBeCloseTo(0.17);

    manager.refreshTerrainPlacement();
    expect(placedHeights).toHaveLength(2);
    manager.destroy();
  });
});
