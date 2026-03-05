import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketDetailsModal chain-aware data sources", () => {
  it("uses per-chain providers and SQL endpoint", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/views/market-details-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("chain: MarketDataChain");
    expect(source).toContain("<MarketsProviders chain={chain}>");
    expect(source).toContain("getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain])");
    expect(source).toContain("fetchMarketBuyUniqueAccountsCountByMarket");
    expect(source).toContain("<MarketPositions market={market} chain={chain} address={address} />");
    expect(source).toContain("<MarketVaultFees market={market} chain={chain} address={address} />");
  });

  it("normalizes market id with address padding for SQL lookups", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/views/market-details-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("addAddressPadding(`0x${BigInt(market.market_id).toString(16)}`)");
  });

  it("renders refresh and watch as same-size icon-only controls", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/views/market-details-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("inline-flex h-9 w-9 items-center justify-center rounded-lg border");
    expect(source).toContain(
      '{watchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}',
    );
  });

  it("supports preselecting an outcome when opened from quick bet", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/views/market-details-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("initialOutcomeIndex?: number");
    expect(source).toContain("outcomes.find((outcome) => outcome.index === initialOutcomeIndex)");
    expect(source).toContain("initialOutcomeIndex={initialOutcomeIndex}");
  });
});
