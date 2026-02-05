/**
 * Score to Beat panel for the landing page.
 * Shows the combined best scores across multiple Blitz games.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Download from "lucide-react/dist/esm/icons/download";

import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { displayAddress } from "@/ui/utils/utils";
import type { Chain } from "@contracts";

import { useScoreToBeat } from "@/ui/features/landing/lib/use-score-to-beat";

const MAX_GAMES = 10;
const DEFAULT_RUNS_TO_AGGREGATE = 3;
const RUNS_TO_AGGREGATE_OPTIONS = [2, 3, 4] as const;
const CHAIN_OPTIONS: Chain[] = ["mainnet", "slot"];

const SCORE_TO_BEAT_GAMES_STORAGE_KEY = "landing-score-to-beat-games-v2";
const SCORE_TO_BEAT_RUNS_STORAGE_KEY = "landing-score-to-beat-runs-v2";
const SCORE_TO_BEAT_CHAIN_STORAGE_KEY = "landing-score-to-beat-chain-v2";

const formatPoints = (points: number) =>
  Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(points ?? 0);

const getRelativeTimeLabel = (timestamp: number | null, fallback: string) => {
  if (!timestamp) {
    return fallback;
  }

  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const secondsAgo = Math.round((Date.now() - timestamp) / 1000);

  if (Math.abs(secondsAgo) < 60) {
    return relative.format(-secondsAgo, "second");
  }

  const minutesAgo = Math.round(secondsAgo / 60);
  return relative.format(-minutesAgo, "minute");
};

const describeEndpoint = (endpoint: string) => {
  if (!endpoint) return "";
  const trimmed = endpoint.replace(/\/?sql$/i, "");
  try {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(/\/x\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return trimmed;
  }
};

const buildToriiSqlUrl = (gameName: string) => `https://api.cartridge.gg/x/${gameName}/torii/sql`;

const loadStoredSelectedGames = (): string[] | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SCORE_TO_BEAT_GAMES_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Ignore malformed data
  }
  return null;
};

const loadStoredChain = (): Chain | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SCORE_TO_BEAT_CHAIN_STORAGE_KEY);
  if (stored && CHAIN_OPTIONS.includes(stored as Chain)) {
    return stored as Chain;
  }
  return null;
};

const loadStoredRunsToAggregate = (): number | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SCORE_TO_BEAT_RUNS_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = parseInt(stored, 10);
    if (RUNS_TO_AGGREGATE_OPTIONS.includes(parsed as (typeof RUNS_TO_AGGREGATE_OPTIONS)[number])) {
      return parsed;
    }
  } catch {
    // Ignore malformed data
  }
  return null;
};

const getRunsLabel = (count: number): string => {
  switch (count) {
    case 1:
      return "single-run";
    case 2:
      return "two-run";
    case 3:
      return "three-run";
    case 4:
      return "four-run";
    default:
      return `${count}-run`;
  }
};

const getBestRunsLabel = (count: number): string => {
  switch (count) {
    case 1:
      return "Best run";
    case 2:
      return "Best two runs";
    case 3:
      return "Best three runs";
    case 4:
      return "Best four runs";
    default:
      return `Best ${count} runs`;
  }
};

export const ScoreToBeatPanel = () => {
  const [selectedChain, setSelectedChain] = useState<Chain>("mainnet");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [runsToAggregate, setRunsToAggregate] = useState<number>(DEFAULT_RUNS_TO_AGGREGATE);
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(true);
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);

  // Fetch available games from factory
  const { worlds: availableGames, isLoading: isLoadingGames } = useFactoryWorlds([selectedChain], true);

  // Load stored preferences
  useEffect(() => {
    const storedChain = loadStoredChain();
    if (storedChain) setSelectedChain(storedChain);
    const storedGames = loadStoredSelectedGames();
    if (storedGames) setSelectedGames(storedGames.slice(0, MAX_GAMES));
    const storedRuns = loadStoredRunsToAggregate();
    if (storedRuns) setRunsToAggregate(storedRuns);
  }, []);

  // Build endpoints from selected games
  const resolvedEndpoints = useMemo(() => selectedGames.map((name) => buildToriiSqlUrl(name)), [selectedGames]);

  // Persist preferences
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCORE_TO_BEAT_CHAIN_STORAGE_KEY, selectedChain);
    }
  }, [selectedChain]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCORE_TO_BEAT_GAMES_STORAGE_KEY, JSON.stringify(selectedGames));
    }
  }, [selectedGames]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCORE_TO_BEAT_RUNS_STORAGE_KEY, String(runsToAggregate));
    }
  }, [runsToAggregate]);

  // Score to beat hook
  const {
    entries: scoreToBeatEntries,
    endpoints: syncedEndpoints,
    failedEndpoints,
    lastUpdatedAt,
    isLoading,
    error,
    refresh,
    hasEndpointsConfigured,
  } = useScoreToBeat(resolvedEndpoints, runsToAggregate);

  const handleToggleGame = useCallback((gameName: string) => {
    setSelectedGames((current) => {
      if (current.includes(gameName)) {
        return current.filter((name) => name !== gameName);
      }
      if (current.length >= MAX_GAMES) {
        return current;
      }
      return [...current, gameName];
    });
  }, []);

  const handleClearSelectedGames = useCallback(() => {
    setSelectedGames([]);
  }, []);

  const scoreToBeatTopTen = scoreToBeatEntries.slice(0, 10);
  const topScoreToBeat = scoreToBeatTopTen[0] ?? null;
  const scoreToBeatRuns = topScoreToBeat?.runs ?? [];
  const topScoreToBeatLabel = topScoreToBeat
    ? (topScoreToBeat.displayName ?? displayAddress(topScoreToBeat.address))
    : null;
  const topScoreToBeatAddressLabel = topScoreToBeat ? displayAddress(topScoreToBeat.address) : null;

  const updatedLabel = useMemo(() => getRelativeTimeLabel(lastUpdatedAt, "Awaiting sync"), [lastUpdatedAt]);

  const totalGames = selectedGames.length;
  const failedGames = failedEndpoints.length;
  const activeSyncedGames = syncedEndpoints.length || totalGames;
  const syncedGames = Math.max(0, activeSyncedGames - failedGames);
  const gameLabel = totalGames > 0 ? `${syncedGames}/${totalGames} games selected` : "No games selected";

  const handleDownloadData = useCallback(() => {
    if (scoreToBeatTopTen.length === 0 || typeof window === "undefined") return;

    const rows = [
      ["Rank", "Display name", "Address", "Score", "Run 1 score", "Run 2 score", "Run 3 score"],
      ...scoreToBeatTopTen.map((entry, index) => {
        const run1 = entry.runs[0]?.points ?? "";
        const run2 = entry.runs[1]?.points ?? "";
        const run3 = entry.runs[2]?.points ?? "";

        return [
          `${index + 1}`,
          entry.displayName ?? displayAddress(entry.address),
          entry.address,
          `${entry.combinedPoints ?? 0}`,
          `${run1}`,
          `${run2}`,
          `${run3}`,
        ];
      }),
    ];

    const csvContent = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadLink.href = url;
    downloadLink.setAttribute("download", `score-to-beat-${timestamp}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    window.URL.revokeObjectURL(url);
  }, [scoreToBeatTopTen]);

  // Collapse expanded entry if it's no longer in the list
  useEffect(() => {
    if (expandedAddress && !scoreToBeatTopTen.some((entry) => entry.address === expandedAddress)) {
      setExpandedAddress(null);
    }
  }, [expandedAddress, scoreToBeatTopTen]);

  return (
    <div className="space-y-5 rounded-3xl border border-amber-200/25 bg-gradient-to-br from-amber-500/10 via-black/40 to-black/80 p-6 text-white shadow-[0_30px_65px_-30px_rgba(255,196,86,0.55)]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-100/70">Score to beat</p>
          {topScoreToBeat ? (
            <>
              <p className="mt-2 flex items-baseline gap-2 text-4xl font-extrabold leading-tight text-white">
                {formatPoints(topScoreToBeat.combinedPoints)}
                <span className="text-base font-semibold text-white/70">pts</span>
              </p>
              <p className="mt-2 text-sm text-white/70">
                {(topScoreToBeatLabel ?? "Unknown captain").trim()} has conquered Realms Blitz.
              </p>
              {topScoreToBeatAddressLabel &&
              topScoreToBeatLabel &&
              topScoreToBeatLabel.toLowerCase() !== topScoreToBeatAddressLabel.toLowerCase() ? (
                <p className="text-xs text-white/50">{topScoreToBeatAddressLabel}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-white/70">
              Chain your best {runsToAggregate} runs and you become the number everyone else has to chase.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {error ? (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200" role="alert">
              {error}
            </span>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={handleDownloadData}
              disabled={scoreToBeatTopTen.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-amber-200/60 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Download score to beat scores"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <span className="text-xs text-white/70" aria-live="polite">
                  Syncing...
                </span>
              ) : null}
              <RefreshButton
                onClick={refresh}
                isLoading={isLoading}
                disabled={isLoading}
                size="sm"
                aria-label="Refresh score to beat"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Game Selector */}
      <div className="rounded-2xl border border-amber-100/20 bg-black/40 p-4 shadow-inner shadow-amber-500/5">
        <button
          type="button"
          onClick={() => setIsGameSelectorOpen((current) => !current)}
          aria-expanded={isGameSelectorOpen}
          className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-start sm:justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/60">
            <span>{gameLabel}</span>
            {isLoading ? <span className="text-amber-100">• syncing</span> : null}
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
              {isGameSelectorOpen ? "Hide" : "Select games"}
            </span>
          </div>
        </button>

        {isGameSelectorOpen ? (
          <div className="mt-3 space-y-3">
            {/* Chain selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-white/60">Chain:</span>
              <div className="flex gap-1">
                {CHAIN_OPTIONS.map((chain) => (
                  <button
                    key={chain}
                    type="button"
                    onClick={() => setSelectedChain(chain)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 ${
                      selectedChain === chain
                        ? "border border-amber-200/60 bg-amber-200/30 text-amber-50"
                        : "border border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    {chain}
                  </button>
                ))}
              </div>
            </div>

            {/* Best of selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-white/60">Best of:</span>
              <div className="flex gap-1">
                {RUNS_TO_AGGREGATE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRunsToAggregate(option)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 ${
                      runsToAggregate === option
                        ? "border border-amber-200/60 bg-amber-200/30 text-amber-50"
                        : "border border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Available games from factory */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">
                  Available games {isLoadingGames ? "(loading...)" : `(${availableGames.length})`}
                </span>
                <span className="text-xs text-white/50">
                  {selectedGames.length}/{MAX_GAMES} selected
                </span>
              </div>
              {isLoadingGames ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center text-xs text-white/50">
                  Loading games from {selectedChain}...
                </div>
              ) : availableGames.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center text-xs text-white/50">
                  No games found on {selectedChain}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {availableGames.map((game) => {
                      const isSelected = selectedGames.includes(game.name);
                      const isDisabled = !isSelected && selectedGames.length >= MAX_GAMES;
                      return (
                        <button
                          key={game.name}
                          type="button"
                          onClick={() => handleToggleGame(game.name)}
                          disabled={isDisabled}
                          className={`rounded-lg px-2 py-1.5 text-left text-xs transition ${
                            isSelected
                              ? "border border-amber-200/60 bg-amber-200/20 text-amber-50"
                              : isDisabled
                                ? "cursor-not-allowed border border-white/5 bg-white/5 text-white/30"
                                : "border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                          }`}
                        >
                          <span className="block truncate">{game.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Selected games and clear button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClearSelectedGames}
                disabled={selectedGames.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear selection
              </button>
            </div>

            {/* Show selected games as chips */}
            {selectedGames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedGames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-50"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => handleToggleGame(name)}
                      className="rounded-full border border-white/20 bg-white/10 px-1 text-[10px] font-bold text-white/80 transition hover:border-white/40 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                      aria-label={`Remove ${name} from selection`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/60">
                No games selected. Select games above to see the combined leaderboard.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/60">Expand to select games for the combined leaderboard.</p>
        )}
      </div>

      {/* Top score runs breakdown */}
      <div className="grid gap-3 md:grid-cols-2">
        {scoreToBeatRuns.length ? (
          scoreToBeatRuns.map((run, index) => (
            <div
              key={`${run.endpoint}-${index}`}
              className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm"
            >
              <p className="text-xs uppercase tracking-wide text-white/60">Run #{index + 1}</p>
              <p className="mt-1 text-2xl font-semibold text-white">{formatPoints(run.points)} pts</p>
              <p className="text-xs text-white/50">{describeEndpoint(run.endpoint)}</p>
            </div>
          ))
        ) : (
          <div className="col-span-2 rounded-2xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-white/60">
            Waiting for runs before we crown a pace setter.
          </div>
        )}
      </div>

      {/* Top 10 leaderboard */}
      {scoreToBeatTopTen.length ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-white/50">Top 10 {getRunsLabel(runsToAggregate)} totals</p>
          <ol className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/30 text-sm">
            {scoreToBeatTopTen.map((entry, index) => {
              const rank = index + 1;
              const challengerLabel = displayAddress(entry.address);
              const isLeader = rank === 1;
              const isExpanded = expandedAddress === entry.address;
              const runSummaryLabel = getBestRunsLabel(Math.min(entry.runs.length, runsToAggregate));

              return (
                <li
                  key={entry.address}
                  className={`${isLeader ? "bg-amber-500/5" : ""} ${isExpanded ? "bg-white/5" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedAddress((current) => (current === entry.address ? null : entry.address))}
                    aria-expanded={isExpanded}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/60"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                          isLeader ? "bg-amber-400/30 text-amber-200" : "bg-white/10 text-white/60"
                        }`}
                      >
                        {rank}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{entry.displayName ?? challengerLabel}</p>
                        <p className="text-xs text-white/50">{entry.displayName ? challengerLabel : entry.address}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-white">{formatPoints(entry.combinedPoints)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-white/50">{runSummaryLabel}</p>
                    </div>
                  </button>
                  {isExpanded ? (
                    <div className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3 text-sm text-white/80 sm:text-xs">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{runSummaryLabel}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {entry.runs.map((run, runIndex) => (
                          <div
                            key={`${run.endpoint}-${runIndex}`}
                            className="rounded-2xl border border-white/10 bg-black/30 p-3"
                          >
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/60">
                              <span>Run #{runIndex + 1}</span>
                              <span className="text-sm font-semibold text-white">{formatPoints(run.points)} pts</span>
                            </div>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-white/50">
                              {describeEndpoint(run.endpoint)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {/* Footer status */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
        <span>{gameLabel}</span>
        {updatedLabel ? (
          <>
            <span>·</span>
            <span>{updatedLabel}</span>
          </>
        ) : null}
        {failedGames > 0 ? (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">
            {failedGames} down
          </span>
        ) : null}
      </div>
    </div>
  );
};
