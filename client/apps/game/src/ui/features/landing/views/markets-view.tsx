import { MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import {
  getAvatarUrl,
  normalizeAvatarAddress,
  normalizeAvatarUsername,
  useAvatarProfiles,
  useAvatarProfilesByUsernames,
} from "@/hooks/use-player-avatar";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldsAvailability } from "@/hooks/use-world-availability";
import type { MarketClass } from "@/pm/class";
import { useOptionalControllers } from "@/pm/hooks/controllers/use-controllers";
import { getPredictionMarketChain } from "@/pm/prediction-market-config";
import { SwitchNetworkPrompt } from "@/ui/components/switch-network-prompt";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import {
  PM_CONTENT_PANEL_CLASS,
  PM_PAGINATION_BUTTON_CLASS,
  PM_SURFACE_CLASS,
  PM_SURFACE_MUTED_CLASS,
} from "@/ui/features/market/pm-theme";
import { MarketImage } from "@/ui/features/market/landing-markets/market-image";
import { MarketStatusBadge } from "@/ui/features/market/landing-markets/market-status-badge";
import { MMRTierBadge } from "@/ui/shared/components/mmr-tier-badge";
import { getMMRTierFromRaw, toMmrIntegerFromRaw, type MMRTier } from "@/ui/utils/mmr-tiers";
import {
  getChainLabel,
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import {
  marketChainLabels,
  useMultiChainMarketCounts,
  useMultiChainMarkets,
  type EnrichedMarket,
  type MarketChainFilter,
  type MarketStatusKey,
} from "@/ui/features/market/landing-markets/use-multi-chain-markets";
import { MaybeController } from "@/ui/features/market/landing-markets/maybe-controller";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hash } from "starknet";
import { MarketDetailsModal } from "./market-details-modal";

interface MarketsViewProps {
  className?: string;
}

type MarketDataChain = "slot" | "mainnet";
type PlayerMmrSnapshot = { mmrRaw: bigint; mmr: number; tier: MMRTier; chain: MarketDataChain };

const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");
const MMR_RPC_BY_CHAIN: Record<MarketDataChain, string> = {
  mainnet: "https://api.cartridge.gg/x/starknet/mainnet",
  slot: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
};

const normalizeHexAddress = (value: string): string | null => {
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return null;
  }
};

const uniqueNormalizedAddresses = (addresses: string[]): string[] =>
  Array.from(
    new Set(
      addresses.map((address) => normalizeHexAddress(address)).filter((address): address is string => Boolean(address)),
    ),
  );

const normalizeOutcomeAddress = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const isAddressLike = /^0x[0-9a-f]+$/.test(lower) || /^[0-9]+$/.test(lower) || /^[0-9a-f]{40,}$/.test(lower);
  if (!isAddressLike) return null;

  const normalized = normalizeAvatarAddress(lower);
  return normalized && normalized.startsWith("0x") ? normalized : null;
};

