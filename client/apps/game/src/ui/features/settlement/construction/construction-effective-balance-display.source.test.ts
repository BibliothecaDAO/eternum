// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("construction effective balance display wiring", () => {
  it("uses precision-aware effective balances for construction cost cards", () => {
    const source = readSource("src/ui/features/settlement/construction/select-preview-building.tsx");

    expect(source).toContain("getEffectiveConstructionBalanceRaw");
    expect(source).not.toContain("const balance = getBalance(");
  });

  it("does not pass display-unit construction balances through raw currency formatting", () => {
    const marketOrderPanelSource = readSource("src/ui/features/economy/trading/market-order-panel.tsx");
    const unifiedTradePanelSource = readSource("src/ui/features/economy/trading/unified-trade-panel.tsx");

    expect(marketOrderPanelSource).not.toContain("currencyFormat(balance ? Number(balance) : 0, 0)");
    expect(marketOrderPanelSource).not.toContain("currencyFormat(resourceBalance ? Number(resourceBalance) : 0, 0)");
    expect(marketOrderPanelSource).not.toContain("currencyFormat(lordsBalance ? Number(lordsBalance) : 0, 0)");
    expect(marketOrderPanelSource).not.toContain("currencyFormat(donkeyBalance ? Number(donkeyBalance) : 0, 0)");

    expect(unifiedTradePanelSource).not.toContain(
      'currencyFormat(tradeDirection === "buy" ? lordsBalance : resourceBalance, 0)',
    );
    expect(unifiedTradePanelSource).not.toContain("currencyFormat(tradeAmount, 0)");
    expect(unifiedTradePanelSource).not.toContain("currencyFormat(totalLords, 2)");
  });
});
