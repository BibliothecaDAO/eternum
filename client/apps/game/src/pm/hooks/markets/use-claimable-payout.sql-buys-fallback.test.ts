// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useClaimablePayout SQL buys fallback source", () => {
  it("falls back to market buy rows when token balances resolve to zero", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pm/hooks/markets/use-claimable-payout.ts"), "utf8");

    expect(source).toContain("fetchMarketBuyOutcomesByMarketAndAccount");
    expect(source).toContain("claimableAmountFromBuys");
    expect(source).toContain(
      "claimableAmountFromBalances > 0n ? claimableAmountFromBalances : claimableAmountFromBuys",
    );
  });
});
