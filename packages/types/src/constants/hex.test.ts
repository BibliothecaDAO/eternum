import { describe, expect, it } from "vitest";
import { getHexDistance, getLayeredAttackDistance, getNeighborHexes } from "./hex";

describe("hex distance", () => {
  it.each([
    { col: 0, row: 0 },
    { col: 0, row: 1 },
    { col: -7, row: -3 },
    { col: 1_000_000_000, row: 1_000_000_000 },
    { col: 1_000_000_000, row: 1_000_000_001 },
  ])("matches neighbor traversal from $col,$row", (origin) => {
    const visited = new Set([`${origin.col},${origin.row}`]);
    let frontier = [origin];
    for (let distance = 1; distance <= 8; distance++) {
      const next: typeof frontier = [];
      for (const hex of frontier) {
        for (const neighbor of getNeighborHexes(hex.col, hex.row)) {
          const key = `${neighbor.col},${neighbor.row}`;
          if (visited.has(key)) continue;
          visited.add(key);
          next.push(neighbor);
          expect(getHexDistance(origin, neighbor)).toBe(distance);
          expect(getHexDistance(neighbor, origin)).toBe(distance);
          expect(getHexDistance(origin, neighbor, distance - 1)).toBe(Infinity);
        }
      }
      frontier = next;
    }
  });

  it("preserves the radius cutoff and zero distance", () => {
    const origin = { col: 0, row: 0 };
    expect(getHexDistance(origin, origin, 0)).toBe(0);
    expect(getHexDistance(origin, { col: 64, row: 0 })).toBe(64);
    expect(getHexDistance(origin, { col: 65, row: 0 })).toBe(Infinity);
    expect(getHexDistance(origin, { col: 1_000_000, row: 0 }, 1_000_000)).toBe(1_000_000);
  });

  it("preserves layer stride and colocated cross-layer attacks", () => {
    const origin = { col: 0, row: 0, alt: false };
    const target = { col: 2, row: 0, alt: false };
    expect(getLayeredAttackDistance(origin, target)).toBe(2);
    expect(getLayeredAttackDistance({ ...origin, alt: true }, { col: 15, row: 0, alt: true })).toBe(1);
    expect(getLayeredAttackDistance(origin, { ...origin, alt: true })).toBe(1);
    expect(getLayeredAttackDistance(origin, { ...target, alt: true })).toBe(Infinity);
  });
});
