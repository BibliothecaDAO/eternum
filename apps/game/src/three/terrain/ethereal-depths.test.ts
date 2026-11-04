import { describe, expect, it } from "vitest";
import { ETHEREAL_DEPTH_LOOKS, etherealSurfaceAt } from "./ethereal-depths";

const rules = { spacing: 100, dayUnitSeconds: 3600, startMainAt: 0, endAt: 999999, seed: 1n };

describe("Frontier depth presentation", () => {
  it("selects the approved look from contract rows across days and band boundaries", () => {
    expect(Object.keys(ETHEREAL_DEPTH_LOOKS)).toEqual(["1", "2", "3"]);
    for (const day of [0, 1, 20]) {
      const surface = day * 400;
      expect(etherealSurfaceAt(rules, { row: surface + 99, alt: false }, false)).toBeUndefined();
      for (const depth of [1, 2, 3] as const) {
        for (const offset of [0, 99])
          expect(etherealSurfaceAt(rules, { row: surface + depth * 100 + offset, alt: false }, false)).toBe(depth);
      }
    }
  });

  it("retains Eternum's alternate material and the surface Spire transition", () => {
    for (const row of [50, 150, 250, 350]) {
      expect(etherealSurfaceAt(null, { row, alt: true }, false)).toBe("ethereal");
      expect(etherealSurfaceAt(rules, { row, alt: true }, false)).toBe("ethereal");
      expect(etherealSurfaceAt(null, { row, alt: false }, false)).toBeUndefined();
    }
    expect(etherealSurfaceAt(rules, { row: 50, alt: false }, true)).toBe("ethereal");
    expect(etherealSurfaceAt(rules, { row: 150, alt: false }, true)).toBe(1);
  });
});
