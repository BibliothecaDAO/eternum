import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useMultiChainMarkets live-first ordering", () => {
  it("prioritizes live markets when mixed statuses are shown", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/use-multi-chain-markets.ts"),
      "utf8",
    );

    expect(source).toContain("const getMarketStatusPriority = (market: MarketClass) => {");
    expect(source).toContain("if (!market.isResolved() && !market.isEnded()) return 0; // Live / open trading.");
    expect(source).toContain('if (status === "all")');
    expect(source).toContain(
      "const statusDifference = getMarketStatusPriority(a.market) - getMarketStatusPriority(b.market);",
    );
  });
});
