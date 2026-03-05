import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game card prediction market visibility", () => {
  it("loads game-linked markets by prize distribution address", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("game.config?.prizeDistributionAddress");
    expect(source).toContain("fetchMarketByPrizeAddress");
    expect(source).toContain("Market Live");
  });

  it("opens market details with a preselected quick-bet outcome", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("initialOutcomeIndex={initialOutcomeIndex}");
    expect(source).toContain("sorted.slice(0, 2)");
    expect(source).toContain("onClick={() => handleOpenMarket(outcome.index)}");
    expect(source).toContain("{formatOddsPercentage(outcome.odds)}");
    expect(source).not.toContain(">Bet<");
  });

  it("does not rely on controllers provider in game cards", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("const formatOutcomeLabel = (value: string)");
    expect(source).not.toContain("MaybeController");
  });
});
