// @vitest-environment jsdom
import { BiomeType, BiomeTypeToId, Direction, getNeighborHexes } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { type DeployTile, RealmHexDeployMap } from "./realm-hex-deploy-map";

/** A realm's six neighbours as spawnRing reads them: free, one taken (north-west), one unexplored (south-east). */
const ring = (open: (direction: Direction) => boolean): DeployTile[] =>
  getNeighborHexes(31, 44).map(({ col, row, direction }) => ({
    col,
    row,
    direction,
    open: open(direction) && direction !== Direction.NORTH_WEST && direction !== Direction.SOUTH_EAST,
    explored: direction !== Direction.SOUTH_EAST,
    biome: direction === Direction.SOUTH_EAST ? undefined : BiomeTypeToId[BiomeType.Grassland],
  }));

const draw = (tiles: DeployTile[], onSelect = vi.fn()) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <RealmHexDeployMap centerCol={31} centerRow={44} ring={tiles} selectedDirection={null} onSelect={onSelect} />,
    ),
  );
  return { host, onSelect, done: () => (act(() => root.unmount()), host.remove()) };
};

it("draws only the realm and the six tiles an army can deploy onto, each marked free, occupied or unexplored", () => {
  const { host, onSelect, done } = draw(ring(() => true));
  const tiles = [...host.querySelectorAll('[role="radio"]')];
  // The realm's hex and its six neighbours, nothing further out.
  expect(host.querySelectorAll("polygon")).toHaveLength(7);
  expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual(
    getNeighborHexes(31, 44).map(({ direction }) =>
      direction === Direction.NORTH_WEST ? "occupied" : direction === Direction.SOUTH_EAST ? "unexplored" : "free",
    ),
  );
  // A free tile wears the legend's green mark, a taken one its red mark, an unexplored one the "?".
  const mark = (label: string) => host.querySelector(`[aria-label="${label}"]`)!;
  expect(mark("free").querySelector("circle")?.getAttribute("class")).toContain("fill-hud-good");
  expect(mark("occupied").querySelector("circle")?.getAttribute("class")).toContain("fill-hud-bad");
  expect(mark("unexplored").textContent).toBe("?");
  expect(host.textContent).toContain("free");
  expect(host.textContent).toContain("occupied");
  expect(host.textContent).toContain("? unexplored");

  // Only a free tile can be picked, and it picks its direction.
  act(() => mark("occupied").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  act(() => mark("unexplored").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onSelect).not.toHaveBeenCalled();
  const east = tiles[getNeighborHexes(31, 44).findIndex(({ direction }) => direction === Direction.EAST)];
  act(() => east.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onSelect).toHaveBeenCalledWith(Direction.EAST);

  // The frame holds three hexes across, edge to edge: the ring fills it.
  const [, , width, height] = host.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
  const hexWidth = 14 * Math.sqrt(3);
  expect(width).toBeCloseTo(3 * hexWidth + 6, 5);
  expect(height).toBeCloseTo(2 * 14 + 2 * 21 + 6, 5);
  done();
});

it("says there is no adjacent tile when none of the six is free", () => {
  const { host, done } = draw(ring(() => false));
  expect(host.querySelector("svg")).toBeNull();
  expect(host.textContent).toContain("No adjacent tiles");
  done();
});
