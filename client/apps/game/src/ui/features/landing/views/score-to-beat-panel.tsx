/**
 * Score to Beat panel for the landing page.
 * Shows the combined best scores across multiple Blitz games.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Download from "lucide-react/dist/esm/icons/download";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactorySeriesIndex, type FactorySeriesIndex } from "@/hooks/use-factory-series-index";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { getAvatarUrl, normalizeAvatarAddress, useAvatarProfiles } from "@/hooks/use-player-avatar";
import { useWorldsAvailability } from "@/hooks/use-world-availability";
import {
  claimGameReviewRewardsForPlayers,
  fetchGameReviewUnclaimedPlayers,
} from "@/services/review/game-review-service";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { displayAddress } from "@/ui/utils/utils";
import type { Chain } from "@contracts";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SCORE_TO_BEAT_STATIC_GAMES } from "@/services/leaderboard/landing-leaderboard-service";
import { useScoreToBeat } from "@/services/leaderboard/use-score-to-beat";

const DEFAULT_RUNS_TO_AGGREGATE = 3;
const RUNS_TO_AGGREGATE_OPTIONS = [1, 2, 3, 4] as const;
const CHAIN_OPTIONS: Chain[] = ["mainnet", "slot"];

type SelectorMode = "games" | "series";

interface SeriesSelectionOption {
  name: string;
  gameNames: string[];
}

const MAINNET_STATIC_SERIES_NAMES = new Set(["s0-preview-cont"]);

const SCORE_TO_BEAT_GAMES_STORAGE_KEY = "landing-score-to-beat-games-v2";
const SCORE_TO_BEAT_SERIES_STORAGE_KEY = "landing-score-to-beat-series-v1";
const SCORE_TO_BEAT_RUNS_STORAGE_KEY = "landing-score-to-beat-runs-v2";
const SCORE_TO_BEAT_CHAIN_STORAGE_KEY = "landing-score-to-beat-chain-v2";

const formatPoints = (points: number) =>
  Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(points ?? 0);

const formatCount = (value: number) =>
  Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.floor(value ?? 0)));

const formatLords = (value: number) =>
  Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Math.max(0, value ?? 0));

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

const loadStoredSelectedSeries = (): string[] | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SCORE_TO_BEAT_SERIES_STORAGE_KEY);
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

const mapSeriesToSelectionOption = (
  series: FactorySeriesIndex,
  availableGameNames: Set<string>,
  selectedChain: Chain,
): SeriesSelectionOption | null => {
  const uniqueGameNamesSet = new Set(
    series.games.map((game) => game.worldName).filter((worldName) => availableGameNames.has(worldName)),
  );

  if (selectedChain === "mainnet" && MAINNET_STATIC_SERIES_NAMES.has(series.name.trim().toLowerCase())) {
    SCORE_TO_BEAT_STATIC_GAMES.forEach((gameName) => {
      if (availableGameNames.has(gameName)) {
        uniqueGameNamesSet.add(gameName);
      }
    });
  }

  const uniqueGameNames = Array.from(uniqueGameNamesSet);

  if (uniqueGameNames.length === 0) return null;

  return {
    name: series.name,
    gameNames: uniqueGameNames,
  };
};

const resolveSelectedGameNames = (
  selectedGames: string[],
  selectedSeries: string[],
  seriesByName: Map<string, SeriesSelectionOption>,
): string[] => {
  const uniqueGames = new Set<string>();

  selectedGames.forEach((game) => {
    const trimmed = game.trim();
    if (trimmed) uniqueGames.add(trimmed);
  });

  selectedSeries.forEach((seriesName) => {
    const series = seriesByName.get(seriesName);
    if (!series) return;
    series.gameNames.forEach((gameName) => {
      const trimmed = gameName.trim();
      if (trimmed) uniqueGames.add(trimmed);
    });
  });

  return Array.from(uniqueGames);
};

const getSelectorCountLabel = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Unknown error";
};

const buildClaimGameKey = (chain: Chain, gameName: string): string => `${chain}:${gameName}`;

export const ScoreToBeatPanel = () => {
  const queryClient = useQueryClient();
  const account = useAccountStore((state) => state.account);
  const [selectedChain, setSelectedChain] = useState<Chain>(() => loadStoredChain() ?? "mainnet");
  const [selectedGames, setSelectedGames] = useState<string[]>(() => {
    const storedGames = loadStoredSelectedGames();
    const chainDefaultGames = selectedChain === "mainnet" ? [...SCORE_TO_BEAT_STATIC_GAMES] : [];
    return storedGames ?? chainDefaultGames;
  });
  const [selectedSeries, setSelectedSeries] = useState<string[]>(() => loadStoredSelectedSeries() ?? []);
  const [runsToAggregate, setRunsToAggregate] = useState<number>(
    () => loadStoredRunsToAggregate() ?? DEFAULT_RUNS_TO_AGGREGATE,
  );
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(true);
  const [selectorMode, setSelectorMode] = useState<SelectorMode>("games");
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
  const [activeClaimGame, setActiveClaimGame] = useState<string | null>(null);
  const [optimisticClaimedByGame, setOptimisticClaimedByGame] = useState<Record<string, string[]>>({});

  // Fetch available games from factory
  const { worlds: factoryWorlds, isLoading: isLoadingGames } = useFactoryWorlds([selectedChain], true);

  // Fetch series and linked games from factory
  const { series: factorySeries, isLoading: isLoadingSeries } = useFactorySeriesIndex([selectedChain], true);

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

  const staticGamesForSelectedChain = useMemo(
    () => (selectedChain === "mainnet" ? [...SCORE_TO_BEAT_STATIC_GAMES] : []),
    [selectedChain],
  );

  const availableGameNames = useMemo(
    () => Array.from(new Set([...staticGamesForSelectedChain, ...availableGames.map((game) => game.name)])),
    [availableGames, staticGamesForSelectedChain],
  );

  const availableGameNamesSet = useMemo(() => new Set(availableGameNames), [availableGameNames]);

  const availableSeries = useMemo(() => {
    return factorySeries
      .map((series) => mapSeriesToSelectionOption(series, availableGameNamesSet, selectedChain))
      .filter((series): series is SeriesSelectionOption => series !== null)
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [factorySeries, availableGameNamesSet, selectedChain]);

  const availableSeriesByName = useMemo(
    () => new Map(availableSeries.map((series) => [series.name, series])),
    [availableSeries],
  );

  const filteredSelectedGames = useMemo(
    () => selectedGames.filter((gameName) => availableGameNamesSet.has(gameName)),
    [selectedGames, availableGameNamesSet],
  );

  const filteredSelectedSeries = useMemo(
    () => selectedSeries.filter((seriesName) => availableSeriesByName.has(seriesName)),
    [selectedSeries, availableSeriesByName],
  );

  const resolvedSelectedGameNames = useMemo(
    () => resolveSelectedGameNames(filteredSelectedGames, filteredSelectedSeries, availableSeriesByName),
    [filteredSelectedGames, filteredSelectedSeries, availableSeriesByName],
  );

  // Build endpoints from selected games and selected series games
  const resolvedEndpoints = useMemo(
    () => resolvedSelectedGameNames.map((name) => buildToriiSqlUrl(name)),
    [resolvedSelectedGameNames],
  );

  // Persist preferences
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCORE_TO_BEAT_CHAIN_STORAGE_KEY, selectedChain);
    }
  }, [selectedChain]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCORE_TO_BEAT_GAMES_STORAGE_KEY, JSON.stringify(filteredSelectedGames));
    }
  }, [filteredSelectedGames]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCORE_TO_BEAT_SERIES_STORAGE_KEY, JSON.stringify(filteredSelectedSeries));
    }
  }, [filteredSelectedSeries]);

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
  } = useScoreToBeat(resolvedEndpoints, runsToAggregate);

  const claimStatusQueries = useQueries({
    queries: resolvedSelectedGameNames.map((gameName) => ({
      queryKey: ["gameReviewUnclaimedPlayers", selectedChain, gameName],
      queryFn: () =>
        fetchGameReviewUnclaimedPlayers({
          worldName: gameName,
          chain: selectedChain,
        }),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const claimStatusByGame = useMemo(() => {
    const byGame = new Map<
      string,
      {
        rankingFinalized: boolean;
        totalRankedPlayers: number;
        unclaimedPlayerAddresses: string[];
        isLoading: boolean;
        error: string | null;
      }
    >();

    resolvedSelectedGameNames.forEach((gameName, index) => {
      const queryState = claimStatusQueries[index];
      const data = queryState?.data;
      byGame.set(gameName, {
        rankingFinalized: data?.rankingFinalized ?? false,
        totalRankedPlayers: data?.totalRankedPlayers ?? 0,
        unclaimedPlayerAddresses: data?.unclaimedPlayers.map((player) => player.address) ?? [],
        isLoading: queryState?.isLoading ?? false,
        error: queryState?.error ? getErrorMessage(queryState.error) : null,
      });
    });

    return byGame;
  }, [claimStatusQueries, resolvedSelectedGameNames]);

  const claimAllRewardsMutation = useMutation({
    mutationFn: async ({ gameName, chain }: { gameName: string; chain: Chain }) => {
      if (!account) {
        throw new Error("Connect your wallet to claim rewards.");
      }

      const unclaimed = await fetchGameReviewUnclaimedPlayers({
        worldName: gameName,
        chain,
      });

      if (!unclaimed.rankingFinalized) {
        throw new Error("Ranking is not finalized for this game yet.");
      }

      return claimGameReviewRewardsForPlayers({
        worldName: gameName,
        chain,
        signer: account,
        playerAddresses: unclaimed.unclaimedPlayers.map((player) => player.address),
      });
    },
    onMutate: ({ gameName }) => {
      setActiveClaimGame(gameName);
    },
    onSuccess: async (result, variables) => {
      const claimKey = buildClaimGameKey(variables.chain, variables.gameName);
      setOptimisticClaimedByGame((previous) => {
        const existing = previous[claimKey] ?? [];
        const merged = Array.from(new Set([...existing, ...result.playerAddresses]));
        return {
          ...previous,
          [claimKey]: merged,
        };
      });

      if (result.claimedPlayers > 0) {
        toast.success(`Claimed ${result.claimedPlayers} player reward${result.claimedPlayers === 1 ? "" : "s"}.`, {
          description: `${variables.gameName} updated in ${result.batchesSubmitted} batch${result.batchesSubmitted === 1 ? "" : "es"}.`,
        });
      } else {
        toast("No unclaimed rewards left.", {
          description: `${variables.gameName} is already fully claimed.`,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["gameReviewUnclaimedPlayers", variables.chain, variables.gameName],
      });
    },
    onError: (error, variables) => {
      toast.error(`Failed to claim rewards for ${variables.gameName}.`, {
        description: getErrorMessage(error),
      });
    },
    onSettled: () => {
      setActiveClaimGame(null);
    },
  });

  const handleToggleGame = useCallback((gameName: string) => {
    setSelectedGames((current) => {
      if (current.includes(gameName)) {
        return current.filter((name) => name !== gameName);
      }

      const next = [...current, gameName];
      return next;
    });
  }, []);

  const handleToggleSeries = useCallback((seriesName: string) => {
    setSelectedSeries((current) => {
      if (current.includes(seriesName)) {
        return current.filter((name) => name !== seriesName);
      }

      const next = [...current, seriesName];
      return next;
    });
  }, []);

  const handleClearSelected = useCallback(() => {
    setSelectedGames([]);
    setSelectedSeries([]);
  }, []);

  const scoreToBeatRows = scoreToBeatEntries;
  const topScoreToBeat = scoreToBeatRows[0] ?? null;
  const scoreToBeatRuns = topScoreToBeat?.runs ?? [];
  const scoreToBeatAddresses = scoreToBeatTopTen.map((entry) => entry.address);
  const { data: avatarProfiles } = useAvatarProfiles(scoreToBeatAddresses);
  const avatarMap = useMemo(() => {
    const map = new Map<string, string>();
    (avatarProfiles ?? []).forEach((profile) => {
      const normalizedAddress = normalizeAvatarAddress(profile.playerAddress);
      if (!normalizedAddress || !profile.avatarUrl) return;
      map.set(normalizedAddress, profile.avatarUrl);
    });
    return map;
  }, [avatarProfiles]);
  const topScoreToBeatLabel = topScoreToBeat
    ? (topScoreToBeat.displayName ?? displayAddress(topScoreToBeat.address))
    : null;
  const topScoreToBeatAddress = normalizeAvatarAddress(topScoreToBeat?.address ?? null);
  const topScoreToBeatAvatarUrl = topScoreToBeatAddress
    ? getAvatarUrl(topScoreToBeatAddress, avatarMap.get(topScoreToBeatAddress))
    : null;

  const updatedLabel = useMemo(() => getRelativeTimeLabel(lastUpdatedAt, "Awaiting sync"), [lastUpdatedAt]);

  const totalGames = resolvedSelectedGameNames.length;
  const failedGames = failedEndpoints.length;
  const activeSyncedGames = syncedEndpoints.length || totalGames;
  const syncedGames = Math.max(0, activeSyncedGames - failedGames);
  const gameLabel = totalGames > 0 ? `${syncedGames}/${totalGames} games selected` : "No games selected";

  const hasSelections = filteredSelectedGames.length > 0 || filteredSelectedSeries.length > 0;
  const selectedSummary = [
    getSelectorCountLabel(filteredSelectedGames.length, "game", "games"),
    getSelectorCountLabel(filteredSelectedSeries.length, "series", "series"),
  ].join(" + ");

  const isSelectorLoading = isLoadingGames || isCheckingWorlds || isLoadingSeries;
  const selectorAvailabilityCount = selectorMode === "games" ? availableGameNames.length : availableSeries.length;

  const handleDownloadData = () => {
    if (scoreToBeatRows.length === 0 || typeof window === "undefined") return;

    const bestRunHeaders = Array.from({ length: runsToAggregate }, (_, index) => `Best run ${index + 1} score`);
    const perGameHeaders = resolvedSelectedGameNames.flatMap((gameName) => [
      `${gameName} score`,
      `${gameName} chests`,
      `${gameName} lords`,
    ]);

    const rows = [
      [
        "Rank",
        "Display name",
        "Address",
        "Combined score",
        "Chests earned",
        "Lords earned",
        ...bestRunHeaders,
        ...perGameHeaders,
      ],
      ...scoreToBeatRows.map((entry, index) => {
        const bestRunScores = Array.from({ length: runsToAggregate }, (_, runIndex) => {
          const run = entry.runs[runIndex];
          return run ? `${run.points}` : "";
        });

        const scoreByGame = new Map<string, number>();
        const chestsByGame = new Map<string, number>();
        const lordsByGame = new Map<string, number>();
        entry.allRuns.forEach((run) => {
          const gameName = describeEndpoint(run.endpoint);
          scoreByGame.set(gameName, run.points);
          chestsByGame.set(gameName, run.chests);
          lordsByGame.set(gameName, run.lords);
        });

        const perGameValues = resolvedSelectedGameNames.flatMap((gameName) => {
          const score = scoreByGame.get(gameName);
          const chests = chestsByGame.get(gameName);
          const lords = lordsByGame.get(gameName);
          return [score == null ? "" : `${score}`, chests == null ? "" : `${chests}`, lords == null ? "" : `${lords}`];
        });

        return [
          `${index + 1}`,
          entry.displayName ?? displayAddress(entry.address),
          entry.address,
          `${entry.combinedPoints ?? 0}`,
          `${entry.combinedChests ?? 0}`,
          `${entry.combinedLords ?? 0}`,
          ...bestRunScores,
          ...perGameValues,
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
  };

  const activeExpandedAddress =
    expandedAddress && scoreToBeatRows.some((entry) => entry.address === expandedAddress) ? expandedAddress : null;

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
              <div className="mt-2 flex items-center gap-2">
                {topScoreToBeatAvatarUrl && (
                  <img
                    src={topScoreToBeatAvatarUrl}
                    alt={`${topScoreToBeatLabel ?? "Player"} avatar`}
                    className="h-7 w-7 rounded-full border border-gold/20 object-cover"
                    loading="lazy"
                  />
                )}
                <p className="text-sm text-gold/60">{(topScoreToBeatLabel ?? "Unknown").trim()} leads the pack</p>
              </div>
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
            disabled={scoreToBeatRows.length === 0}
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
            <div className="inline-flex rounded-lg bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setSelectorMode("games")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  selectorMode === "games" ? "bg-gold/20 text-gold" : "text-gold/60 hover:text-gold"
                }`}
              >
                Games
              </button>
              <button
                type="button"
                onClick={() => setSelectorMode("series")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  selectorMode === "series" ? "bg-gold/20 text-gold" : "text-gold/60 hover:text-gold"
                }`}
              >
                Series
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gold/60">
                {selectorMode === "games" ? "Available games" : "Available series"}{" "}
                {isSelectorLoading ? "(checking...)" : `(${selectorAvailabilityCount})`}
              </span>
              <span className="text-gold/50">{selectedSummary}</span>
            </div>

            <div className="text-xs text-gold/40">{resolvedSelectedGameNames.length} resolved games</div>

            {isSelectorLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : selectorMode === "games" ? (
              availableGameNames.length === 0 ? (
                <p className="py-4 text-center text-sm text-gold/50">
                  No games with active indexers on {selectedChain}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {availableGameNames.map((gameName) => {
                    const isSelected = filteredSelectedGames.includes(gameName);
                    return (
                      <button
                        key={gameName}
                        type="button"
                        onClick={() => handleToggleGame(gameName)}
                        className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                          isSelected ? "bg-gold/20 text-gold" : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                        }`}
                      >
                        <span className="block truncate">{gameName}</span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : availableSeries.length === 0 ? (
              <p className="py-4 text-center text-sm text-gold/50">
                No series with active indexed games on {selectedChain}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableSeries.map((series) => {
                  const isSelected = filteredSelectedSeries.includes(series.name);

                  return (
                    <button
                      key={series.name}
                      type="button"
                      onClick={() => handleToggleSeries(series.name)}
                      className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                        isSelected ? "bg-gold/20 text-gold" : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                      }`}
                    >
                      <span className="block truncate font-medium">{series.name}</span>
                      <span className="mt-0.5 block text-xs text-gold/50">
                        {getSelectorCountLabel(series.gameNames.length, "indexed game", "indexed games")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasSelections && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleClearSelected} className="text-sm text-gold/50 hover:text-gold">
                  Clear all
                </button>
                <span className="text-gold/30">|</span>
                {filteredSelectedGames.map((name) => (
                  <span
                    key={`game:${name}`}
                    className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-xs text-gold"
                  >
                    game: {name}
                    <button
                      type="button"
                      onClick={() => handleToggleGame(name)}
                      className="ml-1 text-gold/50 hover:text-gold"
                    >
                      x
                    </button>
                  </span>
                ))}
                {filteredSelectedSeries.map((name) => (
                  <span
                    key={`series:${name}`}
                    className="inline-flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200"
                  >
                    series: {name}
                    <button
                      type="button"
                      onClick={() => handleToggleSeries(name)}
                      className="ml-1 text-cyan-200/60 hover:text-cyan-200"
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

      {resolvedSelectedGameNames.length > 0 && (
        <div className="rounded-xl border border-gold/15 bg-black/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gold">Tournament Reward Claims</h3>
            {!account && <span className="text-xs text-gold/60">Connect wallet to claim.</span>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {resolvedSelectedGameNames.map((gameName) => {
              const claimStatus = claimStatusByGame.get(gameName);
              const rawUnclaimedPlayerAddresses = claimStatus?.unclaimedPlayerAddresses ?? [];
              const optimisticClaimKey = buildClaimGameKey(selectedChain, gameName);
              const optimisticClaimedAddresses = optimisticClaimedByGame[optimisticClaimKey] ?? [];
              const optimisticClaimedAddressSet = new Set(optimisticClaimedAddresses);
              const unclaimedPlayers = rawUnclaimedPlayerAddresses.filter(
                (address) => !optimisticClaimedAddressSet.has(address),
              ).length;
              const totalRankedPlayers = claimStatus?.totalRankedPlayers ?? 0;
              const claimedPlayers = Math.max(0, totalRankedPlayers - unclaimedPlayers);
              const isLoadingStatus = claimStatus?.isLoading ?? false;
              const statusError = claimStatus?.error;
              const rankingFinalized = claimStatus?.rankingFinalized ?? false;
              const isClaimingThisGame = claimAllRewardsMutation.isPending && activeClaimGame === gameName;

              const claimDisabled =
                isLoadingStatus ||
                !account ||
                !rankingFinalized ||
                unclaimedPlayers === 0 ||
                Boolean(statusError) ||
                (claimAllRewardsMutation.isPending && activeClaimGame !== gameName);

              return (
                <div key={`claim:${gameName}`} className="rounded-lg border border-gold/15 bg-black/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gold" title={gameName}>
                      {gameName}
                    </span>
                    <span className="text-[11px] text-gold/60">
                      {rankingFinalized
                        ? `${claimedPlayers}/${totalRankedPlayers} claimed`
                        : isLoadingStatus
                          ? "Checking..."
                          : "Ranking pending"}
                    </span>
                  </div>

                  {statusError && <p className="mt-2 text-xs text-red-300">{statusError}</p>}

                  <button
                    type="button"
                    onClick={() => claimAllRewardsMutation.mutate({ gameName, chain: selectedChain })}
                    disabled={claimDisabled}
                    className="mt-3 w-full rounded-lg border border-brilliance/40 bg-brilliance/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-brilliance transition hover:bg-brilliance/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isClaimingThisGame
                      ? "Claiming..."
                      : !rankingFinalized
                        ? "Ranking Pending"
                        : unclaimedPlayers > 0
                          ? `Claim All (${unclaimedPlayers})`
                          : "All Claimed"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      {scoreToBeatRows.length > 0 ? (
        <div className="flex-1 overflow-hidden rounded-xl border border-gold/10 bg-black/30">
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-gold/10 bg-black/80 backdrop-blur-sm">
                <tr className="text-left text-sm text-gold/60">
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Player</th>
                  <th className="px-6 py-4 text-right font-medium">Score</th>
                  <th className="px-6 py-4 text-right font-medium">Chests earned</th>
                  <th className="px-6 py-4 text-right font-medium">
                    <span className="inline-flex items-center justify-end gap-1">
                      <img src="/tokens/lords.png" alt="LORDS" className="h-4 w-4 rounded-full object-contain" />
                      <span>Lords earned</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/5">
                {scoreToBeatRows.map((entry, index) => {
                  const rank = index + 1;
                  const isExpanded = activeExpandedAddress === entry.address;
                  const normalizedAddress = normalizeAvatarAddress(entry.address);
                  const avatarSeedAddress = normalizedAddress ?? entry.address;
                  const avatarUrl = getAvatarUrl(
                    avatarSeedAddress,
                    normalizedAddress ? avatarMap.get(normalizedAddress) : undefined,
                  );

                  return (
                    <tr
                      key={entry.address}
                      onClick={() => setExpandedAddress(isExpanded ? null : entry.address)}
                      className={`cursor-pointer transition-colors hover:bg-gold/5 ${isExpanded ? "bg-gold/5" : ""}`}
                    >
                      <td className="px-6 py-4 text-gold/50">#{rank}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <img
                            src={avatarUrl}
                            alt={`${entry.displayName ?? displayAddress(entry.address)} avatar`}
                            className="mt-0.5 h-8 w-8 rounded-full border border-gold/20 object-cover"
                            loading="lazy"
                          />
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
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-lg font-semibold text-gold">
                        {formatPoints(entry.combinedPoints)}
                      </td>
                      <td className="px-6 py-4 text-right text-gold/80">{formatCount(entry.combinedChests)}</td>
                      <td className="px-6 py-4 text-right text-gold/80">
                        <span className="inline-flex items-center justify-end gap-1">
                          <img src="/tokens/lords.png" alt="LORDS" className="h-4 w-4 rounded-full object-contain" />
                          <span>{formatLords(entry.combinedLords)}</span>
                        </span>
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
          {resolvedSelectedGameNames.length === 0
            ? "Select games or series above to see the leaderboard"
            : "No scores found yet"}
        </div>
      )}
    </div>
  );
};
