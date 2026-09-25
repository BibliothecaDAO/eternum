import { describe, expect, it } from "vitest";
import { formatRevealYield } from "./frontier-reveal-yield";

describe("formatRevealYield", () => {
  it("never shows a scout's tenth of a unit as zero on the dock", () => {
    expect(formatRevealYield(100_000_000n)).toBe("Under 1 per reveal");
    expect(formatRevealYield(149_000_000_000n)).toBe("149 per reveal");
  });
});
