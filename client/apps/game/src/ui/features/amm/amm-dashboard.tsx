import { Button, Tabs, cn } from "@/ui/design-system/atoms";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useAmm } from "@/hooks/use-amm";
import { computeSpotPrice, type Pool } from "@/services/amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { BlankOverlayContainer } from "@/ui/shared/containers/blank-overlay-container";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AmmAddLiquidity } from "./amm-add-liquidity";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { AmmPoolList } from "./amm-pool-list";
import { AmmPriceChart } from "./amm-price-chart";
import { AMM_READ_QUERY_OPTIONS } from "./amm-queries";
import { AmmRemoveLiquidity } from "./amm-remove-liquidity";
import { resolveAmmFeeBreakdown, resolveSelectedAmmPool } from "./amm-model";
import { AmmSwap } from "./amm-swap";
import { AmmTradeHistory } from "./amm-trade-history";
import { formatAmmCompactAmount, formatAmmFeeTo, formatAmmPercent, formatAmmSpotPrice } from "./amm-format";

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

  useEffect(() => {
    if (!selectedPool && poolsQuery.data && poolsQuery.data.length > 0) {
      setSelectedPool(poolsQuery.data[0].tokenAddress);
    }
  }, [poolsQuery.data, selectedPool, setSelectedPool]);

  return {
    config,
    isConfigured,
    selectedPool,
    activePool: resolveSelectedAmmPool(poolsQuery.data ?? [], selectedPool),
    poolsLoading: poolsQuery.isLoading,
  };
}

const AmmDesktopPoolRail = () => {
  return (
    <aside className="hidden lg:block lg:w-[300px] xl:sticky xl:top-24 xl:self-start">
      <AmmPoolList />
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
        className="w-full max-w-md rounded-[28px] border border-gold/10 bg-black/90 p-4 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.95)] backdrop-blur-[12px]"
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

        <AmmPoolList showHeader={false} onPoolSelect={() => onClose()} />
      </div>
    </BlankOverlayContainer>
  );
};

const SummarySkeleton = () => (
  <div className="rounded-[28px] border border-gold/10 bg-black/25 p-4 backdrop-blur-[10px]">
    <div className="animate-pulse space-y-3">
      <div className="h-6 w-40 rounded bg-gold/10" />
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
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
  const metrics = [
    { label: "Spot Price", value: `${formatAmmSpotPrice(currentSpotPrice)} LORDS` },
    {
      label: "MCap",
      value: statsQuery.data?.marketCapLords != null ? formatAmmCompactAmount(statsQuery.data.marketCapLords) : "--",
    },
    { label: "TVL", value: formatAmmCompactAmount(activePool.lordsReserve * 2n) },
    {
      label: "Circulation",
      value: statsQuery.data?.resourceSupply != null ? formatAmmCompactAmount(statsQuery.data.resourceSupply) : "--",
    },
    { label: "24H Volume", value: statsQuery.data ? formatAmmCompactAmount(statsQuery.data.volume24h) : "--" },
    { label: "LP Holders", value: statsQuery.data ? statsQuery.data.lpHolderCount.toLocaleString() : "--" },
    { label: "LP Fee", value: formatAmmPercent(feeBreakdown.lpFeePercent) },
    { label: "Protocol Fee", value: formatAmmPercent(feeBreakdown.protocolFeePercent) },
    {
      label: "Fee To",
      value: formatAmmFeeTo(statsQuery.data?.feeTo ?? activePool.feeTo),
    },
    { label: "24H Fees", value: statsQuery.data ? formatAmmCompactAmount(statsQuery.data.fees24h) : "--" },
  ];

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

      <div className="mt-3 grid gap-1.5 grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="rounded-xl border border-gold/10 bg-black/20 px-2.5 py-2 backdrop-blur-[8px]"
          >
            <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">{metric.label}</div>
            <div className={cn("mt-1 font-semibold text-gold", index === 0 ? "font-cinzel text-lg" : "text-sm")}>
              {metric.value}
            </div>
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
  const { config } = useAmm();
  const activeAsset = activePool ? resolveAmmAssetPresentation(activePool.tokenAddress, config.lordsAddress) : null;
  const tabs: Array<{ key: AmmTabKey; label: string; component: React.ReactNode }> = [
    { key: "swap", label: "Swap", component: <AmmSwap /> },
    { key: "liquidity", label: "Liquidity", component: <AmmLiquidityCard activePool={activePool} /> },
    { key: "history", label: "History", component: <AmmTradeHistory /> },
  ];

  return (
    <section className="rounded-[28px] border border-gold/10 bg-black/30 p-4 shadow-[0_22px_60px_-38px_rgba(0,0,0,0.98)] backdrop-blur-[12px]">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-gold/40">Agora Actions</div>
        <div className="mt-1 text-sm text-gold/65">
          {activeAsset ? `${activeAsset.displayName} / LORDS` : "Select a pool to begin"}
        </div>
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
    <div className="space-y-4">
      <AmmMobilePoolPicker open={mobilePickerOpen} onClose={() => setMobilePickerOpen(false)} />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <AmmDesktopPoolRail />

        <div className="min-w-0 space-y-4">
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
