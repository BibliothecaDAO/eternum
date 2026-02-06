import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface GameInfo {
  id: string;
  name: string;
  realmName?: string;
  status: "active" | "ended" | "joining";
  lords?: number;
  troops?: number;
  rank?: number;
  backgroundId: string;
}

interface GameCardProps {
  game: GameInfo;
  onEnter: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Game/realm info card with navigation arrows (Witcher-style location panel).
 */
export const GameCard = ({
  game,
  onEnter,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  isLoading = false,
  className,
}: GameCardProps) => {
  const statusColors = {
    active: "text-brilliance",
    ended: "text-danger",
    joining: "text-orange",
  };

  const statusLabels = {
    active: "Active",
    ended: "Ended",
    joining: "Joining...",
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-md",
        "rounded-lg border border-gold/30",
        "bg-black/70 backdrop-blur-md",
        "p-6",
        "shadow-[0_0_40px_rgba(0,0,0,0.5)]",
        // Hover effect
        "transition-all duration-300",
        "hover:border-gold/50 hover:shadow-[0_0_60px_rgba(223,170,84,0.15)]",
        className,
      )}
    >
      {/* Header with navigation arrows */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
            hasPrev ? "text-gold hover:bg-gold/20 hover:scale-110 active:scale-95" : "cursor-not-allowed text-gold/20",
          )}
          aria-label="Previous game"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <h2 className="font-serif text-lg font-semibold uppercase tracking-wider text-gold">{game.name}</h2>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
            hasNext ? "text-gold hover:bg-gold/20 hover:scale-110 active:scale-95" : "cursor-not-allowed text-gold/20",
          )}
          aria-label="Next game"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Divider with glow effect */}
      <div className="relative mb-4">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent blur-sm" />
      </div>

      {/* Game details */}
      <div className="mb-6 space-y-3">
        {game.realmName && (
          <div className="flex items-center justify-between group">
            <span className="text-sm text-gold/50 transition-colors group-hover:text-gold/70">Realm</span>
            <span className="font-medium text-gold">{game.realmName}</span>
          </div>
        )}

        <div className="flex items-center justify-between group">
          <span className="text-sm text-gold/50 transition-colors group-hover:text-gold/70">Status</span>
          <span className={cn("flex items-center gap-2 font-medium", statusColors[game.status])}>
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                game.status === "active" && "bg-brilliance animate-pulse shadow-[0_0_8px_rgba(125,255,186,0.5)]",
                game.status === "ended" && "bg-danger",
                game.status === "joining" && "bg-orange animate-pulse shadow-[0_0_8px_rgba(254,153,60,0.5)]",
              )}
            />
            {statusLabels[game.status]}
          </span>
        </div>

        {game.lords !== undefined && (
          <div className="flex items-center justify-between group">
            <span className="text-sm text-gold/50 transition-colors group-hover:text-gold/70">Lords</span>
            <span className="font-medium text-gold tabular-nums">{game.lords.toLocaleString()}</span>
          </div>
        )}

        {game.troops !== undefined && (
          <div className="flex items-center justify-between group">
            <span className="text-sm text-gold/50 transition-colors group-hover:text-gold/70">Armies</span>
            <span className="font-medium text-gold tabular-nums">{game.troops}</span>
          </div>
        )}

        {game.rank !== undefined && (
          <div className="flex items-center justify-between group">
            <span className="text-sm text-gold/50 transition-colors group-hover:text-gold/70">Rank</span>
            <span className="font-medium text-gold tabular-nums">#{game.rank}</span>
          </div>
        )}
      </div>

      {/* Enter button */}
      <Button
        variant="gold"
        size="lg"
        onClick={onEnter}
        isLoading={isLoading}
        disabled={game.status === "ended"}
        className={cn(
          "w-full transition-all duration-200",
          game.status !== "ended" && "hover:scale-[1.02] active:scale-[0.98]",
        )}
      >
        {game.status === "ended" ? "Game Ended" : "Enter World"}
      </Button>
    </div>
  );
};
