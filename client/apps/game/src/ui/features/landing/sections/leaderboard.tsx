import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";

import { fetchLandingLeaderboard, type LandingLeaderboardEntry } from "../lib/landing-leaderboard-service";

const LEADERBOARD_LIMIT = 25;
const REFRESH_INTERVAL_MS = 60_000;

const podiumStyles = [
  "border-amber-300/50 bg-gradient-to-br from-amber-400/15 via-amber-500/5 to-transparent",
  "border-zinc-300/40 bg-gradient-to-br from-zinc-100/10 via-zinc-600/5 to-transparent",
  "border-orange-300/40 bg-gradient-to-br from-orange-400/10 via-orange-500/5 to-transparent",
] as const;

const podiumProgress = [
  "from-amber-400 via-amber-300 to-amber-200",
  "from-zinc-200 via-zinc-300 to-zinc-400",
  "from-orange-300 via-orange-400 to-orange-500",
] as const;

const formatPoints = (points: number) =>
  Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(points ?? 0);

export const LandingLeaderboard = () => {
  const [entries, setEntries] = useState<LandingLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const activeRequestRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  const loadLeaderboard = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    isFetchingRef.current = true;

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const result = await fetchLandingLeaderboard(LEADERBOARD_LIMIT, 0);

      if (!isMountedRef.current || controller.signal.aborted || activeRequestRef.current !== controller) {
        return;
      }

      setEntries(result);
      setLastUpdatedAt(Date.now());
      setError(null);
    } catch (caughtError) {
      if (!isMountedRef.current || controller.signal.aborted || activeRequestRef.current !== controller) {
        return;
      }

      const message = caughtError instanceof Error ? caughtError.message : "Unable to load leaderboard";
      setError(message);
    } finally {
      if (activeRequestRef.current === controller) {
        isFetchingRef.current = false;

        if (!silent && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (isFetchingRef.current) {
        return;
      }

      void loadLeaderboard({ silent: true });
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadLeaderboard]);

  const { podiumEntries, remainingEntries, topScore } = useMemo(() => {
    const podium = entries.slice(0, 3);
    const rest = entries.slice(3);
    const bestScore = podium.length > 0 ? podium[0].points : rest.length > 0 ? rest[0].points : 0;

    return {
      podiumEntries: podium,
      remainingEntries: rest,
      topScore: bestScore,
    };
  }, [entries]);

  const handleManualRefresh = useCallback(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

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
          <div key={item} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
    </div>
  );

  return (
    <section className="w-full max-w-5xl space-y-8 rounded-3xl border border-white/10 bg-black/50 p-8 text-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-white">Leaderboard</h2>
          <p className="text-sm text-white/70">
            Follow the most active Realms captains in Blitz. Rankings refresh automatically from live on-chain data.
          </p>
          <p className="text-xs uppercase tracking-wide text-white/50" aria-live="polite">
            Updated {lastUpdatedLabel}
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-start">
          {error ? (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300" role="alert">
              {error}
            </span>
          ) : null}
          <RefreshButton
            onClick={handleManualRefresh}
            isLoading={isLoading}
            size="md"
            aria-label="Refresh leaderboard"
          />
        </div>
      </header>

      {isLoading && entries.length === 0 ? (
        renderSkeleton()
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/70">
          No ranked players yet. Check back soon once battles begin.
        </div>
      ) : (
        <div className="space-y-6">
          {podiumEntries.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {podiumEntries.map((entry, index) => {
                const ratio = topScore > 0 ? Math.max(0.1, entry.points / topScore) : 1;
                const addressLabel = displayAddress(entry.address);

                return (
                  <article
                    key={entry.address}
                    className={`flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.9)] ${podiumStyles[index] ?? podiumStyles[2]}`}
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

                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-white">{formatPoints(entry.points)}</p>
                        <p className="text-xs text-white/60">{currencyIntlFormat(entry.points, 1)} pts</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          entry.prizeClaimed ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/70"
                        }`}
                      >
                        {entry.prizeClaimed ? "Prize claimed" : "Unclaimed"}
                      </span>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${podiumProgress[index] ?? podiumProgress[2]}`}
                        style={{ width: `${Math.min(100, Math.max(12, ratio * 100))}%` }}
                        aria-hidden
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {remainingEntries.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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
                        <tr key={entry.address} className="transition-colors hover:bg-white/5">
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
