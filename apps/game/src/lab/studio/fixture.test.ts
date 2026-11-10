import { BiomeType } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { terrainNeighborCoordinates } from "@/three/terrain/terrain-coordinates";

import { STUDIO_SETS, createStudioTerrainRequest, type Hex } from "./fixture";

const key = ({ col, row }: Hex) => `${col}:${row}`;
const areNeighbours = (a: Hex, b: Hex) => terrainNeighborCoordinates(a.col, a.row).some((hex) => key(hex) === key(b));

const world = STUDIO_SETS.world;
const structures = [world.realm, world.hyperstructure, ...world.hyperstructures]
  .concat(world.kingdoms.map(({ hex }) => hex))
  .concat(world.sites.map(({ hex }) => hex));
const WATER: BiomeType[] = [BiomeType.DeepOcean, BiomeType.Ocean];

it("lays the world out as a Blitz match of six: seven Hyperstructures, and three realms a player", () => {
  expect(1 + world.hyperstructures.length).toBe(7);
  expect(1 + world.kingdoms.length).toBe(18);
  expect(1 + world.kingdoms.filter((kingdom) => kingdom.ours).length).toBe(3);
});

it("stands every structure of the world on its own hex of dry land, off the armies' road", () => {
  const road = world.orders.flatMap((order) => order.route);
  expect(new Set(structures.map(key)).size).toBe(structures.length);
  for (const hex of [...structures, ...road]) {
    expect(WATER).not.toContain(world.biomeAt(hex));
    expect(world.isFogged(hex)).toBe(false);
  }
  for (const hex of road) expect(structures.map(key)).not.toContain(key(hex));
});

it.each(Object.entries(STUDIO_SETS))("stands each fight of the %s set on two hexes side by side", (_, set) => {
  for (const { attacker, defender } of set.battles) expect(areNeighbours(attacker, defender)).toBe(true);
});

it("walks the world's two armies a hex at a time, each over the bandit that holds its lane", () => {
  expect(world.orders).toHaveLength(2);
  for (const { route, startAt, raids } of world.orders) {
    for (let step = 1; step < route.length; step += 1) expect(areNeighbours(route[step - 1], route[step])).toBe(true);
    expect(route[startAt]).toBeDefined();
    expect(route.slice(1).map(key)).toContain(key(raids!));
  }
  expect(new Set(world.orders.map((order) => order.wait)).size).toBe(2);
});

it("leaves the land past the players' reach under fog", () => {
  const cells = createStudioTerrainRequest("world", 0).cells;
  expect(cells.some((cell) => !cell.explored)).toBe(true);
  expect(cells.find((cell) => key(cell) === key(world.realm))?.explored).toBe(true);
});
