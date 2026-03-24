// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("AMM feature wiring", () => {
  it("nests the AMM route inside the landing dashboard instead of mounting a standalone shell", () => {
    const appSource = readSource("src/app.tsx");
    const landingSource = readSource("src/ui/features/landing/index.ts");
    const layoutSource = readSource("src/ui/features/landing/landing-layout.tsx");

    expect(appSource).toContain(
      "import { LandingLayout, PlayView, ProfileView, MarketsView, LeaderboardView, AmmView }",
    );
    expect(appSource).toContain('<Route path="amm" element={<AmmView />} />');
    expect(appSource).not.toContain('const LazyAmmDashboard = lazy(() => import("./ui/features/amm/amm-dashboard"))');
    expect(appSource).not.toContain('path="/amm"');
    expect(landingSource).toContain('export { AmmView } from "./views/amm-view"');
    expect(layoutSource).toContain('"/amm": "04"');
  });

  it("gives the standalone AMM route non-empty defaults in env.ts", () => {
    const source = readSource("env.ts");

    expect(source).toContain("DEFAULT_STANDALONE_AMM_ADDRESS");
    expect(source).toContain("DEFAULT_STANDALONE_AMM_LORDS_ADDRESS");
    expect(source).toContain("DEFAULT_STANDALONE_AMM_INDEXER_URL");
    expect(source).toContain(".default(DEFAULT_STANDALONE_AMM_ADDRESS)");
    expect(source).toContain(".default(DEFAULT_STANDALONE_AMM_LORDS_ADDRESS)");
    expect(source).toContain(".default(DEFAULT_STANDALONE_AMM_INDEXER_URL)");
  });

  it("resolves runtime config from env instead of placeholders", () => {
    const source = readSource("src/hooks/use-amm.ts");

    expect(source).toContain("VITE_PUBLIC_AMM_ADDRESS");
    expect(source).toContain("VITE_PUBLIC_AMM_LORDS_ADDRESS");
    expect(source).toContain("VITE_PUBLIC_AMM_INDEXER_URL");
    expect(source).not.toContain("PLACEHOLDER_AMM_ADDRESS");
    expect(source).not.toContain("PLACEHOLDER_LORDS_ADDRESS");
    expect(source).not.toContain("PLACEHOLDER_INDEXER_URL");
  });

  it("uses approval builders for swaps and removes hardcoded mock pools from execution panels", () => {
    const swapSource = readSource("src/ui/features/amm/amm-swap.tsx");
    const addLiquiditySource = readSource("src/ui/features/amm/amm-add-liquidity.tsx");
    const removeLiquiditySource = readSource("src/ui/features/amm/amm-remove-liquidity.tsx");

    expect(swapSource).toContain("swapLordsForTokenWithApproval");
    expect(swapSource).toContain("swapTokenForLordsWithApproval");
    expect(swapSource).toContain("swapTokenForTokenWithApproval");
    expect(swapSource).not.toContain("const MOCK_POOL");
    expect(addLiquiditySource).not.toContain("const MOCK_POOL");
    expect(removeLiquiditySource).not.toContain("const MOCK_POOL");
  });

  it("uses resolved standalone resource names and the configured LORDS address in AMM read views", () => {
    const poolListSource = readSource("src/ui/features/amm/amm-pool-list.tsx");
    const tradeHistorySource = readSource("src/ui/features/amm/amm-trade-history.tsx");
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");

    expect(poolListSource).toContain("resolveAmmAssetPresentation");
    expect(poolListSource).not.toContain("const POOL_NAMES");
    expect(tradeHistorySource).toContain("config.lordsAddress");
    expect(tradeHistorySource).toContain("resolveAmmAssetPresentation");
    expect(tradeHistorySource).not.toContain('trade.tokenIn === "0x1"');
    expect(dashboardSource).not.toContain("QueryClientProvider");
    expect(dashboardSource).not.toContain("min-h-screen");
    expect(dashboardSource).not.toContain("&larr; Back");
  });

  it("renders price over time with a trading chart library instead of the inline SVG fallback", () => {
    const chartSource = readSource("src/ui/features/amm/amm-price-chart.tsx");

    expect(chartSource).toContain("lightweight-charts");
    expect(chartSource).toContain("createChart");
    expect(chartSource).not.toContain("<svg");
    expect(chartSource).not.toContain("<polyline");
  });

  it("documents the AMM dashboard in the latest features list", () => {
    const source = readSource("src/ui/features/world/latest-features.ts");

    expect(source).toContain("AMM");
  });
});
