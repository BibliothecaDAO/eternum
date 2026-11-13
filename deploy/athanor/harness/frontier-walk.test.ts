import { describe, expect, it } from "bun:test";
import { getNeighborHexes } from "@bibliothecadao/types";
import { firstStepTo } from "./frontier";

/** A map of tiles by "col,row": explored open ground, an occupied tile, or nothing (unexplored). */
type Ground = Map<string, { biome: number; occupier_id?: number }>;
const open = (ground: Ground, ...tiles: [number, number][]) => {
  for (const [col, row] of tiles) ground.set(`${col},${row}`, { biome: 1 });
  return ground;
};
const read = (ground: Ground) => (col: number, row: number) => ground.get(`${col},${row}`);
const anywhere = () => true;
const stepTo = (from: { x: number; y: number }, to: { col: number; row: number }) =>
  getNeighborHexes(from.x, from.y).find((hex) => hex.col === to.col && hex.row === to.row)!.direction;

/** The spire and the ground beside it: arriving is standing on open ground beside it. */
const besideSpire = (spire: { col: number; row: number }) => (spot: { col: number; row: number }, tile: unknown) =>
  Boolean(tile && (tile as { biome?: number }).biome && !(tile as { occupier_id?: number }).occupier_id) &&
  getNeighborHexes(spire.col, spire.row).some((hex) => hex.col === spot.col && hex.row === spot.row);

describe("the harness's walk to a found spire", () => {
  const army = { x: 10, y: 10 };
  const spire = { col: 14, row: 10 };

  it("walks the explored corridor to the spire, whatever unexplored tile stands beside the army", () => {
    // East along row 10 is explored and free; every other neighbour of the army is unexplored.
    const ground = open(new Map(), [11, 10], [12, 10], [13, 10]);
    ground.set(`${spire.col},${spire.row}`, { biome: 1, occupier_id: 99 });
    expect(firstStepTo(army, read(ground), anywhere, besideSpire(spire))).toBe(stepTo(army, { col: 11, row: 10 }));
  });

  it("finds no walk when no explored ground leads there, so the army explores on", () => {
    const ground = open(new Map(), [11, 10]);
    ground.set(`${spire.col},${spire.row}`, { biome: 1, occupier_id: 99 });
    expect(firstStepTo(army, read(ground), anywhere, besideSpire(spire))).toBeUndefined();
  });

  it("does not walk through a tile another army holds", () => {
    const ground = open(new Map(), [11, 10], [13, 10]);
    ground.set("12,10", { biome: 1, occupier_id: 7 });
    ground.set(`${spire.col},${spire.row}`, { biome: 1, occupier_id: 99 });
    const blocked = firstStepTo(army, read(ground), (spot) => spot.row === 10, besideSpire(spire));
    expect(blocked).toBeUndefined();
  });

  it("keeps the frontier walk: the first step toward the nearest unexplored tile, over explored ground", () => {
    // The army's ring is explored; beyond (12,10) the map is unexplored.
    const ground = open(
      new Map(),
      ...getNeighborHexes(army.x, army.y).map(({ col, row }) => [col, row] as [number, number]),
    );
    const step = firstStepTo(army, read(ground), anywhere, (_, tile) => !tile);
    expect(getNeighborHexes(army.x, army.y).map(({ direction }) => direction)).toContain(step!);
  });
});
