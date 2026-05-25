import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useQuickMarketCreate market-existence check", () => {
  it("uses the shared cross-chain market lookup before allowing creation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/hooks/use-quick-market-create.ts"),
      "utf8",
    );

    expect(source).toContain("const preferredChain = getPredictionMarketChain();");
    expect(source).toContain("findMarketByPrizeAddressAcrossChains");
    expect(source).toContain("onChainError: ({ chain, error }) =>");
  });
});
