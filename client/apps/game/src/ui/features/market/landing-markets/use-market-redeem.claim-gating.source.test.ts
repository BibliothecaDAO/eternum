import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useMarketRedeem claim gating", () => {
  it("only enables claim queries when a resolved market is present", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/use-market-redeem.ts"),
      "utf8",
    );

    expect(source).toContain("const hasResolvedMarket = Boolean(market?.isResolved())");
    expect(source).toContain("enabled: claimsEnabled && hasResolvedMarket && Boolean(accountAddress)");
    expect(source).toContain("useProtocolFees(validMarketId, claimsEnabled && hasResolvedMarket)");
  });
});
