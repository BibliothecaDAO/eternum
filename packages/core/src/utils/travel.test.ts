import { describe, expect, it } from "vitest";
import { journeyDistance } from "./travel";

/** A surface tile's six neighbours as the chain steps to them (geometry::neighbor, stride 1): odd rows shift west. */
const neighbours = ({ x, y }: { x: number; y: number }) => {
  const east = 1 - (y % 2);
  const west = 1 - east;
  return [
    { x: x + 1, y },
    { x: x + east, y: y + 1 },
    { x: x - west, y: y + 1 },
    { x: x - 1, y },
    { x: x - west, y: y - 1 },
    { x: x + east, y: y - 1 },
  ];
};

describe("a journey's distance, as the chain counts it", () => {
  it("is one step to each of a tile's six neighbours, on even and odd rows", () => {
    for (const tile of [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
    ])
      expect(neighbours(tile).map((neighbour) => journeyDistance(tile, neighbour))).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("counts hex steps, not a straight line across the offset grid", () => {
    expect(journeyDistance({ x: 10, y: 10 }, { x: 15, y: 10 })).toBe(5);
    // Six rows down and three columns across is six steps; the straight line would say 6.7.
    expect(journeyDistance({ x: 10, y: 10 }, { x: 13, y: 16 })).toBe(6);
  });
});
