/**
 * Global MMR leaderboard for the landing page.
 * Uses MMRUpdated raw events from the global Torii SQL endpoint.
 */
import { useAccount } from "@starknet-react/core";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hash } from "starknet";

import { GLOBAL_TORII_BY_CHAIN, MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import { getAvatarUrl, normalizeAvatarAddress, useAvatarProfiles } from "@/hooks/use-player-avatar";
import { MMRTierBadge } from "@/ui/shared/components/mmr-tier-badge";
import {
  getMMRTier,
  getMMRTierFromRaw,
  getNextTier,
  getTierProgress,
  MMR_TOKEN_DECIMALS,
  toMmrIntegerFromRaw,
} from "@/ui/utils/mmr-tiers";
import type { MMRTier } from "@/ui/utils/mmr-tiers";
import type { Chain } from "@contracts";

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 50;
const MMR_UPDATED_SELECTOR = hash.getSelectorFromName("MMRUpdated").toLowerCase();
const EVENT_KEY0_EXPR = "ltrim(substr(lower(keys), 1, instr(lower(keys), '/') - 1), '0x')";
const EVENT_PLAYER_EXPR =
  "lower(substr(lower(keys), instr(lower(keys), '/') + 1, instr(substr(lower(keys), instr(lower(keys), '/') + 1), '/') - 1))";
const EVENT_CONTRACT_EXPR =
  "lower(substr(substr(id, instr(id, ':') + 1), instr(substr(id, instr(id, ':') + 1), ':') + 1, instr(substr(substr(id, instr(id, ':') + 1), instr(substr(id, instr(id, ':') + 1), ':') + 1), ':') - 1))";

const SHIMMER_DELTA_THRESHOLD = 100;

type SortBy = "rank" | "timestamp" | "delta";

const CHAIN_OPTIONS: Chain[] = ["mainnet", "slot"];

interface GlobalMMRRow {
  player_address?: string;
  id?: string;
  executed_at?: string;
  old_mmr_low?: string;
  old_mmr_high?: string;
  new_mmr_low?: string;
  new_mmr_high?: string;
  event_timestamp?: string;
  mmr_rank?: string | number;
  total_rows?: string | number;
}

interface GlobalMMREntry {
  rank: number;
  address: string;
  oldMmr: bigint;
  newMmr: bigint;
  delta: bigint;
  absDelta: bigint;
  updatedAtSeconds: number | null;
  eventId: string;
}

interface LeaderboardState {
  entries: GlobalMMREntry[];
  isLoading: boolean;
  error: string | null;
  selectedChain: Chain;
  sortBy: SortBy;
  searchInput: string;
  searchTerm: string;
  page: number;
  totalRows: number;
  lastSyncAt: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Utility helpers                                                            */
/* -------------------------------------------------------------------------- */

const parseMaybeHexToBigInt = (value: unknown): bigint | null => {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
};

const parseMaybeHexToNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const asBigInt = parseMaybeHexToBigInt(value);
  if (asBigInt != null) {
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(asBigInt);
  }

  if (typeof value === "string") {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

const normalizeAddress = (value: unknown): string | null => {
  const asBigInt = parseMaybeHexToBigInt(value);
  if (asBigInt == null) return null;
  return `0x${asBigInt.toString(16)}`;
};

const escapeLikeTerm = (value: string): string =>
  value.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/'/g, "''");

const formatIntegerString = (value: string): string => value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const formatMMR = (mmr: bigint): string => {
  const integer = mmr / MMR_TOKEN_DECIMALS;
  return formatIntegerString(integer.toString());
};

const formatDelta = (delta: bigint): string => {
  const sign = delta >= 0n ? "+" : "-";
  const absolute = delta >= 0n ? delta : -delta;
  return `${sign}${formatMMR(absolute)}`;
};

const formatEventTimestamp = (seconds: number | null): string => {
  if (seconds == null) return "Unknown";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const formatRelativeTime = (seconds: number | null): string => {
  if (seconds == null) return "Unknown";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - seconds;
  if (diff < 0) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatEventTimestamp(seconds);
};

const getGlobalToriiBaseUrl = (chain: Chain): string => {
  if (chain === "mainnet" || chain === "slot") {
    return GLOBAL_TORII_BY_CHAIN[chain];
  }

  return "";
};

const buildContractIdFilterClause = (chain: Chain): string => {
  const mmrToken = MMR_TOKEN_BY_CHAIN[chain];
  if (!mmrToken) return "";
  return `AND ${EVENT_CONTRACT_EXPR} = '${mmrToken.toLowerCase()}'`;
};

const buildPlayerSearchFilterClause = (searchTerm: string): string => {
  if (!searchTerm) return "";
  const safe = escapeLikeTerm(searchTerm);

  if (safe.startsWith("0x")) {
    return `AND ${EVENT_PLAYER_EXPR} LIKE '${safe}%' ESCAPE '\\\\'`;
  }

  return `AND ${EVENT_PLAYER_EXPR} LIKE '%${safe}%' ESCAPE '\\\\'`;
};

const buildCommonEventsCte = (chain: Chain, searchTerm: string) => `
WITH mmr_events AS (
  SELECT
    id,
    executed_at,
    data,
    ${EVENT_PLAYER_EXPR} AS player_address
  FROM events
  WHERE instr(lower(keys), '/') > 0
    AND ${EVENT_KEY0_EXPR} = ltrim('${MMR_UPDATED_SELECTOR}', '0x')
    ${buildContractIdFilterClause(chain)}
    ${buildPlayerSearchFilterClause(searchTerm)}
),
latest_events AS (
  SELECT
    player_address,
    id,
    executed_at,
    data,
    ROW_NUMBER() OVER (
      PARTITION BY player_address
      ORDER BY executed_at DESC, id DESC
    ) AS rn
  FROM mmr_events
),
tokenized_1 AS (
  SELECT
    player_address,
    id,
    executed_at,
    substr(data, 1, instr(data, '/') - 1) AS old_mmr_low,
    substr(data, instr(data, '/') + 1) AS rest_1
  FROM latest_events
  WHERE rn = 1
),
tokenized_2 AS (
  SELECT
    player_address,
    id,
    executed_at,
    old_mmr_low,
    substr(rest_1, 1, instr(rest_1, '/') - 1) AS old_mmr_high,
    substr(rest_1, instr(rest_1, '/') + 1) AS rest_2
  FROM tokenized_1
),
tokenized_3 AS (
  SELECT
    player_address,
    id,
    executed_at,
    old_mmr_low,
    old_mmr_high,
    substr(rest_2, 1, instr(rest_2, '/') - 1) AS new_mmr_low,
    substr(rest_2, instr(rest_2, '/') + 1) AS rest_3
  FROM tokenized_2
),
tokenized_4 AS (
  SELECT
    player_address,
    id,
    executed_at,
    old_mmr_low,
    old_mmr_high,
    new_mmr_low,
    substr(rest_3, 1, instr(rest_3, '/') - 1) AS new_mmr_high,
    substr(rest_3, instr(rest_3, '/') + 1) AS rest_4
  FROM tokenized_3
),
parsed_latest AS (
  SELECT
    player_address,
    id,
    executed_at,
    old_mmr_low,
    old_mmr_high,
    new_mmr_low,
    new_mmr_high,
    substr(rest_4, 1, instr(rest_4, '/') - 1) AS event_timestamp
  FROM tokenized_4
)
`;

const buildPagedLeaderboardQuery = (
  chain: Chain,
  searchTerm: string,
  sortBy: Exclude<SortBy, "delta">,
  page: number,
): string => {
  const offset = (page - 1) * PAGE_SIZE;

  const orderBy =
    sortBy === "timestamp"
      ? "executed_at DESC, new_mmr_high DESC, new_mmr_low DESC, id DESC"
      : "new_mmr_high DESC, new_mmr_low DESC, event_timestamp DESC, id DESC";

  return `
${buildCommonEventsCte(chain, searchTerm)}
SELECT
  player_address,
  id,
  executed_at,
  old_mmr_low,
  old_mmr_high,
  new_mmr_low,
  new_mmr_high,
  event_timestamp,
  ROW_NUMBER() OVER (ORDER BY new_mmr_high DESC, new_mmr_low DESC, event_timestamp DESC, id DESC) AS mmr_rank,
  COUNT(*) OVER () AS total_rows
FROM parsed_latest
ORDER BY ${orderBy}
LIMIT ${PAGE_SIZE}
OFFSET ${offset};
`;
};

const buildAllRowsForDeltaQuery = (chain: Chain, searchTerm: string): string => {
  return `
${buildCommonEventsCte(chain, searchTerm)}
SELECT
  player_address,
  id,
  executed_at,
  old_mmr_low,
  old_mmr_high,
  new_mmr_low,
  new_mmr_high,
  event_timestamp,
  ROW_NUMBER() OVER (ORDER BY new_mmr_high DESC, new_mmr_low DESC, event_timestamp DESC, id DESC) AS mmr_rank
FROM parsed_latest
ORDER BY executed_at DESC, id DESC;
`;
};

/** Query the rank of a specific player address (rank sort only) */
const buildPlayerRankQuery = (chain: Chain, playerAddress: string): string => {
  return `
${buildCommonEventsCte(chain, "")}
, ranked AS (
  SELECT
    player_address,
    ROW_NUMBER() OVER (ORDER BY new_mmr_high DESC, new_mmr_low DESC, event_timestamp DESC, id DESC) AS mmr_rank
  FROM parsed_latest
)
SELECT mmr_rank FROM ranked
WHERE lower(player_address) LIKE '%${playerAddress.replace(/^0x0*/, "").toLowerCase()}%'
LIMIT 1;
`;
};

const fetchSqlRows = async (toriiBaseUrl: string, query: string): Promise<GlobalMMRRow[]> => {
  const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SQL query failed (${response.status})`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Invalid SQL response payload");
  }

  return payload as GlobalMMRRow[];
};

const parseU256 = (low: unknown, high: unknown): bigint => {
  const parsedLow = parseMaybeHexToBigInt(low) ?? 0n;
  const parsedHigh = parseMaybeHexToBigInt(high) ?? 0n;
  return parsedLow + (parsedHigh << 128n);
};

const parseRowToEntry = (row: GlobalMMRRow): GlobalMMREntry | null => {
  const address = normalizeAddress(row.player_address);
  if (!address) return null;

  const oldMmr = parseU256(row.old_mmr_low, row.old_mmr_high);
  const newMmr = parseU256(row.new_mmr_low, row.new_mmr_high);
  const delta = newMmr - oldMmr;
  const rank = parseMaybeHexToNumber(row.mmr_rank) ?? 0;

  const updatedAtSeconds = parseMaybeHexToNumber(row.event_timestamp);

  return {
    rank,
    address,
    oldMmr,
    newMmr,
    delta,
    absDelta: delta >= 0n ? delta : -delta,
    updatedAtSeconds,
    eventId: row.id ?? "",
  };
};

const compareBigIntDescending = (left: bigint, right: bigint): number => {
  if (left === right) return 0;
  return left > right ? -1 : 1;
};

const shortAddr = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/** Fetch controller usernames from the Torii SQL controllers table */
const fetchControllerUsernames = async (
  toriiBaseUrl: string,
  addresses: string[],
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  if (!toriiBaseUrl || addresses.length === 0) return map;

  try {
    const query = `SELECT address, username FROM controllers`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return map;

    const rows = (await response.json()) as Array<{ address?: string; username?: string }>;
    if (!Array.isArray(rows)) return map;

    for (const row of rows) {
      if (!row.address || !row.username) continue;
      const normalized = normalizeAddress(row.address);
      if (normalized) {
        map.set(normalized, row.username);
      }
    }
  } catch {
    // Silently fail — names are non-critical
  }

  return map;
};

/* -------------------------------------------------------------------------- */
/*  Tier color helpers (bg variants for progress bars, badges, etc.)           */
/* -------------------------------------------------------------------------- */

/** Maps tier text-* color class to a bg-compatible color string for inline styles */
const TIER_BG_COLORS: Record<string, string> = {
  "text-relic2": "rgba(192, 132, 245, 0.7)",
  "text-light-red": "rgba(239, 88, 88, 0.7)",
  "text-blueish": "rgba(107, 127, 215, 0.7)",
  "text-brilliance": "rgba(125, 255, 186, 0.7)",
  "text-gold": "rgba(223, 170, 84, 0.7)",
  "text-light-pink": "rgba(202, 177, 166, 0.7)",
  "text-orange": "rgba(251, 146, 60, 0.7)",
  "text-gray-gold": "rgba(119, 103, 86, 0.7)",
};

const getTierBgColor = (tier: MMRTier): string => TIER_BG_COLORS[tier.color] ?? "rgba(223, 170, 84, 0.5)";

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

/** Rank badge with special styling for top-10 */
const RankBadge = ({ rank, tier }: { rank: number; tier: MMRTier }) => {
  if (rank <= 3) {
    const gradients: Record<number, string> = {
      1: "from-yellow-400 via-amber-300 to-yellow-500",
      2: "from-gray-300 via-slate-200 to-gray-400",
      3: "from-amber-600 via-orange-400 to-amber-700",
    };
    return (
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${gradients[rank]} text-sm font-bold text-black shadow-[0_0_12px_rgba(255,215,0,0.4)]`}
      >
        {rank}
      </span>
    );
  }

  if (rank <= 10) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-sm font-semibold text-gold"
        style={{ boxShadow: `0 0 10px ${getTierBgColor(tier)}` }}
      >
        {rank}
      </span>
    );
  }

  return <span className="text-gold/50">#{rank}</span>;
};

