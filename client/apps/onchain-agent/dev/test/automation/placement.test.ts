import { describe, it, expect } from "vitest";
import { findOpenSlot, getDirectionsArray } from "../../../src/automation/placement.js";

describe("getDirectionsArray", () => {
  it("returns path from center to adjacent hex", () => {
    const dirs = getDirectionsArray([10, 10], [11, 10]);
    expect(dirs.length).toBe(1);
  });

  it("returns empty array for same position", () => {
    const dirs = getDirectionsArray([10, 10], [10, 10]);
    expect(dirs).toEqual([]);
  });
});

describe("findOpenSlot", () => {
  it("returns first open hex in ring 1 when all are free", () => {
    const occupied = new Set<string>();
    const result = findOpenSlot(occupied, 1);
    expect(result).not.toBeNull();
    expect(result!.directions.length).toBeGreaterThan(0);
  });

  it("skips occupied hexes", () => {
    // Occupy all ring 1 except one
    const ring1 = [[11, 10], [11, 11], [10, 11], [9, 10], [10, 9], [11, 9]];
    const occupied = new Set(ring1.slice(0, 5).map(([c, r]) => `${c},${r}`));
    const result = findOpenSlot(occupied, 1);
    expect(result).not.toBeNull();
  });

  it("returns null when all slots in range are occupied", () => {
    const ring1 = [[11, 10], [11, 11], [10, 11], [9, 10], [10, 9], [11, 9]];
    const occupied = new Set(ring1.map(([c, r]) => `${c},${r}`));
    const result = findOpenSlot(occupied, 1);
    expect(result).toBeNull();
  });
});
