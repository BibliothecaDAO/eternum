import { describe, expect, it } from "vitest";
import {
  battleBonusBps,
  homecomingBps,
  homecomingReturn,
  logisticsStamina,
  scoutingIncrementBps,
} from "./attribute-tiers";

describe("attribute tiers", () => {
  it("reads the ruled tier tables, common giving nothing", () => {
    expect([1, 2, 3, 4, 5].map(battleBonusBps)).toEqual([0, 1000, 3000, 6000, 10000]);
    expect([1, 2, 3, 4, 5].map(logisticsStamina)).toEqual([0, 20, 50, 90, 150]);
    expect([1, 2, 3, 4, 5].map(scoutingIncrementBps)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect([1, 2, 3, 4, 5].map(homecomingBps)).toEqual([0, 300, 900, 1800, 3000]);
    expect(() => battleBonusBps(0)).toThrow("Invalid attribute tier");
    expect(() => logisticsStamina(6)).toThrow("Invalid attribute tier");
  });

  it("returns Homecoming's share of whole surviving troops, as progression.cairo's vectors count it", () => {
    const vectors = [
      [10_000, 1, 0],
      [99, 4, 17],
      [33, 2, 0],
      [34, 2, 1],
      [10_000, 4, 1_800],
      [1_000, 3, 90],
    ] as const;
    for (const [troops, tier, returned] of vectors) expect(homecomingReturn(troops, tier)).toBe(returned);
  });
});
