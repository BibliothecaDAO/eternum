import { describe, expect, it } from "vitest";

import { declutter, placeCard, stack, type LabelBox } from "./map-label-layout";

const box = (id: string, x: number, y: number, priority: number): LabelBox => ({
  id,
  x,
  y,
  width: 100,
  height: 26,
  priority,
});

describe("map label layout", () => {
  it("keeps the higher-priority plate where two overlap, and every plate that stands clear", () => {
    const kept = declutter([box("enemy camp", 10, 10, 1), box("own army", 40, 20, 5), box("far realm", 400, 10, 2)]);
    expect([...kept].sort()).toEqual(["far realm", "own army"]);
  });

  it("lifts an overlapping plate clear of the one kept, and drops it when two lifts are not enough", () => {
    const lifts = stack([box("a", 0, 100, 3), box("b", 10, 100, 2), box("c", 20, 100, 1), box("d", 30, 100, 0)]);
    expect(lifts.get("a")).toBe(0);
    expect(lifts.get("b")).toBe(29);
    expect(lifts.get("c")).toBe(58);
    expect(lifts.has("d")).toBe(false);
  });

  it("puts a hover card on the side that covers no plate, and names what it would cover", () => {
    const plates = [box("above-it", 150, 30, 1)];
    const card = placeCard({ x: 200, y: 120 }, { width: 160, height: 60 }, plates, { width: 800, height: 600 });
    expect(card.side).toBe("below");
    expect(card.covers).toEqual([]);
    const boxed = placeCard(
      { x: 200, y: 120 },
      { width: 160, height: 60 },
      [box("n", 150, 30, 1), box("s", 150, 150, 1), box("e", 230, 95, 1), box("w", 40, 95, 1)],
      { width: 800, height: 600 },
    );
    expect(boxed.covers).toHaveLength(1);
  });
});
