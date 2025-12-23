import { buildWorldProfile, setActiveWorldName } from "@/runtime/world";
import Button from "@/ui/design-system/atoms/button";
import { useFactoryWorldsList } from "@bibliothecadao/react";
import type { Chain } from "@contracts";
import { motion } from "framer-motion";
import { RefreshCw, ServerOff } from "lucide-react";
import { env } from "../../../../../../../env";
import { staggerContainer } from "../animations";
import { FactoryGame, FactoryGameCategory } from "../types";
import { FactoryGameCard, FactoryGameCardSkeleton } from "./FactoryGameCard";

interface FactoryGamesListProps {
  className?: string;
  maxHeight?: string;
}

export const FactoryGamesList = ({ className = "", maxHeight = "400px" }: FactoryGamesListProps) => {
  const { games, categories, loading, error, refresh, nowSec } = useFactoryWorldsList({
    chain: env.VITE_PUBLIC_CHAIN as Chain,
    cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE,
    limit: 200,
  });

  const enterGame = async (worldName: string) => {
    try {
      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, worldName);
      setActiveWorldName(worldName);
      window.location.href = "/play";
    } catch (e) {
      console.error("Failed to enter game", e);
    }
  };

  const { ongoing, upcoming, ended } = categories;
  const nothing = ongoing.length === 0 && upcoming.length === 0 && ended.length === 0;

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

  const isChecking = games.some((g) => g.status === "checking");

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
        <Button onClick={refresh} size="xs" variant="outline" className="mt-3" forceUppercase={false}>
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
        <Button onClick={refresh} size="xs" variant="outline" forceUppercase={false} disabled={loading}>
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