const usePlayersMmrSnapshots = (addresses: string[]) => {
  const normalizedAddresses = useMemo(() => uniqueNormalizedAddresses(addresses), [addresses]);

  return useQuery({
    queryKey: ["markets-view", "players-mmr", normalizedAddresses],
    queryFn: async (): Promise<Record<string, PlayerMmrSnapshot>> => {
      if (normalizedAddresses.length === 0) {
        return {};
      }

      const records: Record<string, PlayerMmrSnapshot> = {};
      const mmrChains: MarketDataChain[] = ["mainnet", "slot"];

      await Promise.all(
        mmrChains.map(async (chain) => {
          const tokenAddress = MMR_TOKEN_BY_CHAIN[chain];
          const rpcUrl = MMR_RPC_BY_CHAIN[chain];
          if (!tokenAddress || !rpcUrl) return;

          const payload = normalizedAddresses.map((address, index) => ({
            jsonrpc: "2.0",
            id: index,
            method: "starknet_call",
            params: [
              {
                contract_address: tokenAddress,
                entry_point_selector: GET_PLAYER_MMR_SELECTOR,
                calldata: [address],
              },
              "pre_confirmed",
            ],
          }));

          try {
            const response = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!response.ok) return;
            const raw = (await response.json()) as Array<{
              id: number;
              error?: unknown;
              result?: [string, string] | string[];
            }>;

            raw.forEach((entry) => {
              if (entry?.error || !Array.isArray(entry?.result)) return;
              const address = normalizedAddresses[entry.id];
              if (!address) return;

              try {
                const low = BigInt(entry.result[0] ?? "0");
                const high = BigInt(entry.result[1] ?? "0");
                const mmrRaw = low + (high << 128n);
                const existing = records[address];

                if (existing && existing.mmrRaw >= mmrRaw) return;

                records[address] = {
                  mmrRaw,
                  mmr: toMmrIntegerFromRaw(mmrRaw),
                  tier: getMMRTierFromRaw(mmrRaw),
                  chain,
                };
              } catch {
                // Ignore malformed entries.
              }
            });
          } catch {
            // Best-effort chain fetch. If one chain fails we keep the other.
          }
        }),
      );

      return records;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
};

const STATUS_OPTIONS: Array<{
  key: MarketStatusKey;
  label: string;
}> = [
  { key: "live", label: "Live" },
  { key: "awaiting", label: "Awaiting" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const CHAIN_OPTIONS: Array<{ key: MarketChainFilter; label: string }> = [
  { key: "all", label: "All Chains" },
  { key: "slot", label: "Slot" },
  { key: "mainnet", label: "Mainnet" },
];

const getStatusFromParam = (value: string | null): MarketStatusKey => {
  if (value === "live" || value === "awaiting" || value === "resolved") {
    return value;
  }

  return "all";
};

const getChainFromParam = (value: string | null): MarketChainFilter => {
  if (value === "slot" || value === "mainnet") return value;
  return "all";
};

const PAGE_SIZE = 9;
const INITIAL_MARKETS_SKELETON_COUNT = 6;

const formatOddsPercentage = (raw: string | number) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return "--";
  if (value < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
};

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

const shortMarketId = (id: string) => {
  try {
    const hex = `0x${BigInt(id).toString(16)}`;
    if (hex.length <= 12) return hex;
    return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
  } catch {
    return id;
  }
};

const MarketTerminalCard = ({
  item,
  onOpen,
  onSwitchNetwork,
  canTrade,
}: {
  item: EnrichedMarket;
  onOpen: (market: MarketClass, chain: MarketDataChain) => void;
  onSwitchNetwork: (chain: MarketDataChain) => void;
  canTrade: boolean;
}) => {
  const { outcomes, winningOutcomeOrdersSet } = useMemo(() => {
    const rows = item.market.getMarketOutcomes() ?? [];
    const resolvedPayouts = item.market.isResolved() ? (item.market.conditionResolution?.payout_numerators ?? []) : [];
    const winningOutcomeOrders = resolvedPayouts
      .map((payout, idx) => (payout != null && Number(payout) > 0 ? idx : null))
      .filter((idx): idx is number => idx !== null);
    const winningSet = new Set(winningOutcomeOrders);

    const sorted = rows
      .map((outcome, arrayIndex) => ({
        ...outcome,
        oddsNumeric: Number(outcome.odds),
        resolutionIndex: arrayIndex,
      }))
      .toSorted((a, b) => {
        if (!Number.isFinite(a.oddsNumeric) && !Number.isFinite(b.oddsNumeric)) return a.index - b.index;
        if (!Number.isFinite(a.oddsNumeric)) return 1;
        if (!Number.isFinite(b.oddsNumeric)) return -1;
        if (a.oddsNumeric === b.oddsNumeric) return a.index - b.index;
        return b.oddsNumeric - a.oddsNumeric;
      });

    const ordered =
      item.market.isResolved() && winningSet.size > 0
        ? [
            ...sorted.filter((entry) => winningSet.has(entry.resolutionIndex)),
            ...sorted.filter((entry) => !winningSet.has(entry.resolutionIndex)),
          ]
        : sorted;

    return { outcomes: ordered, winningOutcomeOrdersSet: winningSet };
  }, [item.market]);
  const controllers = useOptionalControllers();
  const findControllerAddressByUsername = controllers?.findControllerAddressByUsername;

  const visibleOutcomes = outcomes.slice(0, 3);
  const hiddenCount = Math.max(0, outcomes.length - visibleOutcomes.length);
  const { outcomeAddresses, outcomeUsernames } = useMemo(() => {
    const addresses = new Set<string>();
    const usernames = new Set<string>();

    visibleOutcomes.forEach((outcome) => {
      const rawName = String(outcome.name ?? "");
      const normalizedAddress = normalizeOutcomeAddress(rawName);
      if (normalizedAddress) {
        addresses.add(normalizedAddress);
        return;
      }

      const normalizedUsername = normalizeAvatarUsername(rawName);
      if (normalizedUsername) usernames.add(normalizedUsername);
    });

    return {
      outcomeAddresses: Array.from(addresses),
      outcomeUsernames: Array.from(usernames),
    };
  }, [visibleOutcomes]);
  const { data: avatarProfilesByAddress = [] } = useAvatarProfiles(outcomeAddresses);
  const { data: avatarProfilesByUsername = [] } = useAvatarProfilesByUsernames(outcomeUsernames);
  const avatarProfileByAddress = useMemo(() => {
    const profileMap = new Map<string, (typeof avatarProfilesByAddress)[number]>();
    avatarProfilesByAddress.forEach((profile) => {
      const normalizedAddress = normalizeAvatarAddress(profile.playerAddress);
      if (!normalizedAddress) return;
      profileMap.set(normalizedAddress, profile);
    });
    return profileMap;
  }, [avatarProfilesByAddress]);
  const avatarProfileByUsername = useMemo(() => {
    const profileMap = new Map<string, (typeof avatarProfilesByUsername)[number]>();
    avatarProfilesByUsername.forEach((profile) => {
      const username = normalizeAvatarUsername(profile.cartridgeUsername ?? null);
      if (!username) return;
      profileMap.set(username, profile);
    });
    return profileMap;
  }, [avatarProfilesByUsername]);
  const playerAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...outcomeAddresses,
            ...outcomeUsernames
              .map((username) => findControllerAddressByUsername?.(username) ?? null)
              .filter((address): address is string => Boolean(address)),
            ...avatarProfilesByAddress
              .map((profile) => normalizeAvatarAddress(profile.playerAddress))
              .filter((address): address is string => Boolean(address)),
            ...avatarProfilesByUsername
              .map((profile) => normalizeAvatarAddress(profile.playerAddress))
              .filter((address): address is string => Boolean(address)),
          ].filter((address): address is string => Boolean(address)),
        ),
      ),
    [
      outcomeAddresses,
      outcomeUsernames,
      findControllerAddressByUsername,
      avatarProfilesByAddress,
      avatarProfilesByUsername,
    ],
  );
  const { data: mmrByAddress = {} } = usePlayersMmrSnapshots(playerAddresses);
  const chainLabel = marketChainLabels[item.chain];
  const endLabel = formatTimeLeft(item.market.end_at ?? null);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gold/15 bg-black/40 p-4 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.95)] backdrop-blur-[2px] transition-all duration-200 hover:border-gold/45 hover:bg-black/50 hover:shadow-[0_18px_42px_-22px_rgba(223,170,84,0.22)]">
      <div className="flex items-start gap-3">
        <MarketImage
          market={item.market}
          className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-gold/20"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                item.chain === "mainnet"
                  ? "border-gold/35 bg-gold/10 text-gold/90"
                  : "border-brilliance/45 bg-brilliance/10 text-brilliance/95",
              )}
            >
              {chainLabel}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-gold/40">
              {shortMarketId(item.market.market_id)}
            </span>
          </div>
          <h3 className="line-clamp-2 font-cinzel text-sm font-semibold leading-snug text-gold">
            {item.market.title || "Untitled market"}
          </h3>
        </div>
        <MarketStatusBadge market={item.market} />
      </div>

      <div className="mt-4 flex-1 rounded-lg border border-gold/15 bg-black/45 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.12em] text-gold/50">Top Outcomes</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-gold/40">Percent</p>
        </div>
        <div className="space-y-2">
          {visibleOutcomes.map((outcome) => {
            const isWinner =
              item.market.isResolved() &&
              winningOutcomeOrdersSet.size > 0 &&
              winningOutcomeOrdersSet.has(outcome.resolutionIndex);
            const rawName = String(outcome.name ?? "");
            const normalizedAddress = normalizeOutcomeAddress(rawName);
            const normalizedName = normalizedAddress ? null : normalizeAvatarUsername(rawName);
            const avatarProfileByResolvedAddress = normalizedAddress
              ? avatarProfileByAddress.get(normalizedAddress)
              : null;
            const avatarProfileByResolvedUsername = normalizedName ? avatarProfileByUsername.get(normalizedName) : null;
            const avatarProfile = avatarProfileByResolvedAddress ?? avatarProfileByResolvedUsername;
            const controllerAddress = normalizedName
              ? (findControllerAddressByUsername?.(normalizedName) ?? null)
              : null;
            const playerAddress =
              normalizedAddress ?? normalizeAvatarAddress(avatarProfile?.playerAddress) ?? controllerAddress;
            const avatarSeed = playerAddress ?? normalizedName ?? rawName;
            const avatarUrl = getAvatarUrl(avatarSeed, avatarProfile?.avatarUrl);
            const mmrSnapshot = playerAddress ? mmrByAddress[playerAddress] : undefined;

            return (
              <div
                key={`${item.key}-${outcome.index}`}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-md border px-2 py-1.5",
                  isWinner ? "border-progress-bar-good/45 bg-progress-bar-good/10" : "border-gold/15 bg-black/20",
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <img
                    src={avatarUrl}
                    alt={`${String(outcome.name ?? "Player")} avatar`}
                    className="h-6 w-6 shrink-0 rounded-full border border-gold/20 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-lightest">
                      <MaybeController address={outcome.name} showAddress={false} />
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-gold/70">
                        <img src="/tokens/lords.png" alt="LORDS" className="h-3 w-3 rounded-full object-contain" />
                        <span>{mmrSnapshot ? `${mmrSnapshot.mmr.toLocaleString()} MMR` : "MMR --"}</span>
                      </span>
                      {isWinner ? (
                        <span className="rounded border border-progress-bar-good/50 bg-progress-bar-good/10 px-1.5 py-0.5 text-[10px] font-semibold text-progress-bar-good">
                          Winner
                        </span>
                      ) : null}
                      {mmrSnapshot ? <MMRTierBadge tier={mmrSnapshot.tier} /> : null}
                    </div>
                  </div>
                </div>
                <p
                  className={cn(
                    "rounded border px-2 py-0.5 text-xs font-semibold",
                    isWinner
                      ? "border-progress-bar-good/45 bg-progress-bar-good/15 text-progress-bar-good"
                      : "border-gold/30 bg-gold/10 text-gold",
                  )}
                >
                  {formatOddsPercentage(outcome.odds)}
                </p>
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 ? (
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-gold/45">+{hiddenCount} more outcomes</p>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-gold/25 bg-gold/10 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-gold/75">All-time Volume</p>
          <p className="mt-1 inline-flex items-center gap-1 text-base font-semibold text-gold">
            <img src="/tokens/lords.png" alt="LORDS" className="h-4 w-4 rounded-full object-contain" />
            <span>{item.volumeDisplay}</span>
          </p>
        </div>
        <div className="rounded-lg border border-gold/20 bg-black/40 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-gold/45">Trading Ends</p>
          <p className="mt-1 text-sm font-semibold text-gold/85">{endLabel}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (canTrade) {
            onOpen(item.market, item.chain);
            return;
          }
          onSwitchNetwork(item.chain);
        }}
        className={cn(
          "mt-3 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
          canTrade
            ? "border-gold/60 bg-gold/20 text-gold hover:border-gold hover:bg-gold/30"
            : "border-brilliance/45 bg-brilliance/10 text-brilliance hover:border-brilliance/70 hover:bg-brilliance/15",
        )}
      >
        {canTrade ? "Open Market" : `Switch To ${chainLabel}`}
      </button>
    </article>
  );
};

const MarketTerminalSkeletonCard = () => (
  <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-gold/15 bg-black/40 p-4">
    <div className="flex items-start gap-3">
      <div className="h-12 w-12 animate-pulse rounded-lg border border-gold/20 bg-gold/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-gold/10" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gold/10" />
      </div>
      <div className="h-6 w-16 animate-pulse rounded-full border border-gold/20 bg-gold/10" />
    </div>

    <div className="mt-4 flex-1 rounded-lg border border-gold/15 bg-black/45 p-3">
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 rounded-md border border-gold/15 bg-black/20 p-2"
          >
            <div className="h-3 w-1/2 animate-pulse rounded bg-gold/10" />
            <div className="h-4 w-10 animate-pulse rounded bg-gold/10" />
          </div>
        ))}
      </div>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="h-14 animate-pulse rounded-lg border border-gold/25 bg-gold/10" />
      <div className="h-14 animate-pulse rounded-lg border border-gold/20 bg-black/40" />
    </div>

    <div className="mt-3 h-9 animate-pulse rounded-lg border border-gold/30 bg-gold/10" />
  </article>
);

