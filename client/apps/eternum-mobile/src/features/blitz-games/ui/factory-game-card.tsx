import { Button } from "@/shared/ui/button";
import { Clock, Play, Wifi, WifiOff } from "lucide-react";
import type { FactoryGame, FactoryGameCategory } from "../model/types";
import { formatCountdown } from "../model/utils";

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

  const badge = (() => {
    if (!isOnline) {
      return { label: "Offline", className: "border-red-300/40 bg-red-200/10 text-red-200" };
    }

    switch (category) {
      case "ongoing":
        return { label: "Live", className: "border-emerald-300/40 bg-emerald-200/10 text-emerald-200" };
      case "upcoming":
        return { label: "Soon", className: "border-amber-300/40 bg-amber-200/10 text-amber-200" };
      case "ended":
        return { label: "Ended", className: "border-muted/60 bg-muted/20 text-muted-foreground" };
      default:
        return { label: "Unknown", className: "border-muted/60 bg-muted/20 text-muted-foreground" };
    }
  })();

  const subtitle = (() => {
    if (!isOnline) return "Server unavailable";
    if (start == null) return "";
    if (category === "ongoing") {
      if (end == null || end === 0) return "Ongoing";
      return `Ends in ${formatCountdown(end - nowSec)}`;
    }
    if (category === "upcoming") return `Starts in ${formatCountdown(start - nowSec)}`;
    if (category === "ended" && end != null) return `Ended ${new Date(end * 1000).toLocaleDateString()}`;
    return "";
  })();

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        isOnline ? "border-border/50 bg-card/80" : "border-red-300/30 bg-red-200/5 opacity-70"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-muted/40">
          {isOnline ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{game.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          {subtitle ? (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{subtitle}</span>
            </div>
          ) : null}
        </div>
      </div>

      <Button
        size="sm"
        variant={category === "ongoing" ? "default" : "secondary"}
        disabled={!isOnline}
        onClick={() => onEnter(game.name)}
        className="ml-3"
      >
        <Play className="mr-1 h-3 w-3" />
        Enter
      </Button>
    </div>
  );
};
