import type { MarketClass, MarketOutcome } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useTokens } from "@/pm/hooks/dojo/use-tokens";
import { getPmSqlApiForUrl } from "@/pm/hooks/queries";
import { formatUnits } from "@/pm/utils";
import { MaybeController } from "@/ui/features/market/landing-markets/maybe-controller";
import { TokenIcon } from "@/ui/features/market/landing-markets/token-icon";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import { MarketOdds } from "@/ui/features/market/landing-markets/market-odds";
import { MarketStatusBadge } from "@/ui/features/market/landing-markets/market-status-badge";
import { MarketTimeline } from "@/ui/features/market/landing-markets/market-timeline";
import { MarketActivity } from "@/ui/features/market/landing-markets/details/market-activity";
import { MarketFees } from "@/ui/features/market/landing-markets/details/market-fees";
import { MarketHistory } from "@/ui/features/market/landing-markets/details/market-history";
import { MarketPositions } from "@/ui/features/market/landing-markets/details/market-positions";
import {
  MarketResolutionView,
  type MarketResolutionController,
  useMarketResolutionController,
} from "@/ui/features/market/landing-markets/details/market-resolution";
import { MarketResolved } from "@/ui/features/market/landing-markets/details/market-resolved";
import { MarketTrade } from "@/ui/features/market/landing-markets/details/market-trade";
import { MarketVaultFees } from "@/ui/features/market/landing-markets/details/market-vault-fees";
import { useMarketRedeem } from "@/ui/features/market/landing-markets/use-market-redeem";
import { useMarketWatch } from "@/ui/features/market/landing-markets/use-market-watch";
import { getContractByName } from "@dojoengine/core";
import { useMarket } from "@pm/sdk";
import { ChevronDown, Loader2, Play, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addAddressPadding } from "starknet";
import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";

interface MarketDetailsModalProps {
  market: MarketClass;
  chain: MarketDataChain;
  initialOutcomeIndex?: number;
  onClose: () => void;
}

type MarketDataChain = "slot" | "mainnet";

type MarketDetailsTabKey = "terms" | "activity" | "positions" | "vault-fees" | "resolution";

const MARKET_DETAIL_TABS: Array<{ key: MarketDetailsTabKey; label: string }> = [
  { key: "terms", label: "Terms" },
  { key: "activity", label: "Activity" },
  { key: "positions", label: "My Positions" },
  { key: "vault-fees", label: "Vault Fees" },
  { key: "resolution", label: "Resolution" },
];

