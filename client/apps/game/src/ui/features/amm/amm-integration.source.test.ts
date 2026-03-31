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

    expect(source).toContain("DEFAULT_STANDALONE_AMMV2_ROUTER_ADDRESS");
    expect(source).toContain("DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS");
    expect(source).toContain("DEFAULT_STANDALONE_AMMV2_INDEXER_URL");
    expect(source).toContain("VITE_PUBLIC_AMM_ROUTER_ADDRESS");
    expect(source).toContain(".default(DEFAULT_STANDALONE_AMMV2_ROUTER_ADDRESS)");
    expect(source).toContain(".default(DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS)");
    expect(source).toContain(".default(DEFAULT_STANDALONE_AMMV2_INDEXER_URL)");
  });

  it("resolves runtime config from env instead of placeholders", () => {
    const source = readSource("src/hooks/use-amm.ts");

    expect(source).toContain("VITE_PUBLIC_AMM_ROUTER_ADDRESS");
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

  it("keeps AMM reads fresh and invalidates cached views after write flows", () => {
    const queriesSource = readSource("src/ui/features/amm/amm-queries.ts");
    const swapSource = readSource("src/ui/features/amm/amm-swap.tsx");
    const addLiquiditySource = readSource("src/ui/features/amm/amm-add-liquidity.tsx");
    const removeLiquiditySource = readSource("src/ui/features/amm/amm-remove-liquidity.tsx");

    expect(queriesSource).toContain("AMM_READ_REFRESH_INTERVAL_MS = 10_000");
    expect(queriesSource).toContain('queryKey: ["amm-pools"]');
    expect(queriesSource).toContain('queryKey: ["amm-positions"]');
    expect(queriesSource).toContain("invalidateAmmReadQueries");
    expect(swapSource).toContain("invalidateAmmReadQueries(queryClient)");
    expect(addLiquiditySource).toContain("invalidateAmmReadQueries(queryClient)");
    expect(removeLiquiditySource).toContain("invalidateAmmReadQueries(queryClient)");
  });

  it("renders mcap in the selected pool summary", () => {
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");

    expect(dashboardSource).toContain('label: "MCap"');
    expect(dashboardSource).toContain("statsQuery.data?.marketCapLords");
    expect(dashboardSource).toContain('label: "LORDS in Pool"');
  });

  it("offers pool ordering controls for market cap, resource ids, and tvl", () => {
    const poolListSource = readSource("src/ui/features/amm/amm-pool-list.tsx");

    expect(poolListSource).toContain('label: "MCap"');
    expect(poolListSource).toContain('label: "Resource IDs"');
    expect(poolListSource).toContain('label: "TVL"');
    expect(poolListSource).toContain('orderBy: "mcap"');
  });

  it("defaults the pool rail to the new editorial order and uses a dropdown sorter", () => {
    const poolListSource = readSource("src/ui/features/amm/amm-pool-list.tsx");

    expect(poolListSource).toContain('label: "Default"');
    expect(poolListSource).toContain('useState<AmmPoolOrder>("default")');
    expect(poolListSource).toContain("<Select");
    expect(poolListSource).toContain("<SelectTrigger");
    expect(poolListSource).toContain("<SelectContent");
    expect(poolListSource).toContain("<SelectItem");
  });

  it("shows spot price, market cap, and tvl in each pool row without the old crowded labels", () => {
    const poolListSource = readSource("src/ui/features/amm/amm-pool-list.tsx");
    const poolRowSource = readSource("src/ui/features/amm/amm-pool-row.tsx");

    expect(poolListSource).toContain("marketCapByTokenAddress");
    expect(poolRowSource).toContain("spotPrice");
    expect(poolRowSource).toContain("marketCap");
    expect(poolRowSource).toContain("TVL");
    expect(poolRowSource).not.toContain("Spot Price");
    expect(poolRowSource).not.toContain("pairLabel");
    expect(poolRowSource).not.toContain("vs LORDS");
    expect(poolRowSource).toContain("text-right");
  });

  it("keeps the desktop pool rail inside a viewport-bounded shell", () => {
    const ammViewSource = readSource("src/ui/features/landing/views/amm-view.tsx");
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");

    expect(ammViewSource).toContain("lg:h-[calc(100vh-7.5rem)]");
    expect(ammViewSource).toContain("lg:overflow-hidden");
    expect(dashboardSource).toContain("lg:h-full");
    expect(dashboardSource).toContain("lg:overflow-hidden");
  });

  it("widens the desktop pool rail and keeps its column aligned with the action stack", () => {
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");

    expect(dashboardSource).toContain("lg:w-[375px]");
    expect(dashboardSource).toContain("lg:grid-cols-[375px_minmax(0,1fr)]");
  });

  it("gives pool names the full headline row and moves LORDS spot price underneath", () => {
    const poolRowSource = readSource("src/ui/features/amm/amm-pool-row.tsx");

    expect(poolRowSource).not.toContain("Resource Pool");
    expect(poolRowSource).toContain("flex min-w-0 flex-col");
    expect(poolRowSource).toContain("truncate text-xs font-semibold uppercase tracking-[0.14em] text-gold");
    expect(poolRowSource).toContain("text-xs font-semibold uppercase tracking-[0.14em] text-gold/80");
    expect(poolRowSource).toContain("text-right text-[10px] uppercase tracking-[0.14em] text-gold/55");
  });

  it("removes redundant swap panel copy and lets the metric cards fill the row", () => {
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");
    const swapSource = readSource("src/ui/features/amm/amm-swap.tsx");

    expect(dashboardSource).not.toContain("activeAsset ? `${activeAsset.displayName} / LORDS`");
    expect(swapSource).not.toContain(">Route<");
    expect(swapSource).toContain("lg:grid-cols-4");
    expect(swapSource).not.toContain("xl:grid-cols-5");
  });

  it("adds reserve cards and a voyager fee link to the selected pool summary", () => {
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");

    expect(dashboardSource).toContain("label: `${asset.displayName} in Pool`");
    expect(dashboardSource).toContain('label: "LORDS in Pool"');
    expect(dashboardSource).toContain("href={feeToHref}");
  });

  it("shows total swap fees only and caps minimum received precision", () => {
    const swapSource = readSource("src/ui/features/amm/amm-swap.tsx");

    expect(swapSource).toContain('label: "Total Fees"');
    expect(swapSource).not.toContain('label: "LP Fee"');
    expect(swapSource).not.toContain('label: "Protocol Fee"');
    expect(swapSource).not.toContain('label: "Fee To"');
    expect(swapSource).toContain("formatAmmMinimumReceived");
  });

  it("shows live pool balances in the liquidity tab", () => {
    const dashboardSource = readSource("src/ui/features/amm/amm-dashboard.tsx");

    expect(dashboardSource).toContain("Pool Balances");
    expect(dashboardSource).toContain("in pool");
  });
});
