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

it.each(Object.entries(STUDIO_SETS))(
  "marches the %s set's host a hex at a time, no two armies on one hex",
  (_, set) => {
    for (const { route } of set.host)
      for (let step = 1; step < route.length; step += 1) expect(areNeighbours(route[step - 1], route[step])).toBe(true);
    const steps = Math.max(0, ...set.host.map(({ route }) => route.length));
    for (let step = 0; step < steps; step += 1) {
      const standing = set.host.map(({ route }) => key(route[step]));
      expect(new Set(standing).size).toBe(standing.length);
    }
  },
);

it("lifts the world's mist off every hidden hex once, and never hides its capital", () => {
  const { reveals, realm } = STUDIO_SETS.world;
  const lifted = reveals.flat().map(key);
  expect(new Set(lifted).size).toBe(lifted.length);
  expect(lifted).not.toContain(key(realm));
  const hidden = (revealed: number) =>
    createStudioTerrainRequest("world", revealed).cells.filter((cell) => !cell.explored).length;
  expect(hidden(0)).toBe(lifted.length);
  expect(hidden(reveals.length)).toBe(0);
});
