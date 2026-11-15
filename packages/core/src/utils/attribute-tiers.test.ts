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
  it("reads the ruled tier tables, zero giving nothing", () => {
    expect([0, 1, 2, 3, 4, 5].map(battleBonusBps)).toEqual([0, 1000, 2500, 4500, 7000, 10000]);
    expect([0, 1, 2, 3, 4, 5].map(logisticsStamina)).toEqual([0, 20, 45, 75, 110, 150]);
    expect([0, 1, 2, 3, 4, 5].map(scoutingIncrementBps)).toEqual([0, 1000, 1500, 2000, 2500, 3000]);
    expect([0, 1, 2, 3, 4, 5].map(homecomingBps)).toEqual([0, 300, 800, 1400, 2100, 3000]);
    expect(() => battleBonusBps(-1)).toThrow("Invalid attribute tier");
    expect(() => logisticsStamina(6)).toThrow("Invalid attribute tier");
  });

  it("returns Homecoming's share of whole surviving troops, as progression.cairo's vectors count it", () => {
    const vectors = [
      [10_000, 0, 0],
      [99, 4, 20],
      [33, 1, 0],
      [34, 1, 1],
      [10_000, 4, 2_100],
      [1_000, 3, 140],
    ] as const;
    for (const [troops, tier, returned] of vectors) expect(homecomingReturn(troops, tier)).toBe(returned);
  });

  it("reads Scouting's kinds and sums each tier's increment onto its kind, as progression.cairo's vectors do", () => {
    // Rifts at ranks I, III and V; Trolls at II; Sanctuaries at IV.
    const mixed = 2 + 1 * 4 + 2 * 16 + 3 * 64 + 2 * 256;
    expect(scoutingKindsOf(5, mixed)).toEqual(["Rift", "Camp", "Rift", "Sanctuaries", "Rift"]);
    expect(scoutingBonusBps(5, mixed)).toEqual({ Camp: 1500, Rift: 6000, Sanctuaries: 2500 });
    expect(scoutingBonusBps(5, 2 + 2 * 4 + 2 * 16 + 2 * 64 + 2 * 256)).toEqual({
      Camp: 0,
      Rift: 10000,
      Sanctuaries: 0,
    });
    expect(scoutingBonusBps(5, 3 + 3 * 4 + 3 * 16 + 3 * 64 + 3 * 256)).toEqual({
      Camp: 0,
      Rift: 0,
      Sanctuaries: 10000,
    });
    // A lodge trained Rift, Camp, Sanctuaries, Rift, Sanctuaries.
    expect(scoutingKindsOf(5, 2 + 4 + 3 * 16 + 2 * 64 + 3 * 256)).toEqual([
      "Rift",
      "Camp",
      "Sanctuaries",
      "Rift",
      "Sanctuaries",
    ]);
    expect(scoutingBonusBps(0, 0)).toEqual({ Camp: 0, Rift: 0, Sanctuaries: 0 });
  });
});
