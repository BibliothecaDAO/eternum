import { afterEach, expect, it } from "vitest";
import { planGameEnd } from "./plan";
import { setWorldOrigin } from "@/three/world-origin";
const tiles = Array.from({ length: 320 }, (_, i) => ({ col: i % 20, row: Math.floor(i / 20), occupied: i === 170 }));
afterEach(() => setWorldOrigin({ col: 0, row: 0 }));
it("uses actual discovered sources, nearest centre, capped at the approved two", () => {
  const sources = [
    { col: 0, row: 0 },
    { col: 10, row: 8 },
    { col: 12, row: 8 },
  ];
  expect(planGameEnd(tiles, sources, null)?.sources).toEqual([
    { col: 10, row: 8, materialise: false },
    { col: 12, row: 8, materialise: false },
  ]);
  expect(planGameEnd(tiles, [sources[1]], null)?.sources).toHaveLength(1);
});
it("materialises on two distinct observed empty hexes across the known map, without rewriting a tile", () => {
  const before = structuredClone(tiles);
  const spared = { col: 10, row: 8 };
  const plan = planGameEnd(tiles, [], spared)!;
  expect(plan.sources).toHaveLength(2);
  expect(plan.sources[0].col).toBeLessThan(10);
  expect(plan.sources[1].col).toBeGreaterThan(10);
  for (const source of plan.sources) {
    expect(source.materialise).toBe(true);
    expect(tiles.find((tile) => tile.col === source.col && tile.row === source.row)?.occupied).toBe(false);
    expect(source).not.toMatchObject(spared);
  }
  expect(tiles).toEqual(before);
  expect(planGameEnd([...tiles].reverse(), [], spared)).toEqual(plan);
});
it("does not invent sites for an empty or fully occupied projection", () => {
  expect(planGameEnd([], [], null)).toBeNull();
  const plan = planGameEnd([{ col: 41, row: 12, occupied: true }], [], { col: 41, row: 12 })!;
  expect(plan.sources).toEqual([]);
  expect(plan.anchor).toEqual({ col: 41, row: 12 });
});
it("keeps the same reach and real source coordinates after a Frontier origin shift", () => {
  const near = planGameEnd(tiles, [], null)!;
  const offset = 2 ** 31;
  setWorldOrigin({ col: offset, row: offset });
  const far = planGameEnd(
    tiles.map((t) => ({ ...t, col: t.col + offset, row: t.row + offset })),
    [],
    null,
  )!;
  expect(far.sources).toEqual(near.sources.map((p) => ({ ...p, col: p.col + offset, row: p.row + offset })));
  expect(far.maximumReach).toBeCloseTo(near.maximumReach, 5);
});

it("uses a known Frontier realm or rule spire when no Tile rows have been explored", () => {
  const realm = { col: 1337, row: 2048 };
  expect(planGameEnd([], [], realm)).toMatchObject({ anchor: realm, sources: [], sparedHex: realm });
  const source = { col: 1338, row: 2049 };
  expect(planGameEnd([], [source], realm)).toMatchObject({ sources: [{ ...source, materialise: false }] });
});
