/**
 * Global MMR leaderboard for the landing page.
 * Uses MMRUpdated raw events from the global Torii SQL endpoint.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { hash } from "starknet";

import { GLOBAL_TORII_BY_CHAIN, MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import { MaybeController } from "@/ui/features/market/landing-markets/maybe-controller";
import type { Chain } from "@contracts";

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 25;
const MMR_DECIMALS = 10n ** 18n;
const MMR_UPDATED_SELECTOR = hash.getSelectorFromName("MMRUpdated").toLowerCase();

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
  const integer = mmr / MMR_DECIMALS;
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

const getGlobalToriiBaseUrl = (chain: Chain): string => {
  if (chain === "mainnet" || chain === "slot") {
    return GLOBAL_TORII_BY_CHAIN[chain];
  }

  return "";
};

const buildContractIdFilterClause = (chain: Chain): string => {
  const mmrToken = MMR_TOKEN_BY_CHAIN[chain];
  if (!mmrToken) return "";
  return `AND lower(id) LIKE '%:${mmrToken.toLowerCase()}:%'`;
};

const buildCommonEventsCte = (chain: Chain) => `
WITH mmr_events AS (
  SELECT
    id,
    executed_at,
    data,
    lower(substr(lower(keys), instr(lower(keys), '/') + 1, instr(substr(lower(keys), instr(lower(keys), '/') + 1), '/') - 1)) AS player_address
  FROM events
  WHERE instr(lower(keys), '/') > 0
    AND ltrim(substr(lower(keys), 1, instr(lower(keys), '/') - 1), '0x') = ltrim('${MMR_UPDATED_SELECTOR}', '0x')
    ${buildContractIdFilterClause(chain)}
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

const buildSearchClause = (searchTerm: string): string => {
  if (!searchTerm) return "";
  const safe = escapeLikeTerm(searchTerm);
  return `WHERE player_address LIKE '%${safe}%' ESCAPE '\\\\'`;
};

const buildPagedLeaderboardQuery = (
  chain: Chain,
  searchTerm: string,
  sortBy: Exclude<SortBy, "delta">,
  page: number,
): string => {
  const offset = (page - 1) * PAGE_SIZE;
  const searchClause = buildSearchClause(searchTerm);

  const orderBy =
    sortBy === "timestamp"
      ? "executed_at DESC, new_mmr_high DESC, new_mmr_low DESC, id DESC"
      : "new_mmr_high DESC, new_mmr_low DESC, event_timestamp DESC, id DESC";

  return `
${buildCommonEventsCte(chain)}
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
${searchClause}
ORDER BY ${orderBy}
LIMIT ${PAGE_SIZE}
OFFSET ${offset};
`;
};

const buildAllRowsForDeltaQuery = (chain: Chain, searchTerm: string): string => {
  const searchClause = buildSearchClause(searchTerm);

  return `
${buildCommonEventsCte(chain)}
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
${searchClause}
ORDER BY executed_at DESC, id DESC;
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

export const MMRLeaderboard = () => {
  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    isLoading: false,
    error: null,
    selectedChain: "slot",
    sortBy: "rank",
    searchInput: "",
    searchTerm: "",
    page: 1,
    totalRows: 0,
    lastSyncAt: null,
  });

  const totalPages = useMemo(() => {
    if (state.totalRows <= 0) return 1;
    return Math.max(1, Math.ceil(state.totalRows / PAGE_SIZE));
  }, [state.totalRows]);

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

  const isEmpty = !state.isLoading && !state.error && state.entries.length === 0;

  return (
    <div className="h-[85vh] w-full space-y-6 overflow-y-auto rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gold">Global MMR Leaderboard</h2>
          <p className="mt-1 text-sm text-gold/60">Derived from MMRUpdated events across the selected chain.</p>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={state.isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:border-gold/50 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gold/60">Chain:</span>
          <div className="flex gap-1">
            {CHAIN_OPTIONS.map((chain) => {
              const isComingSoon = chain === "mainnet";
              const isSelected = state.selectedChain === chain;

              return (
                <button
                  key={chain}
                  type="button"
                  disabled={isComingSoon}
                  onClick={() => setState((prev) => ({ ...prev, selectedChain: chain }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                    isComingSoon
                      ? "cursor-not-allowed text-gold/35"
                      : isSelected
                        ? "bg-gold/20 text-gold"
                        : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                  }`}
                >
                  <span>{chain}</span>
                  {isComingSoon && <span className="ml-2 text-xs normal-case text-gold/45">Coming soon</span>}
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

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </div>
      )}

      {state.isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}

      {isEmpty && <div className="py-16 text-center text-gold/50">No MMR updates found on {state.selectedChain}.</div>}

      {!state.isLoading && state.entries.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gold/10 bg-black/30">
          <div className="max-h-[58vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-gold/10 bg-black/80 backdrop-blur-sm">
                <tr className="text-left text-sm text-gold/60">
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Player</th>
                  <th className="px-6 py-4 text-right font-medium">MMR</th>
                  <th className="px-6 py-4 text-right font-medium">Delta</th>
                  <th className="px-6 py-4 text-right font-medium">Last Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/5">
                {state.entries.map((entry) => (
                  <tr key={`${entry.address}-${entry.eventId}`} className="transition-colors hover:bg-gold/5">
                    <td className="px-6 py-4 text-gold/50">#{entry.rank}</td>
                    <td className="px-6 py-4 font-medium text-gold">
                      <MaybeController address={entry.address} className="font-medium text-gold" />
                    </td>
                    <td className="px-6 py-4 text-right text-gold">{formatMMR(entry.newMmr)}</td>
                    <td
                      className={`px-6 py-4 text-right font-medium ${
                        entry.delta >= 0n ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {formatDelta(entry.delta)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gold/70">
                      {formatEventTimestamp(entry.updatedAtSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
  );
};
