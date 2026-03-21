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
    expect(source).toContain("shadow-[0_0_20px_rgba(125,255,186,0.25)]");
  });

  it("shows skeleton cards while markets are loading", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/markets-view.tsx"), "utf8");

    expect(source).toContain("const isInitialLoad = (isLoading || isFetching) && markets.length === 0;");
    expect(source).toContain("Loading live markets...");
    expect(source).toContain("MarketTerminalSkeletonCard");
  });
});
