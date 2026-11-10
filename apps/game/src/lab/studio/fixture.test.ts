import { BiomeType } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { terrainNeighborCoordinates } from "@/three/terrain/terrain-coordinates";

import { STUDIO_SETS, createStudioTerrainRequest, type Hex } from "./fixture";

const key = ({ col, row }: Hex) => `${col}:${row}`;
const areNeighbours = (a: Hex, b: Hex) => terrainNeighborCoordinates(a.col, a.row).some((hex) => key(hex) === key(b));

it("draws every biome of the game's surface on the world set", () => {
  const biomes = new Set(createStudioTerrainRequest("world", 0).cells.map((cell) => cell.previewBiome));
  // Every biome but the two that are no surface: None and Underground.
  expect(biomes.size).toBe(Object.values(BiomeType).length - 2);
});

it.each(Object.entries(STUDIO_SETS))("stands each fight of the %s set on two hexes side by side", (_, set) => {
  for (const { attacker, defender } of set.battles) expect(areNeighbours(attacker, defender)).toBe(true);
});

it("walks every army of the world a hex at a time, each raider ending beside the guard it attacks", () => {
  const { orders } = STUDIO_SETS.world;
  expect(orders.length).toBeGreaterThan(100);
  for (const { route, startAt, raids } of orders) {
    for (let step = 1; step < route.length; step += 1) expect(areNeighbours(route[step - 1], route[step])).toBe(true);
    expect(route[startAt]).toBeDefined();
    if (raids) expect(areNeighbours(route.at(-1)!, raids)).toBe(true);
  }
});

it("starts the world's armies out of step with one another", () => {
  const waits = new Set(STUDIO_SETS.world.orders.map((order) => order.wait));
  expect(waits.size).toBeGreaterThan(8);
});

it("keeps fog standing along the world's edge, and uncovers only fog as its explorers walk into it", () => {
  const { reveals, realm, isFogged } = STUDIO_SETS.world;
  const uncovered = reveals.flat();
  expect(uncovered.length).toBeGreaterThan(0);
  expect(new Set(uncovered.map(key)).size).toBe(uncovered.length);
  for (const hex of uncovered) expect(isFogged(hex)).toBe(true);
  expect(isFogged(realm)).toBe(false);
  const hidden = (revealed: number) =>
    createStudioTerrainRequest("world", revealed).cells.filter((cell) => !cell.explored).length;
  expect(hidden(0) - hidden(reveals.length)).toBe(uncovered.length);
  expect(hidden(reveals.length)).toBeGreaterThan(0);
});
