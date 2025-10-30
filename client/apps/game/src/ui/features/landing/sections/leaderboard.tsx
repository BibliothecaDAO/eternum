import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";

import { MIN_REFRESH_INTERVAL_MS, useLandingLeaderboardStore } from "../lib/use-landing-leaderboard-store";

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

export const LandingLeaderboard = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();

  const entries = useLandingLeaderboardStore((state) => state.entries);
  const isFetching = useLandingLeaderboardStore((state) => state.isFetching);
  const error = useLandingLeaderboardStore((state) => state.error);
  const lastUpdatedAt = useLandingLeaderboardStore((state) => state.lastUpdatedAt);
  const lastFetchAt = useLandingLeaderboardStore((state) => state.lastFetchAt);
  const fetchLeaderboard = useLandingLeaderboardStore((state) => state.fetchLeaderboard);

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

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return "Waiting for data";
    }

    const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const secondsAgo = Math.round((Date.now() - lastUpdatedAt) / 1000);

    if (Math.abs(secondsAgo) < 60) {
      return relative.format(-secondsAgo, "second");
    }

    const minutesAgo = Math.round(secondsAgo / 60);
    return relative.format(-minutesAgo, "minute");
  }, [lastUpdatedAt]);

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

  return (
    <section className="relative w-full max-w-5xl space-y-8 overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-white">Leaderboard</h2>
          <p className="text-sm text-white/70">
            Follow the most active Realms captains in Blitz. Rankings refresh automatically from live on-chain data.
          </p>
          <p className="text-xs uppercase tracking-wide text-white/50" aria-live="polite">
            Updated {lastUpdatedLabel}
            {isFetching ? " · Refreshing…" : ""}
          </p>
        </div>

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
              </div>
            </div>
          </div>
        </div>
      </header>

      {isInitialLoading ? (
        renderSkeleton()
      ) : entries.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/75 p-8 text-center text-sm text-white/70 shadow-[0_25px_50px_-25px_rgba(12,10,35,0.75)]">
          No ranked players yet. Check back soon once battles begin.
        </div>
      ) : isFiltering && filteredEntries.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/75 p-8 text-center text-sm text-white/70 shadow-[0_25px_50px_-25px_rgba(12,10,35,0.75)]">
          No players match "{searchQuery.trim()}".
        </div>
      ) : (
        <div className="space-y-6">
          {podiumEntries.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {podiumEntries.map((entry, index) => {
                const addressLabel = displayAddress(entry.address);
                return (
                  <article
                    key={entry.address}
                    className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/35 to-black/80 p-6 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${podiumStyles[index] ?? podiumStyles[2]}`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/60">
                      <span>Rank</span>
                      <span className="text-2xl font-semibold text-gold">#{entry.rank}</span>
                    </div>

                    <div className="mt-4 space-y-1">
                      <p className="text-lg font-semibold text-white" title={entry.displayName ?? addressLabel}>
                        {entry.displayName ?? addressLabel}
                      </p>
                      <p className="text-xs text-white/60" title={entry.address}>
                        {entry.displayName ? addressLabel : entry.address}
                      </p>
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
                  </article>
                );
              })}
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
                      return (
                        <tr key={entry.address} className="transition-colors hover:bg-white/10">
                          <td className="px-4 py-3 text-white/70">#{entry.rank}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-white" title={entry.displayName ?? addressLabel}>
                                {entry.displayName ?? addressLabel}
                              </span>
                              <span className="text-xs text-white/50" title={entry.address}>
                                {entry.displayName ? addressLabel : entry.address}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-white">
                            <span className="font-semibold">{formatPoints(entry.points)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex items-center justify-end rounded-full px-2.5 py-1 text-xs font-medium ${
                                entry.prizeClaimed ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/60"
                              }`}
                            >
                              {entry.prizeClaimed ? "Prize claimed" : "In play"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};
