import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useCurrentGameMarket chain-aware lookup", () => {
  it("checks preferred chain first and falls back to the other PM chain", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/hooks/use-current-game-market.ts"),
      "utf8",
    );

    expect(source).toContain('preferredChain === "mainnet" ? ["mainnet", "slot"] : ["slot", "mainnet"]');
    expect(source).toContain("getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain])");
    expect(source).toContain("marketChain: marketQuery.data?.chain ?? null");
  });
});
