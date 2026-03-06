import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketsView modal chain wiring", () => {
  it("passes selected market chain into MarketDetailsModal", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/markets-view.tsx"), "utf8");

    expect(source).toContain("<MarketDetailsModal market={market} chain={chain} onClose={() => toggleModal(null)} />");
  });

  it("highlights the Live filter with a green glow when live markets exist", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/markets-view.tsx"), "utf8");

    expect(source).toContain("const hasLiveMarkets = counts.live > 0;");
    expect(source).toContain("isLiveOption && hasLiveMarkets");
    expect(source).toContain("shadow-[0_0_18px_rgba(16,185,129,0.35)]");
  });
});
