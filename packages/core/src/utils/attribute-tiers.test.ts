import { describe, expect, it } from "vitest";
import {
  battleBonusBps,
  homecomingBps,
  homecomingReturn,
  logisticsStamina,
  scoutingBonusBps,
  scoutingIncrementBps,
  scoutingKindsOf,
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

  it("reads Scouting's kinds and sums each tier's increment onto its kind, as progression.cairo's vectors do", () => {
    // Rift, Camp, Rift, Rift: uncommon, epic and legendary on rifts, rare on camps.
    const mixed = 2 + 1 * 4 + 2 * 16 + 2 * 64;
    expect(scoutingKindsOf(5, mixed)).toEqual(["Rift", "Camp", "Rift", "Rift"]);
    expect(scoutingBonusBps(5, mixed)).toEqual({ Camp: 2000, Rift: 8000, Stragglers: 0 });
    expect(scoutingBonusBps(5, 2 + 2 * 4 + 2 * 16 + 2 * 64)).toEqual({ Camp: 0, Rift: 10000, Stragglers: 0 });
    expect(scoutingBonusBps(5, 3 + 3 * 4 + 3 * 16 + 3 * 64)).toEqual({ Camp: 0, Rift: 0, Stragglers: 10000 });
    // A lodge trained Rift, Camp, Stragglers, Rift.
    expect(scoutingKindsOf(5, 2 + 4 + 3 * 16 + 2 * 64)).toEqual(["Rift", "Camp", "Stragglers", "Rift"]);
    expect(scoutingBonusBps(1, 0)).toEqual({ Camp: 0, Rift: 0, Stragglers: 0 });
  });
});
