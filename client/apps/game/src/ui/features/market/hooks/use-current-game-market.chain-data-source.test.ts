import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useCurrentGameMarket chain-aware lookup", () => {
  it("uses the shared cross-chain lookup before loading numerators", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/hooks/use-current-game-market.ts"),
      "utf8",
    );

    expect(source).toContain("findMarketByPrizeAddressAcrossChains");
    expect(source).toContain("preferredChain,");
    expect(source).toContain("marketChain: marketQuery.data?.chain ?? null");
  });
});
