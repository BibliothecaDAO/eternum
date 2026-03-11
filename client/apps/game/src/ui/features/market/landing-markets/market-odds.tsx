import { MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import {
  getAvatarUrl,
  normalizeAvatarAddress,
  normalizeAvatarUsername,
  useAvatarProfiles,
  useAvatarProfilesByUsernames,
} from "@/hooks/use-player-avatar";
import { MMRTierBadge } from "@/ui/shared/components/mmr-tier-badge";
import { getMMRTierFromRaw, toMmrIntegerFromRaw, type MMRTier } from "@/ui/utils/mmr-tiers";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { hash } from "starknet";

import { MarketClass, MarketOutcome } from "@/pm/class";
import { useOptionalControllers } from "@/pm/hooks/controllers/use-controllers";
import { formatUnits } from "@/pm/utils";
import { MaybeController } from "./maybe-controller";
import { TokenIcon } from "./token-icon";

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
    queryKey: ["market-odds", "players-mmr", normalizedAddresses],
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
            // Best-effort chain fetch.
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

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const formatOdds = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  // Values from MarketClass are already percentages (e.g., 0.95 = 0.95%, 95.23 = 95.23%)
  if (num < 1) return `${num.toFixed(2)}%`; // Show 2 decimals for small percentages
  return `${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
};

const getOddsValue = (outcome: MarketOutcome) => outcome.odds;

const getOutcomes = (market: MarketClass): MarketOutcome[] => {
  const outcomes = market.getMarketOutcomes();
  if (!Array.isArray(outcomes)) return [];
  return outcomes as MarketOutcome[];
};

const parseNumericOdds = (outcome: MarketOutcome) => {
  const oddsValue = getOddsValue(outcome);
  if (oddsValue == null) return null;

  const numericOdds = Number(oddsValue);
  return Number.isFinite(numericOdds) ? numericOdds : null;
};

export const MarketOdds = ({
  market,
  selectable = false,
  onSelect,
  selectedOutcomeIndex,
  maxVisible,
  collapsible = false,
  showPlayerMeta = false,
}: {
  market: MarketClass;
  selectable?: boolean;
  onSelect?: (outcome: MarketOutcome) => void;
  selectedOutcomeIndex?: number;
  maxVisible?: number;
  collapsible?: boolean;
  showPlayerMeta?: boolean;
}) => {
  const outcomes = useMemo(() => getOutcomes(market), [market]);
  const [isExpanded, setIsExpanded] = useState(false);
  const controllers = useOptionalControllers();
  const controllerAddressByUsername = useMemo(() => {
    const map = new Map<string, string>();
    controllers?.controllers?.forEach((controller) => {
      const normalizedUsername = normalizeAvatarUsername(controller.username);
      const normalizedAddress = normalizeAvatarAddress(controller.address);
      if (!normalizedUsername || !normalizedAddress) return;
      map.set(normalizedUsername, normalizedAddress);
    });
    return map;
  }, [controllers?.controllers]);

  const { sortedOutcomes, winningOutcomeOrdersSet } = useMemo(() => {
    const resolvedPayouts = market.isResolved() ? (market.conditionResolution?.payout_numerators ?? []) : [];
    const winningOutcomeOrders = resolvedPayouts
      .map((payout, idx) => (payout != null && Number(payout) > 0 ? idx : null))
      .filter((idx): idx is number => idx !== null);
    const winningSet = new Set(winningOutcomeOrders);

    const baseSorted = outcomes
      .map((outcome, idx) => {
        const normalizedOrder = Number(outcome.index);
        return {
          outcome,
          order: Number.isFinite(normalizedOrder) ? normalizedOrder : idx,
          resolutionIndex: idx,
        };
      })
      .toSorted((a, b) => {
        const aOdds = parseNumericOdds(a.outcome);
        const bOdds = parseNumericOdds(b.outcome);

        if (aOdds == null && bOdds == null) return a.order - b.order;
        if (aOdds == null) return 1;
        if (bOdds == null) return -1;
        if (aOdds === bOdds) return a.order - b.order;
        return bOdds - aOdds;
      });

    const sorted =
      market.isResolved() && winningOutcomeOrders.length > 0
        ? [
            // Move winning outcome(s) to the top once resolution is known.
            ...baseSorted.filter(({ resolutionIndex }) => winningSet.has(resolutionIndex)),
            ...baseSorted.filter(({ resolutionIndex }) => !winningSet.has(resolutionIndex)),
          ]
        : baseSorted;

    return { sortedOutcomes: sorted, winningOutcomeOrdersSet: winningSet };
  }, [outcomes, market]);

  const isSelectable = selectable && !market.isEnded() && !market.isResolved();
  const shouldCollapse =
    collapsible && typeof maxVisible === "number" && maxVisible > 0 && sortedOutcomes.length > maxVisible;
  const visibleOutcomes = shouldCollapse && !isExpanded ? sortedOutcomes.slice(0, maxVisible) : sortedOutcomes;
  const { outcomeAddresses, outcomeUsernames } = useMemo(() => {
    if (!showPlayerMeta) return { outcomeAddresses: [] as string[], outcomeUsernames: [] as string[] };

    const addresses = new Set<string>();
    const usernames = new Set<string>();

    visibleOutcomes.forEach(({ outcome }) => {
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
  }, [showPlayerMeta, visibleOutcomes]);
  const { data: avatarProfilesByAddress = [] } = useAvatarProfiles(outcomeAddresses);
  const { data: avatarProfilesByUsername = [] } = useAvatarProfilesByUsernames(outcomeUsernames);
  const avatarProfileByAddress = useMemo(() => {
    const map = new Map<string, (typeof avatarProfilesByAddress)[number]>();
    avatarProfilesByAddress.forEach((profile) => {
      const normalized = normalizeAvatarAddress(profile.playerAddress);
      if (!normalized) return;
      map.set(normalized, profile);
    });
    return map;
  }, [avatarProfilesByAddress]);
  const avatarProfileByUsername = useMemo(() => {
    const map = new Map<string, (typeof avatarProfilesByUsername)[number]>();
    avatarProfilesByUsername.forEach((profile) => {
      const username = normalizeAvatarUsername(profile.cartridgeUsername ?? null);
      if (!username) return;
      map.set(username, profile);
    });
    return map;
  }, [avatarProfilesByUsername]);
  const playerAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...outcomeAddresses,
            ...outcomeUsernames
              .map((username) => controllerAddressByUsername.get(username) ?? null)
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
    [outcomeAddresses, outcomeUsernames, controllerAddressByUsername, avatarProfilesByAddress, avatarProfilesByUsername],
  );
  const { data: mmrByAddress = {} } = usePlayersMmrSnapshots(playerAddresses);

  if (outcomes.length === 0) {
    return <p className="text-xs text-gold/70">No odds available.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visibleOutcomes.map(({ outcome, order, resolutionIndex }) => {
        const oddsRaw = getOddsValue(outcome);
        const odds = formatOdds(oddsRaw);
        const isSelected = isSelectable && selectedOutcomeIndex === order;
        const isWinner =
          market.isResolved() && winningOutcomeOrdersSet.size > 0 && winningOutcomeOrdersSet.has(resolutionIndex);

        // Get pool amount for this outcome
        const vaultNumerators = market.vaultNumerators ?? [];
        const numeratorEntry = vaultNumerators.find((entry) => Number(entry.index) === order);
        const poolAmountRaw = numeratorEntry?.value ?? 0n;
        const decimals = market.collateralToken?.decimals ?? 18;
        const poolAmount = formatUnits(poolAmountRaw, Number(decimals), 0);

        const rawName = String(outcome.name ?? "");
        const normalizedAddress = showPlayerMeta ? normalizeOutcomeAddress(rawName) : null;
        const normalizedName = showPlayerMeta && !normalizedAddress ? normalizeAvatarUsername(rawName) : null;
        const avatarProfileByResolvedAddress = normalizedAddress ? avatarProfileByAddress.get(normalizedAddress) : null;
        const avatarProfileByResolvedUsername = normalizedName ? avatarProfileByUsername.get(normalizedName) : null;
        const avatarProfile = avatarProfileByResolvedAddress ?? avatarProfileByResolvedUsername;
        const controllerAddress = normalizedName ? controllerAddressByUsername.get(normalizedName) ?? null : null;
        const playerAddress = normalizedAddress ?? normalizeAvatarAddress(avatarProfile?.playerAddress) ?? controllerAddress;
        const avatarSeed = playerAddress ?? normalizedName ?? rawName;
        const avatarUrl = showPlayerMeta ? getAvatarUrl(avatarSeed, avatarProfile?.avatarUrl) : null;
        const mmrSnapshot = showPlayerMeta && playerAddress ? mmrByAddress[playerAddress] : undefined;

        return (
          <button
            key={`${outcome.index}-${resolutionIndex}-${order}`}
            className={cx(
              "group relative flex min-h-[56px] justify-between overflow-hidden rounded-sm border px-3 py-2.5 text-left text-xs transition-all duration-200",
              showPlayerMeta ? "items-start" : "items-center",
              isWinner ? "border-progress-bar-good/55 bg-progress-bar-good/10" : "border-gold/20 bg-brown/40",
              "text-lightest",
              isSelectable ? "cursor-pointer hover:border-gold/50 hover:bg-gold/10" : "cursor-default",
              isSelected ? "border-gold/70 bg-gold/15 ring-1 ring-gold/40" : null,
            )}
            type="button"
            onClick={
              isSelectable && onSelect
                ? () => {
                    onSelect(outcome);
                  }
                : undefined
            }
          >
            {/* Content */}
            <div className="relative flex min-w-0 flex-1 items-start gap-2 overflow-hidden text-lightest">
              {showPlayerMeta && avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${String(outcome.name ?? "Player")} avatar`}
                  className="h-6 w-6 shrink-0 rounded-full border border-gold/20 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <span className="block min-w-0 truncate font-medium">
                  <MaybeController address={outcome.name} />
                </span>
                {showPlayerMeta ? (
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
                ) : null}
              </div>
            </div>

            {/* Pool amount & Odds */}
            <div className={cx("relative flex flex-shrink-0 items-center gap-2 pl-2", showPlayerMeta && "pt-0.5")}>
              {/* Pool amount pill */}
              <div className="flex items-center gap-1 rounded-full bg-brown/60 px-2 py-0.5 backdrop-blur-sm">
                <span className="text-[10px] font-medium tabular-nums text-gold/80">{poolAmount}</span>
                <TokenIcon token={market.collateralToken} size={11} />
              </div>

              {/* Odds badge */}
              <div
                className={cx(
                  "min-w-[48px] rounded px-2 py-1 text-center text-sm font-bold tabular-nums",
                  isWinner
                    ? "border border-progress-bar-good/45 bg-progress-bar-good/15 text-progress-bar-good"
                    : "bg-gold/10 text-gold group-hover:bg-gold/20",
                )}
              >
                {odds ?? "--"}
              </div>
            </div>
          </button>
        );
      })}

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="rounded-md border border-gold/25 bg-brown/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-gold/75 transition-colors hover:border-gold/45 hover:bg-gold/10 hover:text-gold"
        >
          {isExpanded ? "Show Top 4" : `Show All Players (${sortedOutcomes.length})`}
        </button>
      ) : null}
    </div>
  );
};
