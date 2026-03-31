import { Button, Tabs, cn } from "@/ui/design-system/atoms";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useAmm } from "@/hooks/use-amm";
import { computeSpotPrice, type Pool } from "@/services/amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { BlankOverlayContainer } from "@/ui/shared/containers/blank-overlay-container";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AmmAddLiquidity } from "./amm-add-liquidity";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { AmmPoolList } from "./amm-pool-list";
import { AmmPriceChart } from "./amm-price-chart";
import { AMM_READ_QUERY_OPTIONS } from "./amm-queries";
import { AmmRemoveLiquidity } from "./amm-remove-liquidity";
import { orderAmmPools, resolveAmmFeeBreakdown, resolveSelectedAmmPool } from "./amm-model";
import { AmmSwap } from "./amm-swap";
import { AmmTradeHistory } from "./amm-trade-history";
import {
  formatAmmCompactAmount,
  formatAmmFeeTo,
  formatAmmPercent,
  formatAmmSpotPrice,
  resolveAmmFeeToHref,
} from "./amm-format";

type AmmTabKey = "swap" | "liquidity" | "history";

function useAmmSelectionState() {
  const { client, config, isConfigured } = useAmm();
  const selectedPool = useAmmStore((state) => state.selectedPool);
  const setSelectedPool = useAmmStore((state) => state.setSelectedPool);
  const poolsQuery = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    ...AMM_READ_QUERY_OPTIONS,
  });
  const orderedPools = useMemo(
    () =>
      orderAmmPools(poolsQuery.data ?? [], {
        lordsAddress: config.lordsAddress,
        orderBy: "default",
        marketCapByTokenAddress: new Map(),
      }),
    [config.lordsAddress, poolsQuery.data],
  );

  useEffect(() => {
    if (!selectedPool && orderedPools.length > 0) {
      setSelectedPool(orderedPools[0].tokenAddress);
    }
  }, [orderedPools, selectedPool, setSelectedPool]);

  return {
    config,
    isConfigured,
    selectedPool,
    activePool: resolveSelectedAmmPool(orderedPools, selectedPool),
    poolsLoading: poolsQuery.isLoading,
  };
}

const AmmDesktopPoolRail = () => {
  return (
    <aside className="hidden min-h-0 lg:block lg:h-full lg:w-[375px]">
      <AmmPoolList className="h-full" />
    </aside>
  );
};

const AmmMobilePoolPicker = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <BlankOverlayContainer
      open={open}
      zIndex={140}
      className="bg-black/75 px-4 backdrop-blur-[2px] lg:hidden"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-[28px] border border-gold/10 bg-black/90 p-4 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.95)] backdrop-blur-[12px]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-gold/45">Choose Pool</div>
            <div className="text-sm text-gold/70">Select the resource market you want to trade.</div>
          </div>
          <button className="text-sm uppercase tracking-[0.16em] text-gold/60 hover:text-gold" onClick={onClose}>
            Close
          </button>
        </div>

        <AmmPoolList className="min-h-0 flex-1" showHeader={false} onPoolSelect={() => onClose()} />
      </div>
    </BlankOverlayContainer>
  );
};

const SummarySkeleton = () => (
  <div className="rounded-[28px] border border-gold/10 bg-black/25 p-4 backdrop-blur-[10px]">
    <div className="animate-pulse space-y-3">
      <div className="h-6 w-40 rounded bg-gold/10" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-16 rounded-2xl bg-gold/8" />
        ))}
      </div>
    </div>
  </div>
);

