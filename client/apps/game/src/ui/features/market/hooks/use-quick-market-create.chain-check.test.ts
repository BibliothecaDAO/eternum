import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useQuickMarketCreate market-existence check", () => {
  it("checks PM SQL on both chains before allowing creation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/hooks/use-quick-market-create.ts"),
      "utf8",
    );

    expect(source).toContain("const preferredChain = getPredictionMarketChain();");
    expect(source).toContain('const chainsToCheck = preferredChain === "mainnet" ? (["mainnet", "slot"] as const)');
    expect(source).toContain("getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain])");
  });
});