const TRADE_SYNC_MAX_ATTEMPTS = 10;
const TRADE_SYNC_INTERVAL_MS = 2_000;

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const formatTimeLeft = (targetSeconds: number | null) => {
  if (targetSeconds == null || targetSeconds <= 0) return "TBD";
  const nowSec = Math.floor(Date.now() / 1_000);
  const diff = targetSeconds - nowSec;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3_600);
  const minutes = Math.floor((diff % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const toBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  return 0n;
};

const formatCompactAmount = (amountRaw: bigint, decimals: number) => {
  const normalized = formatUnits(amountRaw, decimals, 6).replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return "0";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
};

const renderTabContent = (
  tab: MarketDetailsTabKey,
  market: MarketClass,
  refreshKey: number,
  chain: MarketDataChain,
  address?: string,
  resolution?: MarketResolutionController,
) => {
  if (tab === "terms") {
    return market.terms ? (
      <div className="text-sm leading-relaxed text-white/80" dangerouslySetInnerHTML={{ __html: market.terms }} />
    ) : (
      <p className="text-sm text-white/60">No terms provided.</p>
    );
  }

  if (tab === "activity") return <MarketActivity market={market} refreshKey={refreshKey} />;
  if (tab === "positions") return <MarketPositions market={market} chain={chain} address={address} />;
  if (tab === "vault-fees") return <MarketVaultFees market={market} chain={chain} address={address} />;

  if (market.isResolved()) return <MarketResolved market={market} />;
  return resolution ? <MarketResolutionView resolution={resolution} /> : null;
};

const MarketDetailsTabs = ({
  market,
  refreshKey = 0,
  chain,
  address,
  resolution,
}: {
  market: MarketClass;
  refreshKey?: number;
  chain: MarketDataChain;
  address?: string;
  resolution: MarketResolutionController;
}) => {
  const [activeTab, setActiveTab] = useState<MarketDetailsTabKey>("terms");
  const [mobileOpenTab, setMobileOpenTab] = useState<MarketDetailsTabKey>("terms");

  return (
    <div className="rounded-xl border border-white/10 bg-[#070b12]/85 p-3 md:p-4">
      <div className="hidden md:block">
        <div className="mb-3 flex flex-nowrap items-center gap-1.5">
          {MARKET_DETAIL_TABS.map((tab) => (
            <button
              key={tab.key}
              className={cx(
                "whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.06em] leading-none transition-colors",
                activeTab === tab.key
                  ? "border-orange/70 bg-orange/20 text-orange"
                  : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10",
              )}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/35 p-4">
          {renderTabContent(activeTab, market, refreshKey, chain, address, resolution)}
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {MARKET_DETAIL_TABS.map((tab) => {
          const isOpen = mobileOpenTab === tab.key;

          return (
            <div key={tab.key} className="rounded-lg border border-white/10 bg-black/35">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                onClick={() => setMobileOpenTab(tab.key)}
                aria-expanded={isOpen}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">{tab.label}</span>
                <ChevronDown className={cx("h-4 w-4 text-white/60 transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen ? (
                <div className="border-t border-white/10 p-3">
                  {renderTabContent(tab.key, market, refreshKey, chain, address, resolution)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Inner modal content that uses hooks requiring MarketsProviders context
 */
const MarketDetailsModalContent = ({
  initialMarket,
  chain,
  initialOutcomeIndex,
  onClose,
}: {
  initialMarket: MarketClass;
  chain: MarketDataChain;
  initialOutcomeIndex?: number;
  onClose: () => void;
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isTradeSyncing, setIsTradeSyncing] = useState(false);
  const [isResolveActionPending, setIsResolveActionPending] = useState(false);
  const { watchMarket, watchingMarketId, getWatchState } = useMarketWatch();
  const { address } = useAccount();
  const {
    config: { manifest },
  } = useDojoSdk();

  // Fetch fresh market data
  const marketId = useMemo(() => {
    try {
      return initialMarket.market_id ? BigInt(initialMarket.market_id) : 0n;
    } catch {
      return 0n;
    }
  }, [initialMarket.market_id]);
  const { market: fetchedMarket, refresh: refreshMarket, isLoading } = useMarket(marketId);
  const market = fetchedMarket ?? initialMarket;
  const resolutionController = useMarketResolutionController(market);

  const watchState = getWatchState(market);
  const isWatching = watchingMarketId === String(market.market_id);
  const showWatchButton = watchState.status === "ready" || watchState.status === "checking";
  const watchDisabled = watchState.status !== "ready";
  const watchLoading = watchState.status === "checking" || isWatching;

  const { claimableDisplay, hasAnythingToClaim, isRedeeming, redeem } = useMarketRedeem(market, chain);

  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);
  const initialOutcomeAppliedRef = useRef(false);
  const marketSyncSignatureRef = useRef("");
  const tradeSyncRunIdRef = useRef(0);
  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);

  const vaultPositionsAddress = useMemo(() => getContractByName(manifest, "pm", "VaultPositions")?.address, [manifest]);

  const { balances } = useTokens(
    {
      accountAddresses: undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
    },
    false,
  );

  const outcomes = useMemo(() => market.getMarketOutcomes() ?? [], [market]);

  const defaultHighestOutcome = useMemo(() => {
    if (outcomes.length === 0) return undefined;

    return outcomes.reduce<MarketOutcome | undefined>((best, current) => {
      const currentOdds = Number(current.odds);
      const bestOdds = best ? Number(best.odds) : -Infinity;

      if (!Number.isFinite(currentOdds)) return best;
      if (!best || currentOdds > bestOdds) return current;

      return best;
    }, undefined);
  }, [outcomes]);

  useEffect(() => {
    if (selectedOutcome) {
      const updatedOutcome = outcomes.find((outcome) => outcome.index === selectedOutcome.index);
      if (updatedOutcome && updatedOutcome !== selectedOutcome) {
        setSelectedOutcome(updatedOutcome);
      }
      return;
    }

    if (outcomes.length === 0) return;

    if (!initialOutcomeAppliedRef.current && initialOutcomeIndex != null) {
      const initialOutcome = outcomes.find((outcome) => outcome.index === initialOutcomeIndex);
      initialOutcomeAppliedRef.current = true;
      if (initialOutcome) {
        setSelectedOutcome(initialOutcome);
        return;
      }
    }

    if (defaultHighestOutcome) {
      setSelectedOutcome(defaultHighestOutcome);
    }
  }, [defaultHighestOutcome, initialOutcomeIndex, outcomes, selectedOutcome]);

  const handleRefresh = useCallback(async () => {
    await refreshMarket();
    setRefreshKey((prev) => prev + 1);
  }, [refreshMarket]);

  const marketIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.market_id).toString(16)}`);
    } catch {
      return null;
    }
  }, [market.market_id]);

  const { data: allTimeVolumeRaw = 0n } = useQuery({
    queryKey: ["pm", "market", "all-time-volume", chain, marketIdHex],
    enabled: Boolean(marketIdHex),
    queryFn: async () => {
      if (!marketIdHex) return 0n;
      const rows = await getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]).fetchMarketBuyAmountsByMarkets([marketIdHex]);
      return rows.reduce((sum, row) => sum + toBigInt(row.amount_in), 0n);
    },
    staleTime: 30 * 1000,
  });
  const { data: holdersFromBuysCount = 0 } = useQuery({
    queryKey: ["pm", "market", "holders-count", chain, marketIdHex],
    enabled: Boolean(marketIdHex),
    queryFn: async () => {
      if (!marketIdHex) return 0;
      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[chain]).fetchMarketBuyUniqueAccountsCountByMarket(marketIdHex);
    },
    staleTime: 30 * 1000,
  });

  const chainLabel = chain === "mainnet" ? "Mainnet" : "Slot";
  const volumeDisplay = useMemo(
    () => formatCompactAmount(allTimeVolumeRaw, Number(market.collateralToken?.decimals ?? 18)),
    [allTimeVolumeRaw, market.collateralToken?.decimals],
  );
  const liquidityDisplay = useMemo(() => market.getTvl() || "0", [market]);
  const holdersCount = useMemo(() => {
    if (!vaultPositionsAddress || positionIds.length === 0) return holdersFromBuysCount;
    const holders = new Set<string>();

    balances.forEach((balance) => {
      if (BigInt(balance.balance || 0) === 0n) return;
      const isPositionToken = positionIds.some((id) => BigInt(balance.token_id || 0) === id);
      if (!isPositionToken) return;
      holders.add(balance.account_address);
    });

    if (holders.size > 0) return holders.size;
    return holdersFromBuysCount;
  }, [balances, holdersFromBuysCount, positionIds, vaultPositionsAddress]);
  const marketSyncSignature = useMemo(() => {
    const denominatorSignature = toBigInt(market.vaultDenominator?.value ?? 0n).toString();
    const numeratorsSignature = (market.vaultNumerators ?? [])
      .map((entry) => `${entry.index}:${toBigInt(entry.value).toString()}`)
      .join("|");
    return [
      allTimeVolumeRaw.toString(),
      holdersFromBuysCount.toString(),
      denominatorSignature,
      numeratorsSignature,
    ].join("::");
  }, [allTimeVolumeRaw, holdersFromBuysCount, market.vaultDenominator?.value, market.vaultNumerators]);

  useEffect(() => {
    marketSyncSignatureRef.current = marketSyncSignature;
  }, [marketSyncSignature]);

  useEffect(() => {
    return () => {
      tradeSyncRunIdRef.current += 1;
    };
  }, []);

  const handleTradeSuccess = useCallback(() => {
    const baselineSignature = marketSyncSignatureRef.current;
    tradeSyncRunIdRef.current += 1;
    const runId = tradeSyncRunIdRef.current;
    setIsTradeSyncing(true);

    void (async () => {
      try {
        for (let attempt = 0; attempt < TRADE_SYNC_MAX_ATTEMPTS; attempt += 1) {
          if (tradeSyncRunIdRef.current !== runId) return;

          try {
            await handleRefresh();
          } catch (refreshError) {
            console.error("[market-details] Failed to refresh after trade", refreshError);
          }

          if (tradeSyncRunIdRef.current !== runId) return;
          if (marketSyncSignatureRef.current !== baselineSignature) return;

          if (attempt < TRADE_SYNC_MAX_ATTEMPTS - 1) {
            await wait(TRADE_SYNC_INTERVAL_MS);
          }
        }
      } finally {
        if (tradeSyncRunIdRef.current === runId) {
          setIsTradeSyncing(false);
        }
      }
    })();
  }, [handleRefresh]);

  const endLabel = formatTimeLeft(market.end_at ?? null);
  const resolveLabel = formatTimeLeft(market.resolve_at ?? null);

  const showClaimPrimary = market.isResolved();
  const claimDisabled = isRedeeming || !address || !hasAnythingToClaim;
  const resolveOneClickDisabled =
    !resolutionController.canResolve || resolutionController.isSubmittingTx || isTradeSyncing || isResolveActionPending;
  const resolveOneClickIdleLabel = resolutionController.hasFinalRanking ? "Resolve Market" : "Compute + Resolve";
  const resolveOneClickLabel = resolutionController.isResolvingWithCompute
    ? resolutionController.isComputingScores
      ? "Computing..."
      : resolutionController.isResolving
        ? "Resolving..."
        : "Submitting..."
    : isResolveActionPending
      ? "Submitting..."
      : resolveOneClickIdleLabel;
  const resolveOneClickTitle = resolveOneClickDisabled
    ? !resolutionController.canResolve
      ? "Resolution opens after the resolve time."
      : resolutionController.isSubmittingTx
        ? "Submitting transactions..."
        : "Please wait for market sync to finish."
    : resolutionController.hasFinalRanking
      ? "Resolve this market"
      : "Compute scores if needed, then resolve in one click";
  const resolveOneClickAriaLabel = resolutionController.hasFinalRanking
    ? "Resolve market"
    : "Compute scores and resolve market";

  const handleResolveOneClick = useCallback(async () => {
    setIsResolveActionPending(true);
    try {
      const resolved = await resolutionController.onResolveWithCompute();
      if (resolved) {
        await handleRefresh();
      }
    } finally {
      setIsResolveActionPending(false);
    }
  }, [handleRefresh, resolutionController]);

  const handleClaimWinnings = useCallback(async () => {
    await redeem();
    await handleRefresh();
  }, [handleRefresh, redeem]);

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border border-white/10 bg-[#04060b] shadow-2xl md:h-[90vh] md:max-h-[90vh] md:rounded-2xl">
      <div className="border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-cinzel text-xl font-semibold text-gold md:text-2xl">
                {market.title || "Untitled market"}
              </h2>
              <span
                className={cx(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  chainLabel === "Mainnet"
                    ? "border-blue-400/40 bg-blue-500/10 text-blue-300"
                    : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
                )}
              >
                {chainLabel}
              </span>
              <MarketStatusBadge market={market} />
            </div>
            <p className="mt-1 text-sm text-white/70">
              Created by <MaybeController address={market.creator} />
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isTradeSyncing ? (
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200">
                Syncing...
              </span>
            ) : null}
            {!showClaimPrimary ? (
              <button
                type="button"
                onClick={() => void handleResolveOneClick()}
                disabled={resolveOneClickDisabled}
                className={cx(
                  "inline-flex h-9 items-center whitespace-nowrap rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04060b]",
                  resolveOneClickDisabled
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                    : "border-orange/80 bg-orange/20 text-orange shadow-[0_0_16px_rgba(251,146,60,0.22)] hover:border-orange hover:bg-orange/30",
                )}
                title={resolveOneClickTitle}
                aria-label={resolveOneClickAriaLabel}
                aria-busy={resolutionController.isSubmittingTx || isResolveActionPending}
              >
                <span className="inline-flex items-center gap-2">
                  {resolutionController.isSubmittingTx || isResolveActionPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {resolveOneClickLabel}
                </span>
              </button>
            ) : null}
            {showClaimPrimary ? (
              <button
                type="button"
                onClick={() => void handleClaimWinnings()}
                disabled={claimDisabled}
                className={cx(
                  "inline-flex h-9 items-center whitespace-nowrap rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                  claimDisabled
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                    : "border-emerald-400/60 bg-emerald-500/15 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-500/25",
                )}
              >
                {isRedeeming ? "Claiming..." : `Claim ${claimableDisplay}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isLoading || isTradeSyncing}
                className={cx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                  isLoading || isTradeSyncing
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                    : "border-orange/70 bg-orange/15 text-orange hover:border-orange hover:bg-orange/25",
                )}
                title="Refresh market data"
                aria-label="Refresh market data"
              >
                <RefreshCw className={cx("h-4 w-4", (isLoading || isTradeSyncing) && "animate-spin")} />
              </button>
            )}

            {showClaimPrimary ? (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isLoading || isTradeSyncing}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                title="Refresh market data"
                aria-label="Refresh market data"
              >
                <RefreshCw className={cx("h-4 w-4", (isLoading || isTradeSyncing) && "animate-spin")} />
              </button>
            ) : null}

            {showWatchButton ? (
              <button
                type="button"
                onClick={() => void watchMarket(market)}
                disabled={watchDisabled}
                className={cx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                  watchDisabled
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                    : "border-white/15 bg-white/5 text-white/75 hover:border-white/30 hover:bg-white/10",
                )}
                title="Watch game"
                aria-label="Watch game"
              >
                {watchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded-lg border border-orange/40 bg-orange/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-orange/80">All-time Volume</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-orange">
              {volumeDisplay} {market.collateralToken?.symbol || ""}
              <TokenIcon token={market.collateralToken} size={13} />
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Liquidity</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white">
              {liquidityDisplay}
              <TokenIcon token={market.collateralToken} size={13} />
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Holders</p>
            <p className="mt-1 text-sm font-semibold text-white">{holdersCount != null ? holdersCount : "--"}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Trading Ends</p>
            <p className="mt-1 text-sm font-semibold text-white">{endLabel}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Resolves In</p>
            <p className="mt-1 text-sm font-semibold text-white">{resolveLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 py-4 md:px-6 md:py-5 lg:overflow-hidden">
        <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:overflow-hidden">
          <div className="min-h-0 scrollbar-hide lg:h-full lg:flex-1 lg:overflow-y-auto lg:pr-1">
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#070b12]/85 p-3 md:p-4">
                <MarketTimeline market={market} />
              </div>

              <MarketHistory market={market} refreshKey={refreshKey} />

              <section className="rounded-xl border border-white/10 bg-[#070b12]/85 p-3 md:p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                  Outcomes & Odds
                </h3>
                <MarketOdds
                  market={market}
                  selectable
                  selectedOutcomeIndex={selectedOutcome?.index}
                  onSelect={(outcome) => setSelectedOutcome(outcome)}
                  maxVisible={4}
                  collapsible
                />
              </section>

              <MarketDetailsTabs
                market={market}
                refreshKey={refreshKey}
                chain={chain}
                address={address}
                resolution={resolutionController}
              />
            </div>
          </div>

          <div className="min-h-0 scrollbar-hide lg:h-full lg:w-[340px] lg:overflow-y-auto lg:pl-1">
            <div className="flex flex-col gap-4">
              <MarketTrade
                market={market}
                selectedOutcome={selectedOutcome}
                onTradeSuccess={handleTradeSuccess}
                chain={chain}
              />
              <MarketFees market={market} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal wrapper that provides the necessary context providers
 */
export const MarketDetailsModal = ({ market, chain, initialOutcomeIndex, onClose }: MarketDetailsModalProps) => {
  return (
    <MarketsProviders chain={chain}>
      <MarketDetailsModalContent
        initialMarket={market}
        chain={chain}
        initialOutcomeIndex={initialOutcomeIndex}
        onClose={onClose}
      />
    </MarketsProviders>
  );
};