/**
 * Unified prediction markets view with in-page status filters.
 */
const MarketsViewContent = ({ className }: MarketsViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toggleModal = useUIStore((state) => state.toggleModal);
  const { chainId, connector } = useAccount();
  const runtimeChain = getPredictionMarketChain();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller;
  const connectedTxChain = resolveConnectedTxChainFromRuntime({ chainId, controller });
  const activeTradingChain: MarketDataChain =
    connectedTxChain === "mainnet" || connectedTxChain === "slot" ? connectedTxChain : runtimeChain;
  const [switchTargetChain, setSwitchTargetChain] = useState<MarketDataChain | null>(null);

  const selectedStatus = getStatusFromParam(searchParams.get("status"));
  const selectedChain = getChainFromParam(searchParams.get("chain"));
  const filterKey = `${selectedStatus}|${selectedChain}`;

  const [pagesByFilter, setPagesByFilter] = useState<Record<string, number>>({});
  const currentPage = pagesByFilter[filterKey] ?? 1;
  const offset = (currentPage - 1) * PAGE_SIZE;
  const { worlds: factoryWorlds } = useFactoryWorlds(["mainnet", "slot"]);
  const { results: worldAvailabilityByKey } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0);
  const blockedDevModeOracleAddresses = useMemo(() => {
    const blockedAddresses = new Set<string>();

    worldAvailabilityByKey.forEach((availability) => {
      if (!availability.meta?.devModeOn) return;

      const prizeDistributionAddress = normalizeHexAddress(availability.meta.prizeDistributionAddress ?? "");
      if (prizeDistributionAddress) {
        blockedAddresses.add(prizeDistributionAddress);
      }
    });

    return Array.from(blockedAddresses);
  }, [worldAvailabilityByKey]);

  const { counts, isLoading: isCountsLoading, isFetching: isCountsFetching } = useMultiChainMarketCounts(selectedChain);
  const hasLiveMarkets = counts.live > 0;

  const { markets, totalCount, isLoading, isFetching, isError, sourceStatus, refresh } = useMultiChainMarkets({
    status: selectedStatus,
    chainFilter: selectedChain,
    limit: PAGE_SIZE,
    offset,
    blockedOracleAddresses: blockedDevModeOracleAddresses,
  });

  const handleCardClick = useCallback(
    (market: MarketClass, chain: MarketDataChain) => {
      if (chain !== activeTradingChain) return;
      toggleModal(<MarketDetailsModal market={market} chain={chain} onClose={() => toggleModal(null)} />);
    },
    [activeTradingChain, toggleModal],
  );

  const handleOpenSwitchNetworkPrompt = useCallback((chain: MarketDataChain) => {
    setSwitchTargetChain(chain);
  }, []);

  const handleSwitchNetwork = useCallback(async () => {
    if (!switchTargetChain) return;
    const switched = await switchWalletToChain({
      controller,
      targetChain: switchTargetChain,
    });
    if (switched) {
      setSwitchTargetChain(null);
    }
  }, [controller, switchTargetChain]);

  const handleStatusChange = useCallback(
    (nextStatus: MarketStatusKey) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (nextStatus === "all") next.delete("status");
        else next.set("status", nextStatus);
        return next;
      });
      setPagesByFilter((previous) => ({ ...previous, [`${nextStatus}|${selectedChain}`]: 1 }));
    },
    [selectedChain, setSearchParams],
  );

  const handleChainChange = useCallback(
    (nextChain: MarketChainFilter) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (nextChain === "all") next.delete("chain");
        else next.set("chain", nextChain);
        return next;
      });
      setPagesByFilter((previous) => ({ ...previous, [`${selectedStatus}|${nextChain}`]: 1 }));
    },
    [selectedStatus, setSearchParams],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount > 0 ? offset + 1 : 0;
  const endIndex = Math.min(offset + markets.length, totalCount);
  const isInitialLoad = (isLoading || isFetching) && markets.length === 0;

  const sourceWarnings = useMemo(() => {
    const selected = selectedChain === "all" ? (["slot", "mainnet"] as MarketDataChain[]) : [selectedChain];
    return selected
      .filter((chain) => !sourceStatus[chain]?.ok)
      .map((chain) => {
        const message = sourceStatus[chain]?.error ?? "Unavailable";
        return `${marketChainLabels[chain]} source unavailable (${message})`;
      });
  }, [selectedChain, sourceStatus]);

  const emptyState = useMemo(() => {
    if (selectedStatus === "live") {
      return {
        title: "No live markets available.",
        description: "Try Awaiting or Resolved markets.",
        actionLabel: "View All Markets",
        onAction: () => handleStatusChange("all"),
      };
    }

    if (selectedStatus === "awaiting") {
      return {
        title: "No markets are awaiting resolution.",
        description: "Try Live or Resolved markets.",
        actionLabel: "View Live Markets",
        onAction: () => handleStatusChange("live"),
      };
    }

    if (selectedStatus === "resolved") {
      return {
        title: "No resolved markets available.",
        description: "Try Live or Awaiting Resolution markets.",
        actionLabel: "View Live Markets",
        onAction: () => handleStatusChange("live"),
      };
    }

    return {
      title: "No markets available.",
      description: "Check back soon for new prediction markets.",
    };
  }, [selectedStatus, handleStatusChange]);

  return (
    <div className={cn("flex h-full flex-col gap-5", className)}>
      <div className="space-y-3">
        <h2 className="font-cinzel text-xl font-semibold text-gold md:text-2xl">Prediction Markets</h2>
        <p className="text-sm text-gold/70">Track live odds and all-time volume across Slot and Mainnet markets.</p>
      </div>

      <div
        className={cn(
          PM_SURFACE_CLASS,
          "flex flex-wrap items-center justify-between gap-3 border-gold/15 bg-black/35 p-3",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = selectedStatus === option.key;
            const isLiveOption = option.key === "live";
            const showLiveGlow = isLiveOption && hasLiveMarkets;
            const isCountLoading = isCountsLoading || isCountsFetching;
            const countLabel = isCountLoading ? "..." : counts[option.key].toString();

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleStatusChange(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                  showLiveGlow &&
                    (isActive
                      ? "border-brilliance/80 bg-brilliance/20 text-brilliance shadow-[0_0_20px_rgba(125,255,186,0.25)]"
                      : "border-brilliance/45 bg-brilliance/10 text-brilliance/90 hover:border-brilliance/70 hover:bg-brilliance/15"),
                  !showLiveGlow &&
                    (isActive
                      ? "border-gold/80 bg-gold/20 text-gold"
                      : "border-gold/25 bg-black/40 text-gold/75 hover:border-gold/45 hover:bg-gold/10"),
                )}
              >
                {option.label} ({countLabel})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CHAIN_OPTIONS.map((option) => {
            const isActive = selectedChain === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleChainChange(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                  isActive
                    ? "border-gold/70 bg-gold/15 text-gold"
                    : "border-gold/25 bg-black/40 text-gold/75 hover:border-gold/45 hover:bg-gold/10",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          PM_SURFACE_MUTED_CLASS,
          "flex flex-wrap items-center justify-between gap-3 border-gold/15 bg-black/30 px-4 py-3 text-xs uppercase tracking-[0.12em] text-gold/70",
        )}
      >
        <span>{totalCount > 0 ? `Showing ${startIndex}-${endIndex} of ${totalCount}` : "No markets found"}</span>
        <div className="flex items-center gap-3">
          <span>Sort: Live First • Newest</span>
          {isFetching ? <span className="text-gold/45">Refreshing…</span> : null}
          <RefreshButton aria-label="Refresh markets" isLoading={isFetching || isLoading} onClick={refresh} />
        </div>
      </div>

      {sourceWarnings.length > 0 ? (
        <div className="rounded-xl border border-brilliance/45 bg-brilliance/10 px-3 py-2 text-xs text-brilliance">
          {sourceWarnings.join(" • ")}
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          Failed to load market sources. Try refreshing.
        </div>
      ) : null}

      <div
        className={cn(
          PM_CONTENT_PANEL_CLASS,
          "max-h-[calc(100vh-260px)] flex-1 overflow-y-auto border-gold/15 bg-black/25 p-4 md:p-5",
        )}
      >
        {isInitialLoad ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gold/20 bg-black/35 px-3 py-2 text-xs uppercase tracking-[0.12em] text-gold/65">
              Loading live markets...
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: INITIAL_MARKETS_SKELETON_COUNT }).map((_, index) => (
                <MarketTerminalSkeletonCard key={`market-skeleton-${index}`} />
              ))}
            </div>
          </div>
        ) : markets.length === 0 && !isFetching ? (
          <div className="rounded-2xl border border-gold/20 bg-black/35 p-6 text-center">
            <p className="font-cinzel text-lg text-gold">{emptyState.title}</p>
            {emptyState.description ? <p className="mt-2 text-sm text-gold/70">{emptyState.description}</p> : null}
            {emptyState.actionLabel && emptyState.onAction ? (
              <button
                type="button"
                onClick={emptyState.onAction}
                className="mt-4 rounded-lg border border-gold/65 bg-gold/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:bg-gold/25"
              >
                {emptyState.actionLabel}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {markets.map((item) => (
              <MarketTerminalCard
                key={item.key}
                item={item}
                onOpen={handleCardClick}
                onSwitchNetwork={handleOpenSwitchNetworkPrompt}
                canTrade={item.chain === activeTradingChain}
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 py-1">
          <button
            type="button"
            onClick={() =>
              setPagesByFilter((prev) => ({
                ...prev,
                [filterKey]: Math.max(1, (prev[filterKey] ?? 1) - 1),
              }))
            }
            disabled={currentPage === 1 || isFetching}
            className={PM_PAGINATION_BUTTON_CLASS}
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="text-xs uppercase tracking-[0.12em] text-gold/60">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPagesByFilter((prev) => ({
                ...prev,
                [filterKey]: Math.min(totalPages, (prev[filterKey] ?? 1) + 1),
              }))
            }
            disabled={currentPage === totalPages || isFetching}
            className={PM_PAGINATION_BUTTON_CLASS}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      ) : null}
      <SwitchNetworkPrompt
        open={switchTargetChain !== null}
        description="This market is on a different chain than your current trading session."
        hint={
          switchTargetChain
            ? `Switch your wallet to ${getChainLabel(switchTargetChain)} to continue.`
            : "Switch network to continue."
        }
        switchLabel={switchTargetChain ? `Switch To ${getChainLabel(switchTargetChain)}` : "Switch Network"}
        onClose={() => setSwitchTargetChain(null)}
        onSwitch={handleSwitchNetwork}
      />
    </div>
  );
};

export const MarketsView = ({ className }: MarketsViewProps) => (
  <MarketsProviders>
    <MarketsViewContent className={className} />
  </MarketsProviders>
);
