import Button from "@/ui/design-system/atoms/button";
import { motion } from "framer-motion";
import { Clock, Play, Wifi, WifiOff } from "lucide-react";
import { cardVariants } from "../animations";
import { FactoryGame, FactoryGameCategory } from "../types";
import { formatCountdown } from "../utils";

interface FactoryGameCardProps {
  game: FactoryGame;
  category: FactoryGameCategory;
  nowSec: number;
  onEnter: (name: string) => void;
}

export const FactoryGameCard = ({ game, category, nowSec, onEnter }: FactoryGameCardProps) => {
  const isOnline = game.status === "ok";
  const start = game.startMainAt;
  const end = game.endAt;

  // Determine status badge
  const getStatusBadge = () => {
    if (!isOnline) {
      return { label: "Offline", color: "bg-red-500/20 text-red-300 border-red-500/30" };
    }

    switch (category) {
      case "ongoing":
        return { label: "Live", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
      case "upcoming":
        return { label: "Soon", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
      case "ended":
        return { label: "Ended", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
      default:
        return { label: "Unknown", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
    }
  };

  // Get time subtitle
  const getTimeSubtitle = (): string => {
    if (!isOnline) return "Server unavailable";

    if (start == null) return "";

    if (category === "ongoing") {
      if (end == null || end === 0) return "Ongoing";
      return `Ends in ${formatCountdown(end - nowSec)}`;
    }

    if (category === "upcoming") {
      return `Starts in ${formatCountdown(start - nowSec)}`;
    }

    if (category === "ended" && end != null) {
      return `Ended ${new Date(end * 1000).toLocaleDateString()}`;
    }

    return "";
  };

  const badge = getStatusBadge();
  const subtitle = getTimeSubtitle();

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={isOnline ? "hover" : undefined}
      className={`
        flex items-center justify-between rounded-lg border p-3 transition-colors
        ${isOnline ? "border-gold/20 bg-gold/5 hover:border-gold/40" : "border-red-500/20 bg-red-500/5 opacity-60"}
      `}
    >
      {/* Left side: Game info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Status indicator */}
        <div className="flex-shrink-0">
          {isOnline ? (
            <div className="relative">
              <Wifi className="w-4 h-4 text-emerald-400" />
              {category === "ongoing" && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </div>
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
        </div>

        {/* Game details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-gold font-semibold truncate">{game.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.label}</span>
          </div>
          {subtitle && (
            <div className="flex items-center gap-1 text-[11px] text-gold/60 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{subtitle}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Action button */}
      <Button
        onClick={() => onEnter(game.name)}
        disabled={!isOnline}
        size="xs"
        variant={category === "ongoing" ? "primary" : "outline"}
        forceUppercase={false}
        className="flex-shrink-0 ml-2"
      >
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          <span>Enter</span>
        </div>
      </Button>
    </motion.div>
  );
};

// Loading skeleton for factory game cards
export const FactoryGameCardSkeleton = () => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gold/10 bg-gold/5 p-3 animate-pulse">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-4 h-4 rounded bg-gold/20" />
        <div className="flex-1">
          <div className="h-4 w-24 rounded bg-gold/20 mb-1" />
          <div className="h-3 w-16 rounded bg-gold/10" />
        </div>
      </div>
      <div className="h-7 w-16 rounded bg-gold/20" />
    </div>
  );
};
