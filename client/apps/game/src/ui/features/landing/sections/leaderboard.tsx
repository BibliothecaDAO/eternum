import { Fragment, useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { useNavigate } from "react-router-dom";

import { Download } from "lucide-react";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import { getAvatarUrl, normalizeAvatarAddress, useAvatarProfiles } from "@/hooks/use-player-avatar";

import { type LandingLeaderboardEntry } from "../lib/landing-leaderboard-service";
import { MIN_REFRESH_INTERVAL_MS, useLandingLeaderboardStore } from "../lib/use-landing-leaderboard-store";
import { useScoreToBeat } from "../lib/use-score-to-beat";

const LEADERBOARD_LIMIT = 25;
const REFRESH_INTERVAL_MS = 60_000;

const podiumStyles = [
  "border-gold/70 shadow-[0_0_45px_-18px_rgba(255,215,128,0.55)] hover:shadow-[0_0_65px_-18px_rgba(255,215,128,0.75)]",
  "border-white/40 shadow-[0_0_40px_-20px_rgba(226,232,240,0.45)] hover:shadow-[0_0_60px_-20px_rgba(226,232,240,0.55)]",
  "border-orange-400/60 shadow-[0_0_42px_-20px_rgba(255,170,102,0.45)] hover:shadow-[0_0_62px_-20px_rgba(255,170,102,0.6)]",
] as const;

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

const SCORE_TO_BEAT_STORAGE_KEY = "landing-score-to-beat-endpoints";
const DEFAULT_SCORE_TO_BEAT_ENDPOINT_NAMES: string[] = [
  "warr-game-1",
  "warr-game-2",
  "warr-game-3",
  "warr-game-4",
  "warr-game-5",
  "warr-game-6",
];

const SCORE_TO_BEAT_TAB_ENABLED = true; // Temporarily hide the Score to Beat tab until it's ready again.

const describeEndpoint = (endpoint: string) => {
  if (!endpoint) {
    return "";
  }

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

const buildEndpointUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  return hasProtocol ? trimmed : `https://api.cartridge.gg/x/${trimmed}/torii/sql`;
};

const parseEndpointInput = (value: string) => {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const loadStoredEndpointNames = (): string[] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(SCORE_TO_BEAT_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Ignore malformed data and fall back to defaults.
  }

  return null;
};

type LeaderboardTab = "score-to-beat" | "leaderboard";

const LEADERBOARD_TABS: Array<{ id: LeaderboardTab; label: string }> = [
  { id: "score-to-beat", label: "Score to beat" },
  { id: "leaderboard", label: "Current Leaderboard" },
];

const TAB_PANEL_ID = "landing-leaderboard-tabpanel";

const getTabButtonId = (tab: LeaderboardTab) => `landing-leaderboard-tab-${tab}`;
const getScoreToBeatRunsPanelId = (address: string) => `landing-score-to-beat-runs-${address}`;
const getActivityPanelId = (address: string) => `landing-leaderboard-activity-${address}`;

type ActivityField = keyof Pick<
  LandingLeaderboardEntry,
  | "exploredTiles"
  | "exploredTilePoints"
  | "relicCratesOpened"
  | "relicCratePoints"
  | "riftsTaken"
  | "riftPoints"
  | "campsTaken"
  | "campPoints"
  | "hyperstructuresConquered"
  | "hyperstructurePoints"
  | "hyperstructuresHeld"
  | "hyperstructuresHeldPoints"
>;

type ActivityCategory = {
  id: string;
  label: string;
  countKey?: ActivityField;
  pointsKey?: ActivityField;
  singularLabel?: string;
  pluralLabel?: string;
  helper?: string;
};

const ACTIVITY_COUNT_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  {
    id: "exploration",
    label: "Tiles explored",
    countKey: "exploredTiles",
    pointsKey: "exploredTilePoints",
    singularLabel: "tile",
    pluralLabel: "tiles",
  },
  {
    id: "crates",
    label: "Relic crates",
    countKey: "relicCratesOpened",
    pointsKey: "relicCratePoints",
    singularLabel: "crate",
    pluralLabel: "crates",
  },
  {
    id: "rifts-camps",
    label: "Rifts/camps taken",
    countKey: "riftsTaken",
    pointsKey: "riftPoints",
    singularLabel: "rift/camp",
    pluralLabel: "rifts/camps",
  },
  {
    id: "hyperstructures-captured",
    label: "Hyperstructures captured",
    countKey: "hyperstructuresConquered",
    pointsKey: "hyperstructurePoints",
    singularLabel: "structure",
    pluralLabel: "structures",
  },
  {
    id: "hyperstructures-held",
    label: "Hyperstructures held",
    countKey: "hyperstructuresHeld",
    pointsKey: "hyperstructuresHeldPoints",
    singularLabel: "structure",
    pluralLabel: "structures",
  },
];

