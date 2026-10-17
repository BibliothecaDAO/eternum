import { describe, expect, it } from "vitest";

import { stack, type LabelBox } from "./map-label-layout";

const box = (id: string, x: number, y: number, priority: number): LabelBox => ({
  id,
  x,
  y,
  width: 100,
  height: 24,
  priority,
});

describe("map plate stacking", () => {
  it("lifts an overlapping plate clear of the one kept, and drops it when two lifts are not enough", () => {
    const lifts = stack([box("a", 0, 100, 3), box("b", 10, 100, 2), box("c", 20, 100, 1), box("d", 30, 100, 0)]);
    expect(lifts.get("a")).toBe(0);
    expect(lifts.get("b")).toBe(27);
    expect(lifts.get("c")).toBe(54);
    expect(lifts.has("d")).toBe(false);
  });

  it("leaves a plate that stands clear where it is", () => {
    expect(stack([box("a", 0, 100, 1), box("far", 400, 100, 0)]).get("far")).toBe(0);
  });
});
