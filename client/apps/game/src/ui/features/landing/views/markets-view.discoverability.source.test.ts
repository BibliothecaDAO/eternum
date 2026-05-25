import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketsView discoverability", () => {
  it("defaults the landing markets tab to live markets", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/markets-view.tsx"), "utf8");

    expect(source).toContain('return "live";');
  });

  it("adds a collapsible explainer and interactive sort controls", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/markets-view.tsx"), "utf8");

    expect(source).toContain("What are prediction markets?");
    expect(source).toContain("Creation Date");
    expect(source).toContain("End Time");
    expect(source).toContain("Volume");
    expect(source).toContain("Pool Size");
  });

  it("surfaces TVL as the live-card stat and stores pool-size data in the market feed", () => {
    const viewSource = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/markets-view.tsx"), "utf8");
    const dataSource = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/use-multi-chain-markets.ts"),
      "utf8",
    );

    expect(viewSource).toContain("Current TVL");
    expect(dataSource).toContain("tvlRaw");
    expect(dataSource).toContain("tvlDisplay");
  });
});