const formatCountMetric = (value: number | null | undefined, singularLabel?: string, pluralLabel?: string) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (!singularLabel || !pluralLabel) {
    return ACTIVITY_COUNT_FORMATTER.format(value);
  }

  const label = Math.abs(value) === 1 ? singularLabel : pluralLabel;
  return `${ACTIVITY_COUNT_FORMATTER.format(value)} ${label}`.trim();
};

const formatPointsMetric = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return `${formatPoints(value)} pts`;
};

const buildActivityBreakdown = (entry: LandingLeaderboardEntry) => {
  return ACTIVITY_CATEGORIES.map((category) => {
    const countValue = category.countKey ? (entry[category.countKey] as number | undefined) : null;
    const pointsValue = category.pointsKey ? (entry[category.pointsKey] as number | undefined) : null;
    const countLabel = formatCountMetric(countValue, category.singularLabel, category.pluralLabel);
    const pointsLabel = formatPointsMetric(pointsValue);

    if (!countLabel && !pointsLabel) {
      return null;
    }

    return {
      id: category.id,
      label: category.label,
      countLabel,
      pointsLabel,
      helper: category.helper ?? null,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
};

export const LandingLeaderboard = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const [configuredEndpointNames, setConfiguredEndpointNames] = useState<string[]>(
    DEFAULT_SCORE_TO_BEAT_ENDPOINT_NAMES,
  );
  const [endpointEditorValue, setEndpointEditorValue] = useState<string>(
    DEFAULT_SCORE_TO_BEAT_ENDPOINT_NAMES.join("\n"),
  );

  const entries = useLandingLeaderboardStore((state) => state.entries);
  const { data: avatarProfiles } = useAvatarProfiles(entries.map((entry) => entry.address));
  const avatarMap = useMemo(() => {
    const map = new Map<string, string>();
    (avatarProfiles ?? []).forEach((profile) => {
      const normalized = normalizeAvatarAddress(profile.playerAddress);
      if (!normalized) return;
      if (profile.avatarUrl) {
        map.set(normalized, profile.avatarUrl);
      }
    });
    return map;
  }, [avatarProfiles]);
  const getEntryAvatarUrl = useCallback(
    (entry: LandingLeaderboardEntry) => {
      const normalized = normalizeAvatarAddress(entry.address);
      const avatarUrl = normalized ? avatarMap.get(normalized) : undefined;
      return getAvatarUrl(entry.address, avatarUrl);
    },
    [avatarMap],
  );

  const isFetching = useLandingLeaderboardStore((state) => state.isFetching);
  const error = useLandingLeaderboardStore((state) => state.error);
  const lastUpdatedAt = useLandingLeaderboardStore((state) => state.lastUpdatedAt);
  const lastFetchAt = useLandingLeaderboardStore((state) => state.lastFetchAt);
  const fetchLeaderboard = useLandingLeaderboardStore((state) => state.fetchLeaderboard);

  useEffect(() => {
    const stored = loadStoredEndpointNames();
    if (stored) {
      setConfiguredEndpointNames(stored);
      setEndpointEditorValue(stored.join("\n"));
    }
  }, []);

  const resolvedScoreToBeatEndpoints = useMemo(
    () =>
      configuredEndpointNames
        .map((name) => buildEndpointUrl(name))
        .filter((endpoint): endpoint is string => Boolean(endpoint)),
    [configuredEndpointNames],
  );

  const editedEndpointNames = useMemo(() => parseEndpointInput(endpointEditorValue), [endpointEditorValue]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SCORE_TO_BEAT_STORAGE_KEY, JSON.stringify(configuredEndpointNames));
  }, [configuredEndpointNames]);

  const handleApplyScoreToBeatEndpoints = useCallback(() => {
    setConfiguredEndpointNames(editedEndpointNames);
    setEndpointEditorValue(editedEndpointNames.join("\n"));
  }, [editedEndpointNames]);

  const handleClearScoreToBeatEndpoints = useCallback(() => {
    setConfiguredEndpointNames([]);
    setEndpointEditorValue("");
  }, []);

  const handleRemoveEndpointName = useCallback((name: string) => {
    setConfiguredEndpointNames((current) => {
      const updated = current.filter((item) => item !== name);
      setEndpointEditorValue(updated.join("\n"));
      return updated;
    });
  }, []);

  const isEndpointEditorDirty = useMemo(
    () =>
      editedEndpointNames.length !== configuredEndpointNames.length ||
      editedEndpointNames.some((name, index) => name !== configuredEndpointNames[index]),
    [configuredEndpointNames, editedEndpointNames],
  );
  const isSaveEndpointsDisabled = !isEndpointEditorDirty;
  const [isEndpointEditorOpen, setIsEndpointEditorOpen] = useState(false);

  useEffect(() => {
    console.log("entries", entries);
  }, [entries]);

  const {
    entries: scoreToBeatEntries,
    endpoints: scoreToBeatSyncedEndpoints,
    failedEndpoints: scoreToBeatFailedEndpoints,
    lastUpdatedAt: scoreToBeatLastUpdatedAt,
    isLoading: isScoreToBeatLoading,
    error: scoreToBeatError,
    refresh: refreshScoreToBeat,
    hasEndpointsConfigured: hasScoreToBeatConfiguration,
  } = useScoreToBeat(resolvedScoreToBeatEndpoints);

  const [refreshCooldownMs, setRefreshCooldownMs] = useState(0);

  useEffect(() => {
    const updateCooldown = () => {
      if (!lastFetchAt) {
        setRefreshCooldownMs(0);
        return;
      }

      const elapsed = Date.now() - lastFetchAt;
      const remaining = Math.max(0, MIN_REFRESH_INTERVAL_MS - elapsed);
      setRefreshCooldownMs(remaining);
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 250);

    return () => window.clearInterval(interval);
  }, [lastFetchAt]);

  useEffect(() => {
    void fetchLeaderboard({ limit: LEADERBOARD_LIMIT });
  }, [fetchLeaderboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchLeaderboard({ limit: LEADERBOARD_LIMIT });
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchLeaderboard]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) => {
      const name = entry.displayName?.toLowerCase() ?? "";
      const address = entry.address.toLowerCase();
      const shortAddress = displayAddress(entry.address).toLowerCase();

      return (
        name.includes(normalizedQuery) || address.includes(normalizedQuery) || shortAddress.includes(normalizedQuery)
      );
    });
  }, [entries, normalizedQuery]);

  const isFiltering = normalizedQuery.length > 0;
  const isInitialLoading = isFetching && entries.length === 0;
  const isCooldownActive = refreshCooldownMs > 0;
  const refreshSecondsLeft = Math.ceil(refreshCooldownMs / 1000);

  const { podiumEntries, remainingEntries } = useMemo(() => {
    const podium = filteredEntries.slice(0, 3);
    const rest = filteredEntries.slice(3);

    return {
      podiumEntries: podium,
      remainingEntries: rest,
    };
  }, [filteredEntries]);

  const handleManualRefresh = useCallback(() => {
    if (isFetching || refreshCooldownMs > 0) {
      return;
    }

    void fetchLeaderboard({ limit: LEADERBOARD_LIMIT });
  }, [fetchLeaderboard, isFetching, refreshCooldownMs]);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.currentTarget.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleViewScoreCard = useCallback(() => {
    navigate("/player");
  }, [navigate]);

  const lastUpdatedLabel = useMemo(() => getRelativeTimeLabel(lastUpdatedAt, "Waiting for data"), [lastUpdatedAt]);

  const scoreToBeatUpdatedLabel = useMemo(
    () => getRelativeTimeLabel(scoreToBeatLastUpdatedAt, "Awaiting sync"),
    [scoreToBeatLastUpdatedAt],
  );

  const scoreToBeatTopTen = scoreToBeatEntries.slice(0, 10);
  const topScoreToBeat = scoreToBeatTopTen[0] ?? null;
  const scoreToBeatRuns = topScoreToBeat?.runs ?? [];
  const topScoreToBeatLabel = topScoreToBeat
    ? (topScoreToBeat.displayName ?? displayAddress(topScoreToBeat.address))
    : null;
  const topScoreToBeatAddressLabel = topScoreToBeat ? displayAddress(topScoreToBeat.address) : null;
  const handleDownloadScoreToBeatData = useCallback(() => {
    if (scoreToBeatTopTen.length === 0 || typeof window === "undefined") {
      return;
    }

    const rows = [
      ["Rank", "Display name", "Address", "Score", "Run 1 score", "Run 2 score"],
      ...scoreToBeatTopTen.map((entry, index) => {
        const run1 = entry.runs[0]?.points ?? "";
        const run2 = entry.runs[1]?.points ?? "";

        return [
          `${index + 1}`,
          entry.displayName ?? displayAddress(entry.address),
          entry.address,
          `${entry.combinedPoints ?? 0}`,
          `${run1}`,
          `${run2}`,
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
  const handleDownloadLeaderboardData = useCallback(() => {
    if (filteredEntries.length === 0 || typeof window === "undefined") {
      return;
    }

    const rows = [
      ["Rank", "Display name", "Address", "Points"],
      ...filteredEntries.map((entry) => [
        `${entry.rank ?? ""}`,
        entry.displayName ?? displayAddress(entry.address),
        entry.address,
        `${entry.points ?? 0}`,
      ]),
    ];

    const csvContent = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadLink.href = url;
    downloadLink.setAttribute("download", `leaderboard-${timestamp}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    window.URL.revokeObjectURL(url);
  }, [filteredEntries]);
  const totalScoreGames = resolvedScoreToBeatEndpoints.length;
  const failedScoreGames = scoreToBeatFailedEndpoints.length;
  const activeSyncedGames = scoreToBeatSyncedEndpoints.length || totalScoreGames;
  const syncedScoreGames = Math.max(0, activeSyncedGames - failedScoreGames);
  const scoreGameLabel =
    totalScoreGames > 0 ? `${syncedScoreGames}/${totalScoreGames} games syncing` : "Waiting for games";
  const showScoreToBeatSection = SCORE_TO_BEAT_TAB_ENABLED && hasScoreToBeatConfiguration;
  const [activeTab, setActiveTab] = useState<LeaderboardTab>(showScoreToBeatSection ? "score-to-beat" : "leaderboard");
  const [expandedScoreToBeatAddress, setExpandedScoreToBeatAddress] = useState<string | null>(null);
  const [expandedEntryAddress, setExpandedEntryAddress] = useState<string | null>(null);
  const visibleTabs = useMemo(
    () => (showScoreToBeatSection ? LEADERBOARD_TABS : LEADERBOARD_TABS.filter((tab) => tab.id === "leaderboard")),
    [showScoreToBeatSection],
  );

  useEffect(() => {
    if (!showScoreToBeatSection && activeTab === "score-to-beat") {
      setActiveTab("leaderboard");
    }
  }, [activeTab, showScoreToBeatSection]);

  useEffect(() => {
    if (
      expandedScoreToBeatAddress &&
      !scoreToBeatTopTen.some((entry) => entry.address === expandedScoreToBeatAddress)
    ) {
      setExpandedScoreToBeatAddress(null);
    }
  }, [expandedScoreToBeatAddress, scoreToBeatTopTen]);

  useEffect(() => {
    if (!expandedEntryAddress) {
      return;
    }

    const isVisible = filteredEntries.some((entry) => entry.address === expandedEntryAddress);
    if (!isVisible) {
      setExpandedEntryAddress(null);
    }
  }, [expandedEntryAddress, filteredEntries]);

  const toggleEntryExpansion = useCallback((address: string) => {
    setExpandedEntryAddress((current) => (current === address ? null : address));
  }, []);

  const handleEntryToggleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, address: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleEntryExpansion(address);
      }
    },
    [toggleEntryExpansion],
  );

  const renderSkeleton = () => (
    <div className="space-y-6" aria-hidden>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/30 to-black/70"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/30 to-black/70" />
    </div>
  );
  const renderScoreToBeatContent = () => {
    if (!showScoreToBeatSection) {
      return (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/75 p-8 text-center text-sm text-white/70 shadow-[0_25px_50px_-25px_rgba(12,10,35,0.75)]">
          Score to beat tracking isn't configured yet. Check back soon.
        </div>
      );
    }

    return (
      <div className="space-y-5 rounded-3xl border border-amber-200/25 bg-gradient-to-br from-amber-500/10 via-black/40 to-black/80 p-6 text-white shadow-[0_30px_65px_-30px_rgba(255,196,86,0.55)]">
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
                Chain two monster runs back-to-back and you become the number everyone else has to chase.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            {scoreToBeatError ? (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200" role="alert">
                {scoreToBeatError}
              </span>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={handleDownloadScoreToBeatData}
                disabled={scoreToBeatTopTen.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-amber-200/60 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Download score to beat scores"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2">
                {isScoreToBeatLoading ? (
                  <span className="text-xs text-white/70" aria-live="polite">
                    Syncing…
                  </span>
                ) : null}
                <RefreshButton
                  onClick={refreshScoreToBeat}
                  isLoading={isScoreToBeatLoading}
                  disabled={isScoreToBeatLoading}
                  size="sm"
                  aria-label="Refresh score to beat"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100/20 bg-black/40 p-4 shadow-inner shadow-amber-500/5">
          <button
            type="button"
            onClick={() => setIsEndpointEditorOpen((current) => !current)}
            aria-expanded={isEndpointEditorOpen}
            className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-start sm:justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/60">
              <span>{scoreGameLabel}</span>
              {isScoreToBeatLoading ? <span className="text-amber-100">• syncing</span> : null}
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                {isEndpointEditorOpen ? "Hide" : "Edit"}
              </span>
            </div>
          </button>
          {isEndpointEditorOpen ? (
            <div className="mt-3 space-y-3">
              <textarea
                value={endpointEditorValue}
                onChange={(event) => setEndpointEditorValue(event.currentTarget.value)}
                spellCheck={false}
                rows={3}
                placeholder="warr-game-1\nwarr-game-2"
                className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-200/70 focus:bg-black/70"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyScoreToBeatEndpoints}
                  disabled={isSaveEndpointsDisabled}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200/50 bg-amber-200/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-50 transition hover:border-amber-200/70 hover:bg-amber-200/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save games
                </button>
                <button
                  type="button"
                  onClick={handleClearScoreToBeatEndpoints}
                  disabled={configuredEndpointNames.length === 0 && endpointEditorValue.trim().length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear list
                </button>
              </div>
              {configuredEndpointNames.length ? (
                <div className="flex flex-wrap gap-2">
                  {configuredEndpointNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-50"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => handleRemoveEndpointName(name)}
                        className="rounded-full border border-white/20 bg-white/10 px-1 text-[10px] font-bold text-white/80 transition hover:border-white/40 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
                        aria-label={`Remove ${name} from tracked games`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/60">No games selected. Add at least one to see the score to beat.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-white/60">
              Expand to define the games you want to track for score to beat.
            </p>
          )}
        </div>

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
              Waiting for back-to-back runs before we crown a pace setter.
            </div>
          )}
        </div>

        {scoreToBeatTopTen.length ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Top 10 two-run totals</p>
            <ol className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/30 text-sm">
              {scoreToBeatTopTen.map((entry, index) => {
                const rank = index + 1;
                const challengerLabel = displayAddress(entry.address);
                const isLeader = rank === 1;
                const isExpanded = expandedScoreToBeatAddress === entry.address;
                const runSummaryLabel = entry.runs.length >= 2 ? "Best two runs" : "Best run";
                const panelId = getScoreToBeatRunsPanelId(entry.address);

                return (
                  <li
                    key={entry.address}
                    className={`${isLeader ? "bg-amber-500/5" : ""} ${isExpanded ? "bg-white/5" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedScoreToBeatAddress((current) => (current === entry.address ? null : entry.address))
                      }
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
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
                      <div
                        id={panelId}
                        className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3 text-sm text-white/80 sm:text-xs"
                      >
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

        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
          <span>{scoreGameLabel}</span>
          {scoreToBeatUpdatedLabel ? (
            <>
              <span>·</span>
              <span>{scoreToBeatUpdatedLabel}</span>
            </>
          ) : null}
          {failedScoreGames > 0 ? (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">
              {failedScoreGames} down
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const renderLeaderboardContent = () => {
    if (isInitialLoading) {
      return renderSkeleton();
    }

    if (entries.length === 0) {
      return (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/75 p-8 text-center text-sm text-white/70 shadow-[0_25px_50px_-25px_rgba(12,10,35,0.75)]">
          No ranked players yet. Check back soon once battles begin.
        </div>
      );
    }

    if (isFiltering && filteredEntries.length === 0) {
      return (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/75 p-8 text-center text-sm text-white/70 shadow-[0_25px_50px_-25px_rgba(12,10,35,0.75)]">
          No players match "{searchQuery.trim()}".
        </div>
      );
    }

    const expandedPodiumEntry = podiumEntries.find((entry) => entry.address === expandedEntryAddress) ?? null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <span className="tracking-wide">Download the current view (filters included).</span>
          <button
            type="button"
            onClick={handleDownloadLeaderboardData}
            disabled={filteredEntries.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:border-gold/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            aria-label="Download current leaderboard"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {podiumEntries.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {podiumEntries.map((entry, index) => {
                const addressLabel = displayAddress(entry.address);
                const avatarUrl = getEntryAvatarUrl(entry);
                const isExpanded = expandedEntryAddress === entry.address;
                const panelId = getActivityPanelId(entry.address);
                const handleToggle = () => toggleEntryExpansion(entry.address);
                const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) =>
                  handleEntryToggleKeyDown(event, entry.address);

                return (
                  <div key={entry.address} className="flex flex-col gap-2">
                    <article
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      onClick={handleToggle}
                      onKeyDown={handleCardKeyDown}
                      className={`group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/80 p-6 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold/60 ${
                        podiumStyles[index] ?? podiumStyles[2]
                      } ${isExpanded ? "ring-1 ring-gold/50" : ""}`}
                    >
                      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/60">
                        <span>Rank</span>
                        <span className="text-2xl font-semibold text-gold">#{entry.rank}</span>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <img
                          className="h-12 w-12 rounded-full border border-white/20 object-cover"
                          src={avatarUrl}
                          alt={`${entry.displayName ?? addressLabel} avatar`}
                        />
                        <div className="space-y-1">
                          <p className="text-lg font-semibold text-white" title={entry.displayName ?? addressLabel}>
                            {entry.displayName ?? addressLabel}
                          </p>
                          <p className="text-xs text-white/60" title={entry.address}>
                            {entry.displayName ? addressLabel : entry.address}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1">
                        <p className="text-3xl font-bold text-white">{formatPoints(entry.points)}</p>
                        <p className="text-xs text-white/60">{currencyIntlFormat(entry.points, 1)} pts</p>
                      </div>

                      <div className="mt-5 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/60">
                        <span>Status</span>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            entry.prizeClaimed ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/70"
                          }`}
                        >
                          {entry.prizeClaimed ? "Prize claimed" : "Unclaimed"}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
                        <span>{isExpanded ? "Hide activity" : "View activity"}</span>
                        <svg
                          className={`h-3.5 w-3.5 text-white/60 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M4 6l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
            {expandedPodiumEntry ? (
              <div
                id={getActivityPanelId(expandedPodiumEntry.address)}
                className="rounded-3xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/80 shadow-[0_15px_35px_-25px_rgba(10,12,30,0.9)]"
              >
                <PlayerActivityBreakdown entry={expandedPodiumEntry} />
              </div>
            ) : null}
          </div>
        ) : null}
        {remainingEntries.length > 0 ? (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/80 shadow-[0_25px_50px_-25px_rgba(10,12,30,0.75)] backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/5 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-white/60">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Rank
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Player
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">
                      Points
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {remainingEntries.map((entry) => {
                    const addressLabel = displayAddress(entry.address);
                    const avatarUrl = getEntryAvatarUrl(entry);
                    const isExpanded = expandedEntryAddress === entry.address;
                    const panelId = getActivityPanelId(entry.address);
                    const handleToggle = () => toggleEntryExpansion(entry.address);
                    const handleRowKeyDown = (event: KeyboardEvent<HTMLElement>) =>
                      handleEntryToggleKeyDown(event, entry.address);

                    return (
                      <Fragment key={entry.address}>
                        <tr
                          className={`transition-colors hover:bg-white/10 ${isExpanded ? "bg-white/10" : ""}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          onClick={handleToggle}
                          onKeyDown={handleRowKeyDown}
                        >
                          <td className="px-4 py-3 text-white/70">#{entry.rank}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                className="h-9 w-9 rounded-full border border-white/15 object-cover"
                                src={avatarUrl}
                                alt={`${entry.displayName ?? addressLabel} avatar`}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium text-white" title={entry.displayName ?? addressLabel}>
                                  {entry.displayName ?? addressLabel}
                                </span>
                                <span className="text-xs text-white/50" title={entry.address}>
                                  {entry.displayName ? addressLabel : entry.address}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-white">
                            <span className="font-semibold">{formatPoints(entry.points)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="ml-auto flex max-w-full items-center justify-end gap-2">
                              <span
                                className={`inline-flex items-center justify-end rounded-full px-2.5 py-1 text-xs font-medium ${
                                  entry.prizeClaimed
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-white/10 text-white/60"
                                }`}
                              >
                                {entry.prizeClaimed ? "Prize claimed" : "In play"}
                              </span>
                              <svg
                                className={`h-3 w-3 text-white/50 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                viewBox="0 0 16 16"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M4 6l4 4 4-4"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan={4} id={panelId} className="bg-black/40 px-4 pb-4 pt-1">
                              <PlayerActivityBreakdown entry={entry} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="relative h-[70vh] w-full max-w-5xl space-y-8 overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-none">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="w-full sm:w-72">
              <label htmlFor="landing-leaderboard-search" className="sr-only">
                Search players or addresses
              </label>
              <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 shadow-[0_16px_40px_-25px_rgba(12,10,35,0.85)] transition focus-within:border-gold/60 focus-within:text-white focus-within:shadow-[0_20px_50px_-20px_rgba(255,215,128,0.45)]">
                <svg
                  className="h-4 w-4 shrink-0 text-white/50 transition group-focus-within:text-gold"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M9.16667 2.5a6.66667 6.66667 0 1 1 0 13.33333 6.66667 6.66667 0 0 1 0-13.33333z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M15 15l3.33333 3.33333"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  id="landing-leaderboard-search"
                  type="text"
                  role="searchbox"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search players or addresses"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  spellCheck={false}
                  autoComplete="off"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                    aria-label="Clear search"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path
                        d="M3 3l6 6m0-6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 self-end sm:flex-row sm:items-center sm:gap-3 sm:self-auto">
              <button
                type="button"
                onClick={handleViewScoreCard}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-gold/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/50 sm:w-auto"
              >
                Check your score card
              </button>
              <div className="flex items-center justify-end gap-3">
                {error ? (
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300" role="alert">
                    {error}
                  </span>
                ) : null}
                <div className="flex flex-col items-end gap-1 text-right">
                  <div className="flex items-center gap-2">
                    {isFetching ? (
                      <span className="text-xs text-white/70" aria-live="polite">
                        Refreshing…
                      </span>
                    ) : isCooldownActive ? (
                      <span className="text-xs text-white/50" aria-live="polite">
                        Wait {refreshSecondsLeft}s
                      </span>
                    ) : null}
                    <RefreshButton
                      onClick={handleManualRefresh}
                      isLoading={isFetching}
                      disabled={isCooldownActive || isFetching}
                      size="md"
                      aria-label="Refresh leaderboard"
                    />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                    Last updated {lastUpdatedLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        <div
          role="tablist"
          aria-label="Leaderboard sections"
          aria-orientation="horizontal"
          className="flex gap-2 rounded-3xl border border-white/10 bg-white/5 p-1 text-sm font-semibold"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={getTabButtonId(tab.id)}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={TAB_PANEL_ID}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-2xl px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60 ${
                  isActive
                    ? "bg-white text-black shadow-[0_20px_45px_-25px_rgba(255,255,255,0.85)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={TAB_PANEL_ID}
          aria-labelledby={getTabButtonId(activeTab)}
          className="focus-visible:outline-none"
        >
          {activeTab === "score-to-beat" && showScoreToBeatSection
            ? renderScoreToBeatContent()
            : renderLeaderboardContent()}
        </div>
      </div>
    </section>
  );
};

interface PlayerActivityBreakdownProps {
  entry: LandingLeaderboardEntry;
}

const PlayerActivityBreakdown = ({ entry }: PlayerActivityBreakdownProps) => {
  const breakdown = buildActivityBreakdown(entry);
  const hasBreakdown = breakdown.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
        <span className="font-semibold text-white">{formatPoints(entry.points)} pts</span>
        <span>Total points</span>
      </div>
      {hasBreakdown ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {breakdown.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/60">
                <span>{item.label}</span>
                {item.pointsLabel ? <span className="text-sm font-semibold text-white">{item.pointsLabel}</span> : null}
              </div>
              {item.countLabel ? <p className="mt-1 text-sm text-white/80">{item.countLabel}</p> : null}
              {item.helper ? (
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35">{item.helper}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/20 bg-black/30 px-4 py-3 text-xs text-white/70">
          Blitz activity for this player is still syncing.
        </div>
      )}
    </div>
  );
};
