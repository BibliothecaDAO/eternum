import { buildWorldProfile, setActiveWorldName } from "@/shared/lib/world";
import { Button } from "@/shared/ui/button";
import { useFactoryWorldsList } from "@bibliothecadao/react";
import type { Chain } from "@contracts";
import { RefreshCw, ServerOff } from "lucide-react";
import { useState } from "react";
import { env } from "../../../../env";
import type { FactoryGame, FactoryGameCategory } from "../model/types";
import { FactoryGameCard } from "./factory-game-card";

interface FactoryGamesListProps {
  className?: string;
  maxHeight?: string;
  onEnterGame?: (worldName: string) => Promise<void> | void;
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

export const FactoryGamesList = ({ className = "", maxHeight = "420px", onEnterGame }: FactoryGamesListProps) => {
  const {
    games,
    categories,
    loading,
    error: listError,
    refresh,
    nowSec,
  } = useFactoryWorldsList({
    chain: env.VITE_PUBLIC_CHAIN as Chain,
    cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE,
    limit: 200,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? listError;

  const enterGame = async (worldName: string) => {
    try {
      setActionError(null);
      if (onEnterGame) {
        await onEnterGame(worldName);
        return;
      }
      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, worldName);
      setActiveWorldName(worldName);
      window.location.reload();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to switch games.";
      setActionError(message);
    }
  };

  const handleRefresh = () => {
    setActionError(null);
    void refresh();
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
        <Button onClick={handleRefresh} size="sm" variant="secondary" className="mt-3">
          <RefreshCw className="mr-2 h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  const { ongoing, upcoming, ended } = categories;
  const isChecking = games.some((game) => game.status === "checking");
  const empty = ongoing.length === 0 && upcoming.length === 0 && ended.length === 0;

  return (
    <div className={`space-y-4 ${className}`} style={{ maxHeight, overflowY: "auto" }}>
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 pb-2 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          {isChecking ? "Checking servers..." : `${games.filter((game) => game.status === "ok").length} games online`}
        </span>
        <Button onClick={handleRefresh} size="sm" variant="secondary" disabled={loading}>
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
