/**
 * Score to Beat panel for the landing page.
 * Shows the combined best scores across multiple Blitz games.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Download from "lucide-react/dist/esm/icons/download";

import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability } from "@/hooks/use-world-availability";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { displayAddress } from "@/ui/utils/utils";
import type { Chain } from "@contracts";

import { useScoreToBeat } from "@/services/leaderboard/use-score-to-beat";

const MAX_GAMES = 10;
const DEFAULT_RUNS_TO_AGGREGATE = 3;
const RUNS_TO_AGGREGATE_OPTIONS = [1, 2, 3, 4] as const;
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
  const { worlds: factoryWorlds, isLoading: isLoadingGames } = useFactoryWorlds([selectedChain], true);

  // Check which worlds have working indexers
  const worldRefs = useMemo(
    () => factoryWorlds.map((w) => ({ name: w.name, chain: selectedChain })),
    [factoryWorlds, selectedChain],
  );
  const { results: worldAvailability, isAnyLoading: isCheckingWorlds } = useWorldsAvailability(worldRefs, true);

  // Filter to only show games with working indexers
  const availableGames = useMemo(() => {
    return factoryWorlds.filter((w) => {
      const availability = worldAvailability.get(`${selectedChain}:${w.name}`);
      return availability?.isAvailable;
    });
  }, [factoryWorlds, worldAvailability, selectedChain]);

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
    <div className="h-[85vh] w-full space-y-6 overflow-y-auto rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gold">Score to Beat</h2>
          {topScoreToBeat ? (
            <>
              <p className="mt-2 flex items-baseline gap-2 text-4xl font-bold text-gold">
                {formatPoints(topScoreToBeat.combinedPoints)}
                <span className="text-lg font-normal text-gold/60">pts</span>
              </p>
              <p className="mt-1 text-sm text-gold/60">{(topScoreToBeatLabel ?? "Unknown").trim()} leads the pack</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-gold/60">
              {runsToAggregate === 1
                ? "Get the best single run to top the leaderboard."
                : `Combine your best ${runsToAggregate} runs to climb the ranks.`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-300">{error}</span>}
          <button
            type="button"
            onClick={handleDownloadData}
            disabled={scoreToBeatTopTen.length === 0}
            className="rounded-xl border border-gold/30 bg-gold/10 p-2 text-gold transition hover:bg-gold/20 disabled:opacity-40"
            aria-label="Download scores"
          >
            <Download className="h-5 w-5" />
          </button>
          <RefreshButton onClick={refresh} isLoading={isLoading} disabled={isLoading} size="md" />
        </div>
      </div>

      {/* Selectors - inline */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Chain */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gold/60">Chain:</span>
          <div className="flex gap-1">
            {CHAIN_OPTIONS.map((chain) => (
              <button
                key={chain}
                type="button"
                onClick={() => setSelectedChain(chain)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                  selectedChain === chain ? "bg-gold/20 text-gold" : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                }`}
              >
                {chain}
              </button>
            ))}
          </div>
        </div>

        {/* Best of */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gold/60">Best of:</span>
          <div className="flex gap-1">
            {RUNS_TO_AGGREGATE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRunsToAggregate(option)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  runsToAggregate === option ? "bg-gold/20 text-gold" : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Game Selector */}
      <div>
        <button
          type="button"
          onClick={() => setIsGameSelectorOpen((c) => !c)}
          className="flex items-center gap-2 text-sm text-gold/70 hover:text-gold"
        >
          <span>{gameLabel}</span>
          <span className="text-xs">({isGameSelectorOpen ? "hide" : "show"})</span>
        </button>

        {isGameSelectorOpen && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gold/60">
                Available games {isLoadingGames || isCheckingWorlds ? "(checking...)" : `(${availableGames.length})`}
              </span>
              <span className="text-gold/50">
                {selectedGames.length}/{MAX_GAMES} selected
              </span>
            </div>

            {isLoadingGames || isCheckingWorlds ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : availableGames.length === 0 ? (
              <p className="py-4 text-center text-sm text-gold/50">No games with active indexers on {selectedChain}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {availableGames.map((game) => {
                  const isSelected = selectedGames.includes(game.name);
                  const isDisabled = !isSelected && selectedGames.length >= MAX_GAMES;
                  return (
                    <button
                      key={game.name}
                      type="button"
                      onClick={() => handleToggleGame(game.name)}
                      disabled={isDisabled}
                      className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "bg-gold/20 text-gold"
                          : isDisabled
                            ? "cursor-not-allowed text-gold/30"
                            : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                      }`}
                    >
                      <span className="block truncate">{game.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedGames.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearSelectedGames}
                  className="text-sm text-gold/50 hover:text-gold"
                >
                  Clear all
                </button>
                <span className="text-gold/30">|</span>
                {selectedGames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-xs text-gold"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => handleToggleGame(name)}
                      className="ml-1 text-gold/50 hover:text-gold"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top score runs */}
      {scoreToBeatRuns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {scoreToBeatRuns.map((run, index) => (
            <div key={`${run.endpoint}-${index}`} className="rounded-xl border border-gold/10 bg-black/30 p-4">
              <p className="text-xs text-gold/50">Run #{index + 1}</p>
              <p className="mt-1 text-2xl font-semibold text-gold">{formatPoints(run.points)}</p>
              <p className="text-xs text-gold/40">{describeEndpoint(run.endpoint)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {scoreToBeatTopTen.length > 0 ? (
        <div className="flex-1 overflow-hidden rounded-xl border border-gold/10 bg-black/30">
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-gold/10 bg-black/80 backdrop-blur-sm">
                <tr className="text-left text-sm text-gold/60">
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Player</th>
                  <th className="px-6 py-4 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/5">
                {scoreToBeatTopTen.map((entry, index) => {
                  const rank = index + 1;
                  const isExpanded = expandedAddress === entry.address;

                  return (
                    <tr
                      key={entry.address}
                      onClick={() => setExpandedAddress(isExpanded ? null : entry.address)}
                      className={`cursor-pointer transition-colors hover:bg-gold/5 ${isExpanded ? "bg-gold/5" : ""}`}
                    >
                      <td className="px-6 py-4 text-gold/50">#{rank}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gold">
                            {entry.displayName ?? displayAddress(entry.address)}
                          </span>
                          {entry.displayName && (
                            <span className="text-xs text-gold/40">{displayAddress(entry.address)}</span>
                          )}
                          {isExpanded && entry.runs.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {entry.runs.map((run, i) => (
                                <span key={i} className="rounded bg-gold/10 px-2 py-1 text-xs text-gold/70">
                                  {describeEndpoint(run.endpoint)}: {formatPoints(run.points)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-lg font-semibold text-gold">
                        {formatPoints(entry.combinedPoints)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gold/10 bg-black/40 px-6 py-3 text-center text-sm text-gold/50">
            {gameLabel} · {updatedLabel}
            {failedGames > 0 && <span className="ml-2 text-red-300">({failedGames} failed)</span>}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-16 text-gold/50">
          {selectedGames.length === 0 ? "Select games above to see the leaderboard" : "No scores found yet"}
        </div>
      )}
    </div>
  );
};
