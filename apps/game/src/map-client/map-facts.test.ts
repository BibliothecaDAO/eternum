import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shown = vi.hoisted(() => ({ layer: false }));

vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => shown.layer }));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  FELT_CENTER: () => 100,
}));

import { changedHexes, readStructures, readTiles } from "./map-facts";

const SURFACE = false;
const ETHEREAL = true;
const tile = (alt: boolean, col: number) => ({
  hexCoords: { alt, col, row: 100 },
  biome: 3,
  occupierIsStructure: false,
});

/** A projection with one tile and one structure on each layer. */
const projection = {
  getTiles: (alt: boolean) => [tile(alt, alt ? 107 : 101)],
  getStructures: (alt: boolean) => [{ entityId: alt ? 9 : 4, hexCoords: { alt, col: 100, row: 100 }, occupierType: 1 }],
} as unknown as WorldSpatialProjection;

beforeEach(() => {
  shown.layer = SURFACE;
});

describe("the facts the map reads", () => {
  it("are the Surface's while the Surface is shown", () => {
    expect(readTiles(projection).map((read) => read.col)).toEqual([1]);
    expect(readStructures(projection).map((read) => read.entityId)).toEqual([4]);
  });

  it("are the Ethereal's while the Ethereal is shown", () => {
    shown.layer = ETHEREAL;
    expect(readTiles(projection).map((read) => read.col)).toEqual([7]);
    expect(readStructures(projection).map((read) => read.entityId)).toEqual([9]);
  });
});

describe("changedHexes", () => {
  const moved = [{ previous: tile(SURFACE, 101), current: tile(ETHEREAL, 107) }];

  it("names where a thing was and where it is, on the layer shown only", () => {
    expect(changedHexes(moved)).toEqual([{ col: 1, row: 0 }]);
    shown.layer = ETHEREAL;
    expect(changedHexes(moved)).toEqual([{ col: 7, row: 0 }]);
  });

  it("names nothing for a change with no place", () => {
    expect(changedHexes([{}])).toEqual([]);
  });
});
