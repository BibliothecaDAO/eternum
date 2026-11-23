import { describe, expect, it } from "bun:test";
import { buildMysteryChestPreset } from "../../../../contracts/l2/ledger/scripts/chest-preset.js";

describe("mystery chest economics", () => {
  it("prices rewards as entry shares and keeps every band's odds at 100 percent", () => {
    const chest = buildMysteryChestPreset();
    expect(chest.bands.map((band) => band.lords_shares)).toEqual([4, 2, 1, 0, 0]);
    expect(chest.bands.map((band) => band.odds.lords)).toEqual([500, 1000, 1000, 0, 0]);
    for (const band of chest.bands) {
      expect(Object.values(band.odds).reduce((sum, weight) => sum + weight, 0)).toBe(10000);
      expect(band).not.toHaveProperty("lords_amount");
    }
    expect(chest.bands.reduce((sum, band) => sum + band.lords_shares * band.odds.lords, 0) / 5 / 10000).toBe(0.1);
  });
  it("preserves non-token proportions to within one basis point", () => {
    const previous = [
      [2000, 2000, 2000, 1500, 1000, 250, 250],
      [2500, 2200, 1800, 1000, 500, 500, 500],
      [3000, 2000, 1200, 600, 200, 1250, 1250],
      [3000, 1800, 800, 300, 100, 1800, 1800],
      [2500, 1500, 700, 200, 100, 2500, 2500],
    ];
    buildMysteryChestPreset().bands.forEach((band, index) => {
      const weights = previous[index]!;
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const actual = Object.entries(band.odds)
        .filter(([name]) => name !== "lords")
        .map(([, weight]) => weight);
      weights.forEach((weight, position) =>
        expect(Math.abs(actual[position]! - (weight * (10000 - band.odds.lords)) / total)).toBeLessThan(1),
      );
    });
  });
});
