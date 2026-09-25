import { describe, expect, it } from "vitest";
import { expeditionDepth } from "./expeditions";
import { readRevealPercent, revealYield } from "./reveal-yield";

const limits = { t1_tier_strength: 1, t2_tier_strength: 3, t3_tier_strength: 9 } as never;
const WHOLE = 1_000_000_000n;
const troops = (tier: "T1" | "T2" | "T3", scaled: bigint) => ({ tier, count: scaled });

describe("what a reveal sends home", () => {
  it("pays strength times the depth's percent, the same for 1,500 T1 as for 500 T2 (design §3.1 gate)", () => {
    expect(revealYield(troops("T1", 1_500n * WHOLE), limits, 10)).toBe(150n * WHOLE);
    expect(revealYield(troops("T2", 500n * WHOLE), limits, 10)).toBe(150n * WHOLE);
    expect(revealYield(troops("T1", 1_500n * WHOLE), limits, 15)).toBe(225n * WHOLE);
    expect(revealYield(troops("T2", 500n * WHOLE), limits, 15)).toBe(225n * WHOLE);
  });

  it("works on the scaled count with one truncating division at the end, as the contract does", () => {
    expect(revealYield(troops("T1", 999_999_999n), limits, 15)).toBe(149_999_999n);
    expect(revealYield(troops("T1", 1_500_500_000_000n), limits, 15)).toBe(225_075_000_000n);
    // The contract's own vectors (frontier_reveal.cairo).
    expect(revealYield(troops("T3", 999_999_999n), limits, 25)).toBe(2_249_999_997n);
  });

  it("pays a one-troop scout a tenth of a unit: it is there to find sites and earn XP", () => {
    expect(revealYield(troops("T1", WHOLE), limits, 10)).toBe(WHOLE / 10n);
  });

  it("reads the percent from the depth's rules, and nothing for a depth the game lacks", () => {
    const store = {
      get: (_model: string, keys: { depth: number }) => (keys.depth === 1 ? { supply_multiplier: 15 } : undefined),
    };
    expect(readRevealPercent(store as never, 7, 1)).toBe(15);
    expect(readRevealPercent(store as never, 7, 3)).toBeUndefined();
  });

  it("finds a tile's depth from its band of rows, as depth_rules_at does", () => {
    const rules = { epochSeconds: 86400, spacing: 100, startMainAt: 0 };
    expect([0, 99, 100, 250, 399, 400].map((y) => expeditionDepth(rules, { y }))).toEqual([0, 0, 1, 2, 3, 0]);
  });
});
