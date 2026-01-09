import { applyWorldSelection, toriiBaseUrlFromName } from "@/runtime/world";
import Button from "@/ui/design-system/atoms/button";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { getAvailabilityStatus, getWorldKey, useWorldsAvailability } from "@/hooks/use-world-availability";
import type { Chain } from "@contracts";
import { motion } from "framer-motion";
import { RefreshCw, ServerOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { env } from "../../../../../../../env";
import { staggerContainer } from "../animations";
import { FactoryGame, FactoryGameCategory } from "../types";
import { FactoryGameCard, FactoryGameCardSkeleton } from "./FactoryGameCard";

interface FactoryGamesListProps {
  className?: string;
  maxHeight?: string;
}

export const FactoryGamesList = ({ className = "", maxHeight = "400px" }: FactoryGamesListProps) => {
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  // Update current time every second
  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const factoryChains = useMemo<Chain[]>(() => [env.VITE_PUBLIC_CHAIN as Chain], []);
  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds(factoryChains);

  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchAvailability,
  } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0);

  const games: FactoryGame[] = factoryWorlds.map((world) => {
    const worldKey = getWorldKey(world);
    const availability = factoryAvailability.get(worldKey);
    const status = getAvailabilityStatus(availability);
    return {
      name: world.name,
      status,
      toriiBaseUrl: toriiBaseUrlFromName(world.name),
      startMainAt: availability?.meta?.startMainAt ?? null,
      endAt: availability?.meta?.endAt ?? null,
    };
  });

  const loading = factoryWorldsLoading || (factoryWorlds.length > 0 && factoryCheckingAvailability);
  const error = factoryError?.message ?? null;

  const handleRefresh = useCallback(async () => {
    await refetchFactoryWorlds();
    await refetchAvailability();
  }, [refetchFactoryWorlds, refetchAvailability]);

  const enterGame = async (worldName: string) => {
    try {
      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      await applyWorldSelection({ name: worldName, chain }, chain);
      window.location.href = "/play";
    } catch (e) {
      console.error("Failed to enter game", e);
    }
  };

  // Categorize games
  const categorizeGames = () => {
    const ongoing: FactoryGame[] = [];
    const upcoming: FactoryGame[] = [];
    const ended: FactoryGame[] = [];
    const offline: FactoryGame[] = [];

    for (const g of games) {
      if (g.status !== "ok") {
        offline.push(g);
        continue;
      }

      const start = g.startMainAt;
      const end = g.endAt;
      const isEnded = start != null && end != null && end !== 0 && nowSec >= end;
      const isOngoing = start != null && nowSec >= start && (end == null || end === 0 || nowSec < end);
      const isUpcoming = start != null && nowSec < start;

      if (isOngoing) ongoing.push(g);
      else if (isUpcoming) upcoming.push(g);
      else if (isEnded) ended.push(g);
      else offline.push(g);
    }

    // Sort each category
    upcoming.sort((a, b) => (a.startMainAt ?? Infinity) - (b.startMainAt ?? Infinity));
    ongoing.sort((a, b) => {
      const aEnd = a.endAt && a.endAt > nowSec ? a.endAt : Infinity;
      const bEnd = b.endAt && b.endAt > nowSec ? b.endAt : Infinity;
      return aEnd - bEnd;
    });
    ended.sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0));

    return { ongoing, upcoming, ended, offline };
  };

  const { ongoing, upcoming, ended } = categorizeGames();
  const nothing = ongoing.length === 0 && upcoming.length === 0 && ended.length === 0;
  const isChecking = games.some((g) => g.status === "checking");

  // Render category section
  const renderCategory = (title: string, items: FactoryGame[], category: FactoryGameCategory) => {
    if (items.length === 0) return null;

    return (
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gold/80">{title}</span>
          <span className="text-[10px] text-gold/50">({items.length})</span>
        </div>
        {items.map((game) => (
          <FactoryGameCard key={game.name} game={game} category={category} nowSec={nowSec} onEnter={enterGame} />
        ))}
      </motion.div>
    );
  };

  if (loading && games.length === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gold/70">Loading games...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <FactoryGameCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center ${className}`}>
        <ServerOff className="w-8 h-8 mx-auto text-red-400 mb-2" />
        <p className="text-sm text-red-300">{error}</p>
        <Button
          onClick={() => void handleRefresh()}
          size="xs"
          variant="outline"
          className="mt-3"
          forceUppercase={false}
        >
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} style={{ maxHeight, overflowY: "auto" }}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between sticky top-0 bg-brown/90 backdrop-blur-sm py-1 -mt-1 z-10">
        <span className="text-sm text-gold/70">
          {isChecking ? "Checking servers..." : `${games.filter((g) => g.status === "ok").length} games online`}
        </span>
        <Button
          onClick={() => void handleRefresh()}
          size="xs"
          variant="outline"
          forceUppercase={false}
          disabled={loading}
        >
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </div>
        </Button>
      </div>

      {/* Empty state */}
      {nothing && !isChecking && (
        <div className="rounded-lg border-2 border-dashed border-gold/20 p-6 text-center">
          <ServerOff className="w-8 h-8 mx-auto text-gold/40 mb-2" />
          <p className="text-sm text-gold/60">No games found</p>
          <p className="text-xs text-gold/40 mt-1">Try refreshing or check back later</p>
        </div>
      )}

      {/* Game categories */}
      {renderCategory("Live Now", ongoing, "ongoing")}
      {renderCategory("Starting Soon", upcoming, "upcoming")}
      {renderCategory("Recently Ended", ended, "ended")}
    </div>
  );
};
