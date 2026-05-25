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
    expect(source).toContain("findMarketByPrizeAddressAcrossChains");
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

  it("keeps controller lookups behind the shared display wrapper", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-selector/game-card-grid.tsx"),
      "utf8",
    );

    expect(source).toContain("MaybeController");
    expect(source).not.toContain("useOptionalControllers");
    expect(source).not.toContain("useControllers(");
  });
});