const AmmSelectedPoolSummary = ({
  activePool,
  isConfigured,
  isLoading,
  onChoosePool,
}: {
  activePool: Pool | null;
  isConfigured: boolean;
  isLoading: boolean;
  onChoosePool: () => void;
}) => {
  const { client, config } = useAmm();
  const statsQuery = useQuery({
    queryKey: ["amm-pool-stats", activePool?.tokenAddress],
    queryFn: async () => {
      if (!activePool || !client) return null;
      return client.api.getPoolStats(activePool.tokenAddress);
    },
    enabled: Boolean(activePool) && Boolean(client),
    ...AMM_READ_QUERY_OPTIONS,
  });

  if (!isConfigured) {
    return (
      <div className="rounded-[28px] border border-gold/10 bg-black/25 p-4 text-sm text-gold/45 backdrop-blur-[10px]">
        The Agora runtime config is missing.
      </div>
    );
  }

  if (isLoading) {
    return <SummarySkeleton />;
  }

  if (!activePool) {
    return (
      <div className="rounded-[28px] border border-gold/10 bg-black/25 p-4 backdrop-blur-[10px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-gold/45">Selected Pool</div>
            <div className="mt-1 text-sm text-gold/65">Pick a pool to see the Agora overview.</div>
          </div>
          <button
            className="rounded-2xl border border-gold/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-gold/70 hover:border-gold/30 hover:text-gold lg:hidden"
            onClick={onChoosePool}
          >
            Choose Pool
          </button>
        </div>
      </div>
    );
  }

  const asset = resolveAmmAssetPresentation(activePool.tokenAddress, config.lordsAddress);
  const currentSpotPrice =
    statsQuery.data?.spotPrice ?? computeSpotPrice(activePool.lordsReserve, activePool.tokenReserve);
  const feeBreakdown = resolveAmmFeeBreakdown(activePool);
  const feeToAddress = statsQuery.data?.feeTo ?? activePool.feeTo;
  const feeToHref = resolveAmmFeeToHref(feeToAddress, config.explorerBaseUrl);
  const metricRows = buildSelectedPoolMetricRows({
    activePool,
    asset,
    currentSpotPrice,
    feeBreakdown,
    feeToAddress,
    marketCapLords: statsQuery.data?.marketCapLords ?? null,
    volume24h: statsQuery.data?.volume24h ?? null,
    fees24h: statsQuery.data?.fees24h ?? null,
  });

  return (
    <section className="rounded-[28px] border border-gold/10 bg-black/30 px-4 py-3 shadow-[0_22px_60px_-38px_rgba(0,0,0,0.98)] backdrop-blur-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/10 bg-black/35">
            {asset.iconResource ? (
              <ResourceIcon resource={asset.iconResource} size="md" withTooltip={false} />
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold/70">
                {asset.shortLabel.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-gold/40">Selected Pool</div>
            <div className="truncate font-cinzel text-lg font-semibold text-gold">{asset.displayName}</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-gold/45">
              Trading Pair • {asset.displayName} / LORDS
            </div>
          </div>
        </div>

        <button
          className="rounded-2xl border border-gold/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-gold/70 hover:border-gold/30 hover:text-gold lg:hidden"
          onClick={onChoosePool}
        >
          Choose Pool
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {metricRows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
            {row.map((metric, metricIndex) => (
              <div
                key={metric.label}
                className="rounded-xl border border-gold/10 bg-black/20 px-2.5 py-2 backdrop-blur-[8px]"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">{metric.label}</div>
                {metric.href && feeToHref ? (
                  <a
                    href={feeToHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-sm font-semibold text-gold underline-offset-2 hover:underline"
                  >
                    {metric.value}
                  </a>
                ) : (
                  <div
                    className={cn(
                      "mt-1 truncate font-semibold text-gold",
                      rowIndex === 0 && metricIndex === 0 ? "font-cinzel text-lg" : "text-sm",
                    )}
                  >
                    {metric.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

const AmmLiquidityCard = ({ activePool }: { activePool: Pool | null }) => {
  const { config } = useAmm();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const asset = activePool ? resolveAmmAssetPresentation(activePool.tokenAddress, config.lordsAddress) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gold/40">Liquidity</div>
          <div className="text-sm text-gold/65">
            {asset ? `Manage ${asset.displayName} / LORDS LP` : "Choose a pool to manage liquidity."}
          </div>
        </div>

        <div className="inline-flex rounded-2xl border border-gold/10 bg-black/25 p-1">
          {(
            [
              { key: "add", label: "Add" },
              { key: "remove", label: "Remove" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                mode === option.key ? "bg-gold/20 text-gold" : "text-gold/55 hover:text-gold hover:bg-gold/10",
              )}
              onClick={() => setMode(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {activePool && asset && (
        <section className="rounded-2xl border border-gold/10 bg-black/25 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">Pool Balances</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {buildLiquidityPoolBalanceCards(activePool, asset.displayName).map((metric) => (
              <div key={metric.label} className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">{metric.label}</div>
                <div className="mt-1 text-sm font-semibold text-gold">{metric.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {mode === "add" ? <AmmAddLiquidity /> : <AmmRemoveLiquidity />}
    </div>
  );
};

const AmmActionCard = ({
  activePool,
  selectedTab,
  onTabChange,
}: {
  activePool: Pool | null;
  selectedTab: number;
  onTabChange: (index: number) => void;
}) => {
  const tabs: Array<{ key: AmmTabKey; label: string; component: React.ReactNode }> = [
    { key: "swap", label: "Swap", component: <AmmSwap /> },
    { key: "liquidity", label: "Liquidity", component: <AmmLiquidityCard activePool={activePool} /> },
    { key: "history", label: "History", component: <AmmTradeHistory /> },
  ];

  return (
    <section className="rounded-[28px] border border-gold/10 bg-black/30 p-4 shadow-[0_22px_60px_-38px_rgba(0,0,0,0.98)] backdrop-blur-[12px]">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-gold/40">Agora Actions</div>
        {!activePool ? <div className="mt-1 text-sm text-gold/65">Select a pool to begin</div> : null}
      </div>

      <Tabs
        variant="selection"
        size="medium"
        selectedIndex={selectedTab}
        onChange={(index: number) => onTabChange(index)}
        className="h-full"
      >
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.key}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="mt-4 overflow-hidden">
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.key}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </section>
  );
};

const AmmDashboardContent = () => {
  const { activePool, isConfigured, poolsLoading } = useAmmSelectionState();
  const [selectedTab, setSelectedTab] = useState(0);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  return (
    <div className="space-y-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <AmmMobilePoolPicker open={mobilePickerOpen} onClose={() => setMobilePickerOpen(false)} />

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[375px_minmax(0,1fr)] lg:overflow-hidden">
        <AmmDesktopPoolRail />

        <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:scrollbar-thin lg:scrollbar-thumb-gold/20 lg:scrollbar-track-transparent">
          <AmmSelectedPoolSummary
            activePool={activePool}
            isConfigured={isConfigured}
            isLoading={poolsLoading}
            onChoosePool={() => setMobilePickerOpen(true)}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.85fr)]">
            <AmmActionCard activePool={activePool} selectedTab={selectedTab} onTabChange={setSelectedTab} />
            <AmmPriceChart />
          </div>
        </div>
      </div>
    </div>
  );
};

const AmmDashboard = () => {
  return <AmmDashboardContent />;
};

export default AmmDashboard;

function buildSelectedPoolMetricRows({
  activePool,
  asset,
  currentSpotPrice,
  feeBreakdown,
  feeToAddress,
  marketCapLords,
  volume24h,
  fees24h,
}: {
  activePool: Pool;
  asset: { displayName: string };
  currentSpotPrice: number;
  feeBreakdown: ReturnType<typeof resolveAmmFeeBreakdown>;
  feeToAddress: string;
  marketCapLords: bigint | null;
  volume24h: bigint | null;
  fees24h: bigint | null;
}) {
  return [
    [
      { label: "Spot Price", value: `${formatAmmSpotPrice(currentSpotPrice)} LORDS` },
      { label: "MCap", value: formatNullableAmmAmount(marketCapLords) },
      { label: "TVL", value: formatAmmCompactAmount(activePool.lordsReserve * 2n) },
      { label: `${asset.displayName} in Pool`, value: formatAmmCompactAmount(activePool.tokenReserve) },
      { label: "LORDS in Pool", value: formatAmmCompactAmount(activePool.lordsReserve) },
    ],
    [
      { label: "24H Volume", value: formatNullableAmmAmount(volume24h) },
      { label: "24H Fees", value: formatNullableAmmAmount(fees24h) },
      { label: "LP Fee", value: formatAmmPercent(feeBreakdown.lpFeePercent) },
      { label: "Protocol Fee", value: formatAmmPercent(feeBreakdown.protocolFeePercent) },
      { label: "Fee To", value: formatAmmFeeTo(feeToAddress), href: true },
    ],
  ];
}

function buildLiquidityPoolBalanceCards(activePool: Pool, assetName: string) {
  return [
    { label: `${assetName} in pool`, value: formatAmmCompactAmount(activePool.tokenReserve) },
    { label: "LORDS in pool", value: formatAmmCompactAmount(activePool.lordsReserve) },
  ];
}

function formatNullableAmmAmount(value: bigint | null): string {
  return value == null ? "--" : formatAmmCompactAmount(value);
}
