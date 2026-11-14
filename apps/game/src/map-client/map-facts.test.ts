import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shown = vi.hoisted(() => ({ layer: false }));

vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => shown.layer }));
vi.mock("@/config/game-modes", () => ({ getGameModeConfig: () => ({ id: "eternum" }) }));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  FELT_CENTER: () => 100,
}));

import { TileOccupier } from "@bibliothecadao/types";

import { changedHexes, readLandmarks, readStructures, readTiles } from "./map-facts";

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

describe("readLandmarks", () => {
  const occupied = (col: number, occupierType: number) => ({ ...tile(SURFACE, col), occupierType });
  const land = {
    getTiles: () => [
      occupied(101, TileOccupier.Spire),
      occupied(102, TileOccupier.DormantSpire),
      occupied(103, TileOccupier.Shrine),
      occupied(104, TileOccupier.Well),
      occupied(105, TileOccupier.None),
    ],
    getChests: () => [{ kind: "chest", entityId: 5, hexCoords: { alt: SURFACE, col: 106, row: 100 } }],
  } as unknown as WorldSpatialProjection;

  it("names each spire, shrine, well and chest with the model it is drawn as, and nothing for a bare tile", () => {
    expect(readLandmarks(land)).toEqual([
      { hex: { col: 1, row: 0 }, path: "/models/ethereal/spire.glb" },
      { hex: { col: 2, row: 0 }, path: "/models/ethereal/spire.glb" },
      { hex: { col: 3, row: 0 }, path: "/models/outposts/shrine.glb" },
      { hex: { col: 4, row: 0 }, path: "/models/outposts/well.glb" },
      { hex: { col: 6, row: 0 }, path: "/models/reward-tiles/chest-c2.glb" },
    ]);
  });
});
