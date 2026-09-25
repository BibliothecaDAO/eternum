import { describe, expect, it } from "vitest";
import { describeRevealYield, formatRevealYield } from "./frontier-reveal-yield";

describe("describeRevealYield", () => {
  it("promises the payout the contract will pay, Essence or labor", () => {
    expect(describeRevealYield(1_350_500_000_000n)).toBe("1,350 per reveal · Essence or labor");
  });

  it("tells a scout its job is finding, and says nothing when the depth has no rule", () => {
    expect(describeRevealYield(100_000_000n)).toBe("Under 1 per reveal · finds sites and earns XP");
    expect(describeRevealYield(undefined)).toBe("—");
  });

  it("never shows a scout's tenth of a unit as zero on the dock", () => {
    expect(formatRevealYield(100_000_000n)).toBe("Under 1 per reveal");
    expect(formatRevealYield(149_000_000_000n)).toBe("149 per reveal");
  });
});