/** Animated delta chip */
const DeltaChip = ({ delta }: { delta: bigint }) => {
  const isPositive = delta >= 0n;
  const absDelta = delta >= 0n ? delta : -delta;
  const deltaInteger = Number(absDelta / MMR_TOKEN_DECIMALS);
  const isLarge = deltaInteger >= SHIMMER_DELTA_THRESHOLD;

  const bgClass = isPositive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300";
  const glowClass = isPositive ? "animate-row-glow-up" : "animate-row-glow-down";
  const shimmerClass = isLarge ? "animate-shimmer" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${bgClass} ${glowClass} ${shimmerClass}`}
    >
      <span className="text-xs">{isPositive ? "\u25B2" : "\u25BC"}</span>
      {formatDelta(delta)}
    </span>
  );
};

/** Slim tier progress bar */
const TierProgressBar = ({ mmrRaw }: { mmrRaw: bigint }) => {
  const mmrInteger = toMmrIntegerFromRaw(mmrRaw);
  const currentTier = getMMRTier(mmrInteger);
  const progress = getTierProgress(mmrInteger, currentTier);
  const nextTier = getNextTier(currentTier);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: getTierBgColor(currentTier),
          }}
        />
      </div>
      {nextTier ? (
        <span className="text-[10px] text-gold/40">{nextTier.name}</span>
      ) : (
        <span className="text-[10px] text-relic2/60">Max</span>
      )}
    </div>
  );
};

/** Podium card for top-3 */
const PodiumCard = ({
  entry,
  place,
  avatarUrl,
  tier,
  isCurrentUser,
  displayName,
}: {
  entry: GlobalMMREntry;
  place: 1 | 2 | 3;
  avatarUrl: string;
  tier: MMRTier;
  isCurrentUser: boolean;
  displayName: string;
}) => {
  const placeConfig = {
    1: {
      size: "h-20 w-20",
      ring: "ring-2 ring-yellow-400/60",
      gradient: "from-yellow-400/20 via-amber-300/10 to-transparent",
      label: "1st",
      labelColor: "text-yellow-400",
      order: "order-2",
      scale: "scale-105",
    },
    2: {
      size: "h-16 w-16",
      ring: "ring-2 ring-gray-300/40",
      gradient: "from-gray-300/15 via-slate-200/5 to-transparent",
      label: "2nd",
      labelColor: "text-gray-300",
      order: "order-1",
      scale: "",
    },
    3: {
      size: "h-16 w-16",
      ring: "ring-2 ring-amber-600/40",
      gradient: "from-amber-600/15 via-orange-400/5 to-transparent",
      label: "3rd",
      labelColor: "text-amber-600",
      order: "order-3",
      scale: "",
    },
  };

  const config = placeConfig[place];

  return (
    <div
      className={`flex flex-1 flex-col items-center gap-2 rounded-xl bg-gradient-to-b ${config.gradient} p-4 ${config.order} ${config.scale} ${isCurrentUser ? "ring-1 ring-gold/40" : ""}`}
    >
      <span className={`text-xs font-bold ${config.labelColor}`}>{config.label}</span>
      <img
        src={avatarUrl}
        alt={`${entry.address} avatar`}
        className={`${config.size} rounded-full border-2 border-gold/20 object-cover ${config.ring}`}
        loading="lazy"
      />
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gold">{displayName}</span>
        {isCurrentUser && (
          <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">You</span>
        )}
      </div>
      <MMRTierBadge tier={tier} size="md" />
      <span className="text-lg font-bold text-gold">{formatMMR(entry.newMmr)}</span>
      <DeltaChip delta={entry.delta} />
    </div>
  );
};

/** Expanded row detail panel */
const ExpandedRowDetail = ({ entry }: { entry: GlobalMMREntry }) => {
  const [copied, setCopied] = useState(false);
  const mmrInteger = toMmrIntegerFromRaw(entry.newMmr);
  const currentTier = getMMRTier(mmrInteger);
  const progress = getTierProgress(mmrInteger, currentTier);
  const nextTier = getNextTier(currentTier);

  const handleCopy = () => {
    void navigator.clipboard.writeText(entry.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tr>
      <td colSpan={7} className="px-6 pb-4">
        <div className="overflow-hidden transition-all duration-200">
          <div className="flex flex-wrap gap-6 rounded-lg bg-black/40 px-4 py-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-gold/40">Wallet</span>
              <button
                type="button"
                onClick={handleCopy}
                className="font-mono text-xs text-gold/70 transition hover:text-gold"
                title="Click to copy"
              >
                {copied ? "Copied!" : entry.address}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-gold/40">Tier Progress</span>
              <span className="text-xs text-gold/70">
                {nextTier
                  ? `${currentTier.name} \u2192 ${nextTier.name}: ${Math.round(progress * 100)}% (MMR ${mmrInteger} / ${nextTier.minMMR} needed)`
                  : `${currentTier.name} (Max Tier)`}
              </span>
              <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: getTierBgColor(currentTier),
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-gold/40">MMR Change</span>
              <span className="text-xs text-gold/70">
                {formatMMR(entry.oldMmr)} → {formatMMR(entry.newMmr)} ({formatDelta(entry.delta)})
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-gold/40">Last Update</span>
              <span className="text-xs text-gold/70">{formatRelativeTime(entry.updatedAtSeconds)}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main leaderboard component                                                 */
/* -------------------------------------------------------------------------- */

export const MMRLeaderboard = () => {
  const { address: connectedAddress } = useAccount();

  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    isLoading: false,
    error: null,
    selectedChain: "mainnet",
    sortBy: "rank",
    searchInput: "",
    searchTerm: "",
    page: 1,
    totalRows: 0,
    lastSyncAt: null,
  });

  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
  const [usernameMap, setUsernameMap] = useState<Map<string, string>>(new Map());
  const [findMeLoading, setFindMeLoading] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const currentUserRowRef = useRef<HTMLTableRowElement>(null);
  const pendingScrollToUser = useRef(false);

  const currentUserAddress = useMemo(() => {
    if (!connectedAddress) return null;
    return normalizeAddress(connectedAddress);
  }, [connectedAddress]);

  const totalPages = useMemo(() => {
    if (state.totalRows <= 0) return 1;
    return Math.max(1, Math.ceil(state.totalRows / PAGE_SIZE));
  }, [state.totalRows]);

  const entryAddresses = useMemo(() => state.entries.map((entry) => entry.address), [state.entries]);
  const { data: avatarProfiles } = useAvatarProfiles(entryAddresses);
  const avatarMap = useMemo(() => {
    const map = new Map<string, string>();
    (avatarProfiles ?? []).forEach((profile) => {
      const normalizedAddr = normalizeAvatarAddress(profile.playerAddress);
      if (!normalizedAddr || !profile.avatarUrl) return;
      map.set(normalizedAddr, profile.avatarUrl);
    });
    return map;
  }, [avatarProfiles]);

  // Fetch controller usernames for current entries
  useEffect(() => {
    const toriiBaseUrl = getGlobalToriiBaseUrl(state.selectedChain);
    if (!toriiBaseUrl || state.entries.length === 0) return;

    const addresses = state.entries.map((e) => e.address);
    void fetchControllerUsernames(toriiBaseUrl, addresses).then(setUsernameMap);
  }, [state.entries, state.selectedChain]);

  // Whether to show the podium: only on page 1 with rank sort and no search
  const showPodium = state.sortBy === "rank" && state.page === 1 && !state.searchTerm;

  // Top 3 entries for podium, and remaining entries for the table
  const podiumEntries = useMemo(() => {
    if (!showPodium) return [];
    return state.entries.filter((e) => e.rank >= 1 && e.rank <= 3);
  }, [showPodium, state.entries]);

  const tableEntries = useMemo(() => {
    if (!showPodium) return state.entries;
    return state.entries.filter((e) => e.rank > 3);
  }, [showPodium, state.entries]);

  const isCurrentUserAddress = useCallback(
    (address: string): boolean => {
      if (!currentUserAddress) return false;
      return normalizeAddress(address) === currentUserAddress;
    },
    [currentUserAddress],
  );

  const scrollToCurrentUser = useCallback(() => {
    if (currentUserRowRef.current) {
      currentUserRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // After entries load, check if we have a pending scroll
  useEffect(() => {
    if (pendingScrollToUser.current && !state.isLoading && state.entries.length > 0) {
      pendingScrollToUser.current = false;
      setFindMeLoading(false);
      // Small delay to let the DOM render the rows
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToCurrentUser();
        });
      });
    }
  }, [state.isLoading, state.entries, scrollToCurrentUser]);

  const handleFindMe = useCallback(async () => {
    if (!currentUserAddress) return;

    // If user is already visible on this page, just scroll
    const isOnCurrentPage = state.entries.some((e) => isCurrentUserAddress(e.address));
    if (isOnCurrentPage) {
      scrollToCurrentUser();
      return;
    }

    // Switch to rank sort so the rank-based page calculation works
    const toriiBaseUrl = getGlobalToriiBaseUrl(state.selectedChain);
    if (!toriiBaseUrl) return;

    setFindMeLoading(true);

    try {
      const query = buildPlayerRankQuery(state.selectedChain, currentUserAddress);
      const rows = await fetchSqlRows(toriiBaseUrl, query);
      const rankValue = rows[0]?.mmr_rank;
      const rank = parseMaybeHexToNumber(rankValue);

      if (rank == null || rank <= 0) {
        setFindMeLoading(false);
        return;
      }

      const targetPage = Math.ceil(rank / PAGE_SIZE);

      // Set pending scroll so we scroll after data loads
      pendingScrollToUser.current = true;
      setState((prev) => ({ ...prev, sortBy: "rank", searchInput: "", searchTerm: "", page: targetPage }));
    } catch {
      setFindMeLoading(false);
    }
  }, [currentUserAddress, state.entries, state.selectedChain, isCurrentUserAddress, scrollToCurrentUser]);

  const refreshLeaderboard = useCallback(async () => {
    const toriiBaseUrl = getGlobalToriiBaseUrl(state.selectedChain);
    if (!toriiBaseUrl) {
      setState((prev) => ({
        ...prev,
        entries: [],
        totalRows: 0,
        isLoading: false,
        error: `No global Torii endpoint configured for ${state.selectedChain}`,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (state.sortBy === "delta") {
        const query = buildAllRowsForDeltaQuery(state.selectedChain, state.searchTerm);
        const rows = await fetchSqlRows(toriiBaseUrl, query);

        const parsedEntries = rows.map(parseRowToEntry).filter((entry): entry is GlobalMMREntry => entry != null);

        const sortedByDelta = parsedEntries.toSorted((left, right) => {
          const byDelta = compareBigIntDescending(left.absDelta, right.absDelta);
          if (byDelta !== 0) return byDelta;

          const leftTs = left.updatedAtSeconds ?? 0;
          const rightTs = right.updatedAtSeconds ?? 0;
          if (leftTs !== rightTs) return rightTs - leftTs;

          return left.rank - right.rank;
        });

        const nextTotal = sortedByDelta.length;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));

        if (state.page > nextTotalPages) {
          setState((prev) => ({ ...prev, page: nextTotalPages, isLoading: false }));
          return;
        }

        const offset = (state.page - 1) * PAGE_SIZE;
        const pagedEntries = sortedByDelta.slice(offset, offset + PAGE_SIZE);

        setState((prev) => ({
          ...prev,
          entries: pagedEntries,
          totalRows: nextTotal,
          isLoading: false,
          error: null,
          lastSyncAt: Date.now(),
        }));
        return;
      }

      const query = buildPagedLeaderboardQuery(state.selectedChain, state.searchTerm, state.sortBy, state.page);
      const rows = await fetchSqlRows(toriiBaseUrl, query);

      const parsedEntries = rows.map(parseRowToEntry).filter((entry): entry is GlobalMMREntry => entry != null);
      const parsedTotalRows = rows.length > 0 ? (parseMaybeHexToNumber(rows[0].total_rows) ?? parsedEntries.length) : 0;
      const nextTotalPages = Math.max(1, Math.ceil(parsedTotalRows / PAGE_SIZE));

      if (parsedTotalRows > 0 && state.page > nextTotalPages) {
        setState((prev) => ({ ...prev, page: nextTotalPages, isLoading: false }));
        return;
      }

      setState((prev) => ({
        ...prev,
        entries: parsedEntries,
        totalRows: parsedTotalRows,
        isLoading: false,
        error: null,
        lastSyncAt: Date.now(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load global MMR data";
      setState((prev) => ({
        ...prev,
        entries: [],
        totalRows: 0,
        isLoading: false,
        error: message,
      }));
    }
  }, [state.page, state.searchTerm, state.selectedChain, state.sortBy]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setState((prev) => ({ ...prev, searchTerm: prev.searchInput.trim().toLowerCase() }));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.searchInput]);

  useEffect(() => {
    setState((prev) => ({ ...prev, page: 1 }));
  }, [state.searchTerm, state.selectedChain, state.sortBy]);

  useEffect(() => {
    void refreshLeaderboard();
  }, [refreshLeaderboard]);

  const handleManualRefresh = () => {
    void refreshLeaderboard();
  };

  const handleRowClick = (address: string) => {
    setExpandedAddress((prev) => (prev === address ? null : address));
  };

  const isEmpty = !state.isLoading && !state.error && state.entries.length === 0;

  return (
    <div className="relative h-[92vh] w-full overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl">
      <div className="flex h-full min-w-0 flex-col space-y-6 overflow-y-auto p-8" ref={tableContainerRef}>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gold">Global MMR Leaderboard</h2>
            <p className="mt-1 text-sm text-gold/60">Derived from MMRUpdated events across the selected chain.</p>
          </div>
          <div className="flex items-center gap-2">
            {currentUserAddress && (
              <button
                type="button"
                onClick={() => void handleFindMe()}
                disabled={findMeLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gold/20 bg-gold/5 px-3 py-2 text-sm font-medium text-gold/70 transition hover:border-gold/40 hover:bg-gold/15 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xs">&#9673;</span>
                {findMeLoading ? "Finding..." : "Find Me"}
              </button>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={state.isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:border-gold/50 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state.isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Toolbar: Chain, Sort, Search */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gold/60">Chain:</span>
            <div className="flex gap-1">
              {CHAIN_OPTIONS.map((chain) => {
                const isSelected = state.selectedChain === chain;

                return (
                  <button
                    key={chain}
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, selectedChain: chain }))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                      isSelected ? "bg-gold/20 text-gold" : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                    }`}
                  >
                    <span>{chain}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gold/60">Sort:</span>
            <div className="flex gap-1">
              {(
                [
                  ["rank", "Rank"],
                  ["timestamp", "Last Update"],
                  ["delta", "Biggest Update"],
                ] as const
              ).map(([sortBy, label]) => (
                <button
                  key={sortBy}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, sortBy }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    state.sortBy === sortBy ? "bg-gold/20 text-gold" : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-[260px] flex-1 items-center gap-2">
            <span className="text-sm text-gold/60">Search:</span>
            <input
              type="text"
              value={state.searchInput}
              onChange={(event) => setState((prev) => ({ ...prev, searchInput: event.target.value }))}
              placeholder="0x..."
              className="w-full rounded-lg border border-gold/20 bg-black/40 px-3 py-2 text-sm text-gold placeholder:text-gold/40 focus:border-gold/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Error */}
        {state.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {state.error}
          </div>
        )}

        {/* Loading */}
        {state.isLoading && (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="py-16 text-center text-gold/50">No MMR updates found on {state.selectedChain}.</div>
        )}

        {/* Content */}
        {!state.isLoading && state.entries.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gold/10 bg-black/30">
            <div className="max-h-[70vh] overflow-y-auto">
              {/* Podium for top 3 */}
              {showPodium && podiumEntries.length >= 3 && (
                <div className="border-b border-gold/10 bg-gradient-to-b from-gold/5 to-transparent px-6 py-6">
                  <div className="mx-auto flex max-w-lg items-end justify-center gap-3">
                    {[2, 1, 3].map((place) => {
                      const entry = podiumEntries.find((e) => e.rank === place);
                      if (!entry) return null;
                      const tier = getMMRTierFromRaw(entry.newMmr);
                      const normalizedAddr = normalizeAvatarAddress(entry.address) ?? entry.address;
                      const avatarUrl = getAvatarUrl(normalizedAddr, avatarMap.get(normalizedAddr));
                      return (
                        <PodiumCard
                          key={entry.address}
                          entry={entry}
                          place={place as 1 | 2 | 3}
                          avatarUrl={avatarUrl}
                          tier={tier}
                          isCurrentUser={isCurrentUserAddress(entry.address)}
                          displayName={usernameMap.get(entry.address) ?? shortAddr(entry.address)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Table */}
              <table className="w-full">
                <thead className="sticky top-0 border-b border-gold/10 bg-black/80 backdrop-blur-sm">
                  <tr className="text-left text-sm text-gold/60">
                    <th className="px-6 py-4 font-medium">Rank</th>
                    <th className="px-6 py-4 font-medium">Player</th>
                    <th className="px-6 py-4 text-right font-medium">MMR</th>
                    <th className="px-6 py-4 text-right font-medium">Tier</th>
                    <th className="px-6 py-4 text-right font-medium">Progress</th>
                    <th className="px-6 py-4 text-right font-medium">Delta</th>
                    <th className="px-6 py-4 text-right font-medium">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/5">
                  {tableEntries.map((entry) => {
                    const tier = getMMRTierFromRaw(entry.newMmr);
                    const normalizedAddr = normalizeAvatarAddress(entry.address) ?? entry.address;
                    const avatarUrl = getAvatarUrl(normalizedAddr, avatarMap.get(normalizedAddr));
                    const isUser = isCurrentUserAddress(entry.address);
                    const isExpanded = expandedAddress === entry.address;

                    return (
                      <Fragment key={`${entry.address}-${entry.eventId}`}>
                        <tr
                          ref={isUser ? currentUserRowRef : undefined}
                          onClick={() => handleRowClick(entry.address)}
                          className={`cursor-pointer transition-colors hover:bg-gold/5 ${
                            isUser ? "bg-gold/10 border-l-2 border-gold" : ""
                          } ${isExpanded ? "bg-gold/[0.03]" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <RankBadge rank={entry.rank} tier={tier} />
                          </td>
                          <td className="px-6 py-4 font-medium text-gold">
                            <div className="flex items-center gap-3 rounded-md px-1 py-0.5">
                              <img
                                src={avatarUrl}
                                alt={`${entry.address} avatar`}
                                className="h-8 w-8 rounded-full border border-gold/20 object-cover"
                                loading="lazy"
                              />
                              <span className="font-medium text-gold">{usernameMap.get(entry.address) ?? shortAddr(entry.address)}</span>
                              {isUser && (
                                <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-gold">{formatMMR(entry.newMmr)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end">
                              <MMRTierBadge tier={tier} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end">
                              <TierProgressBar mmrRaw={entry.newMmr} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end">
                              <DeltaChip delta={entry.delta} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gold/70">
                            {formatEventTimestamp(entry.updatedAtSeconds)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <ExpandedRowDetail entry={entry} />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-gold/10 bg-black/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gold/50">
                Showing {(state.page - 1) * PAGE_SIZE + 1}-{Math.min(state.page * PAGE_SIZE, state.totalRows)} of{" "}
                {state.totalRows}
                {state.lastSyncAt ? ` · synced ${new Date(state.lastSyncAt).toLocaleTimeString()}` : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={state.page <= 1}
                  className="rounded-lg border border-gold/20 px-3 py-1.5 text-sm text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="min-w-[92px] text-center text-sm text-gold/70">
                  Page {state.page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                  disabled={state.page >= totalPages}
                  className="rounded-lg border border-gold/20 px-3 py-1.5 text-sm text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
