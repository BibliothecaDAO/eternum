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

/**
 * Where each direction's tile is drawn around the realm: the map draws the contract's north (the next row) at the
 * bottom, as the world map does.
 */
const DRAWN: Record<Direction, string> = {
  [Direction.EAST]: "Right",
  [Direction.NORTH_EAST]: "Lower right",
  [Direction.NORTH_WEST]: "Lower left",
  [Direction.WEST]: "Left",
  [Direction.SOUTH_WEST]: "Upper left",
  [Direction.SOUTH_EAST]: "Upper right",
};

it("draws only the realm and the six tiles an army can deploy onto, each named by its place and marked free, occupied or unexplored", () => {
  const { host, onSelect, done } = draw(ring(() => true));
  const tiles = [...host.querySelectorAll('[role="radio"]')];
  // The realm's hex and its six neighbours, nothing further out.
  expect(host.querySelectorAll("polygon")).toHaveLength(7);
  expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual(
    getNeighborHexes(31, 44).map(
      ({ direction }) =>
        `${DRAWN[direction]}, ${direction === Direction.NORTH_WEST ? "occupied" : direction === Direction.SOUTH_EAST ? "unexplored" : "free"}`,
    ),
  );
  // Each tile drawn on the side its name says.
  for (const tile of tiles) {
    const [x, y] = tile
      .querySelector("polygon")!
      .getAttribute("points")!
      .split(" ")
      .map((corner) => corner.split(",").map(Number))
      .reduce(([sx, sy], [cx, cy]) => [sx + cx / 6, sy + cy / 6], [0, 0]);
    const name = tile.getAttribute("aria-label")!;
    expect(x < 0).toBe(name.toLowerCase().includes("left"));
    expect(y < -1 ? "Upper" : y > 1 ? "Lower" : "level").toBe(
      name.startsWith("Upper") ? "Upper" : name.startsWith("Lower") ? "Lower" : "level",
    );
  }
  // A free tile wears the legend's green mark, a taken one its red mark, an unexplored one the "?".
  const mark = (label: string) => host.querySelector(`[aria-label="${label}"]`)!;
  expect(mark("Right, free").querySelector("circle")?.getAttribute("class")).toContain("fill-hud-good");
  expect(mark("Lower left, occupied").querySelector("circle")?.getAttribute("class")).toContain("fill-hud-bad");
  expect(mark("Upper right, unexplored").textContent).toBe("?");
  expect(host.textContent).toContain("free");
  expect(host.textContent).toContain("occupied");
  expect(host.textContent).toContain("? unexplored");

  // Only a free tile can be picked, and it picks its direction.
  act(() => mark("Lower left, occupied").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  act(() => mark("Upper right, unexplored").dispatchEvent(new MouseEvent("click", { bubbles: true })));
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
