import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("InGameMarket provider chain wiring", () => {
  it("keeps a single MarketsProviders wrapper to avoid nested Dojo providers", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/market/in-game-market.tsx"), "utf8");

    expect(source).toContain("<MarketsProviders>");
    expect(source).not.toContain("<MarketsProviders chain={providerChain}>");
  });
});
