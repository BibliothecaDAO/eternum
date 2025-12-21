import { getFactorySqlBaseUrl, isToriiAvailable, setActiveWorldName, buildWorldProfile } from "@/shared/lib/world";
import { Button } from "@/shared/ui/button";
import type { Chain } from "@contracts";
import { RefreshCw, ServerOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { env } from "../../../../env";
import type { FactoryGame, FactoryGameCategory } from "../model/types";
import { decodePaddedFeltAscii, parseMaybeHexToNumber } from "../model/utils";
import { FactoryGameCard } from "./factory-game-card";

interface FactoryGamesListProps {
  className?: string;
  maxHeight?: string;
}

const FactoryGameCardSkeleton = () => (
  <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 p-3">
    <div className="flex flex-1 items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-muted/40" />
      <div className="flex-1 space-y-1">
        <div className="h-4 w-24 rounded bg-muted/40" />
        <div className="h-3 w-32 rounded bg-muted/30" />
      </div>
    </div>
    <div className="h-8 w-16 rounded bg-muted/40" />
  </div>
);

export const FactoryGamesList = ({ className = "", maxHeight = "420px" }: FactoryGamesListProps) => {
  const [games, setGames] = useState<FactoryGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const factorySqlBaseUrl = getFactorySqlBaseUrl(env.VITE_PUBLIC_CHAIN as Chain);
      if (!factorySqlBaseUrl) {
        setGames([]);
        return;
      }

      const query = "SELECT name FROM [wf-WorldDeployed] LIMIT 200;";
      const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Factory query failed: ${response.status} ${response.statusText}`);

      const rows = (await response.json()) as Record<string, unknown>[];
      const names: string[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const feltHex: string | undefined =
          (row?.name as string) ||
          (row?.["data.name"] as string) ||
          ((row?.data as Record<string, unknown>)?.name as string);

        if (!feltHex || typeof feltHex !== "string") continue;

        const decoded = decodePaddedFeltAscii(feltHex);
        if (!decoded || seen.has(decoded)) continue;

        seen.add(decoded);
        names.push(decoded);
      }

      const initial: FactoryGame[] = names.map((name) => ({
        name,
        status: "checking",
        toriiBaseUrl: `https://api.cartridge.gg/x/${name}/torii`,
        startMainAt: null,
        endAt: null,
      }));

      setGames(initial);

      const limit = 8;
      let index = 0;

      const work = async () => {
        while (index < initial.length) {
          const current = initial[index++];

          try {
            const online = await isToriiAvailable(current.toriiBaseUrl);
            let startMainAt: number | null = null;
            let endAt: number | null = null;

            if (online) {
              try {
                const q =
                  'SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at FROM "s1_eternum-WorldConfig" LIMIT 1;';
                const worldUrl = `${current.toriiBaseUrl}/sql?query=${encodeURIComponent(q)}`;
                const worldResponse = await fetch(worldUrl);
                if (worldResponse.ok) {
                  const data = (await worldResponse.json()) as Record<string, unknown>[];
                  const row = data?.[0];
                  if (row?.start_main_at != null) startMainAt = parseMaybeHexToNumber(row.start_main_at);
                  if (row?.end_at != null) endAt = parseMaybeHexToNumber(row.end_at);
                }
              } catch {
                // ignore per-world time errors
              }
            }

            setGames((prev) => {
              const next = [...prev];
              const idx = next.findIndex((item) => item.name === current.name);
              if (idx >= 0) {
                next[idx] = { ...next[idx], status: online ? "ok" : "fail", startMainAt, endAt };
              }
              return next;
            });
          } catch {
            setGames((prev) => {
              const next = [...prev];
              const idx = next.findIndex((item) => item.name === current.name);
              if (idx >= 0) next[idx] = { ...next[idx], status: "fail" };
              return next;
            });
          }
        }
      };

      await Promise.all(Array.from({ length: limit }, () => work()));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load games.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enterGame = async (worldName: string) => {
    try {
      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, worldName);
      setActiveWorldName(worldName);
      window.location.reload();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to switch games.";
      setError(message);
    }
  };

  const categorizeGames = () => {
    const ongoing: FactoryGame[] = [];
    const upcoming: FactoryGame[] = [];
    const ended: FactoryGame[] = [];
    const offline: FactoryGame[] = [];

    for (const game of games) {
      if (game.status !== "ok") {
        offline.push(game);
        continue;
      }

      const start = game.startMainAt;
      const end = game.endAt;
      const isEnded = start != null && end != null && end !== 0 && nowSec >= end;
      const isOngoing = start != null && nowSec >= start && (end == null || end === 0 || nowSec < end);
      const isUpcoming = start != null && nowSec < start;

      if (isOngoing) ongoing.push(game);
      else if (isUpcoming) upcoming.push(game);
      else if (isEnded) ended.push(game);
      else offline.push(game);
    }

    upcoming.sort((a, b) => (a.startMainAt ?? Infinity) - (b.startMainAt ?? Infinity));
    ongoing.sort((a, b) => {
      const aEnd = a.endAt && a.endAt > nowSec ? a.endAt : Infinity;
      const bEnd = b.endAt && b.endAt > nowSec ? b.endAt : Infinity;
      return aEnd - bEnd;
    });
    ended.sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0));

    return { ongoing, upcoming, ended, offline };
  };

  const renderCategory = (title: string, items: FactoryGame[], category: FactoryGameCategory) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{title}</span>
          <span>{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map((game) => (
            <FactoryGameCard key={game.name} game={game} category={category} nowSec={nowSec} onEnter={enterGame} />
          ))}
        </div>
      </div>
    );
  };

  if (loading && games.length === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Loading games...</span>
        </div>
        {[1, 2, 3].map((item) => (
          <FactoryGameCardSkeleton key={item} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center ${className}`}>
        <ServerOff className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={load} size="sm" variant="secondary" className="mt-3">
          <RefreshCw className="mr-2 h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  const { ongoing, upcoming, ended } = categorizeGames();
  const isChecking = games.some((game) => game.status === "checking");
  const empty = ongoing.length === 0 && upcoming.length === 0 && ended.length === 0;

  return (
    <div className={`space-y-4 ${className}`} style={{ maxHeight, overflowY: "auto" }}>
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 pb-2 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          {isChecking ? "Checking servers..." : `${games.filter((game) => game.status === "ok").length} games online`}
        </span>
        <Button onClick={load} size="sm" variant="secondary" disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {empty && !isChecking && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          <ServerOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p>No games found</p>
          <p className="text-xs text-muted-foreground">Try refreshing or check back later</p>
        </div>
      )}

      {renderCategory("Live Now", ongoing, "ongoing")}
      {renderCategory("Starting Soon", upcoming, "upcoming")}
      {renderCategory("Recently Ended", ended, "ended")}
    </div>
  );
};
