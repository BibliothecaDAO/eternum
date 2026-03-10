// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketPositions payout fallback source", () => {
  it("passes resolved payout numerators into redeemable calculation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/details/market-positions.tsx"),
      "utf8",
    );

    expect(source).toContain("fetchConditionResolutionByKeys");
    expect(source).toContain("payoutNumerators");
    expect(source).toContain("computeRedeemableValue({");
  });
});
