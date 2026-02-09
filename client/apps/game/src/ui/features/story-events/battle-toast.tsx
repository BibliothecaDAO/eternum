import Navigation from "lucide-react/dist/esm/icons/navigation";
import X from "lucide-react/dist/esm/icons/x";
import { toast } from "sonner";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { type BattleLocation, formatWinnerName, STORY_EVENT_THEMES } from "./story-event-utils";
import type { StoryEventIcon } from "@bibliothecadao/eternum";

interface BattleToastProps {
  toastId: string | number;
  icon: StoryEventIcon;
  attackerLabel: string;
  defenderLabel: string;
  attackerTroops: string;
  defenderTroops: string;
  winnerLabel?: string;
  location: BattleLocation | null;
  locationLabel: string;
  onNavigate: (location: BattleLocation) => void;
}

export function BattleToast({
  toastId,
  icon,
  attackerLabel,
  defenderLabel,
  attackerTroops,
  defenderTroops,
  winnerLabel,
  location,
  locationLabel,
  onNavigate,
}: BattleToastProps) {
  const theme = STORY_EVENT_THEMES[icon ?? "battle"];
  const Icon = theme.icon;

  return (
    <div className="panel-wood pointer-events-auto overflow-hidden rounded-lg px-3 py-3 text-[11px] leading-tight text-gold shadow-md w-[var(--width)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-gold">
            <Icon className={cn("h-3 w-3 flex-shrink-0", theme.highlight)} aria-hidden />
            <span className="truncate">{attackerLabel}</span>
            <span className="text-gold/60">vs</span>
            <span className="truncate">{defenderLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!location}
            onClick={(evt) => {
              evt.stopPropagation();
              if (!location) return;
              onNavigate(location);
              toast.dismiss(toastId);
            }}
            className={cn(
              "button-wood inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              "border-gold/25 bg-brown/50 text-gold hover:border-gold/45 hover:bg-brown/70",
              !location && "cursor-not-allowed opacity-40 hover:border-gold/25 hover:bg-brown/50",
            )}
          >
            <Navigation className="h-3 w-3" />
            {locationLabel || "Hex"}
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="rounded p-0.5 text-gold/40 hover:text-gold transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1 text-[11px] text-gold/80">
        <div className="leading-snug">
          <span>{attackerTroops}</span>
          <span className="px-1 text-gold/50">vs</span>
          <span>{defenderTroops}</span>
        </div>
        {winnerLabel && <div className="font-semibold text-brilliance">Winner: {formatWinnerName(winnerLabel)}</div>}
      </div>
    </div>
  );
}
