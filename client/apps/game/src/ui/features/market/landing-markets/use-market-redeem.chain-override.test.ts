// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useMarketRedeem chain override source", () => {
  it("uses modal-provided chain override for payout and protocol fee queries", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/use-market-redeem.ts"),
      "utf8",
    );

    expect(source).toContain("chainOverride ?? getPredictionMarketChain()");
    expect(source).toContain("useClaimablePayout(");
    expect(source).toContain("chainOverride,");
  });
});
