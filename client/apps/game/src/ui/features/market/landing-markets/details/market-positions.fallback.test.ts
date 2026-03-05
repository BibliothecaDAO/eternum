import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketPositions fallback source", () => {
  it("falls back to market buy activity when token balances are unavailable", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/details/market-positions.tsx"),
      "utf8",
    );

    expect(source).toContain("useMarketActivity(market.market_id");
    expect(source).toContain("holdersFromBalances.length > 0 ? holdersFromBalances : holdersFromBuys");
    expect(source).toContain("fetchMarketBuyOutcomesByMarketAndAccount");
  });
});
