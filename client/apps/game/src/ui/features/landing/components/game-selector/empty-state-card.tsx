import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Sword } from "lucide-react";

interface SeasonInfo {
  name: string;
  description?: string;
  startDate?: string;
  playerCount?: number;
}

interface EmptyStateCardProps {
  season?: SeasonInfo;
  onJoin: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Empty state card shown when user has no active games.
 * Displays current season info with a "Join Season" CTA.
 */
export const EmptyStateCard = ({
  season = {
    name: "Blitz Season",
    description: "Join the eternal battle for dominance. Build your realm, raise armies, and conquer your enemies.",
  },
  onJoin,
  isLoading = false,
  className,
}: EmptyStateCardProps) => {
  return (
    <div
      className={cn(
        "relative w-full max-w-md",
        "rounded-lg border border-gold/30",
        "bg-black/70 backdrop-blur-md",
        "p-8",
        "shadow-[0_0_40px_rgba(0,0,0,0.5)]",
        "text-center",
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
          <Sword className="h-8 w-8 text-gold" />
        </div>
      </div>

      {/* Season name */}
      <h2 className="mb-2 font-serif text-2xl font-bold uppercase tracking-wider text-gold">{season.name}</h2>

      {/* Description */}
      {season.description && <p className="mb-6 text-sm leading-relaxed text-gold/70">{season.description}</p>}

      {/* Season stats */}
      <div className="mb-6 flex justify-center gap-8">
        {season.startDate && (
          <div className="text-center">
            <div className="text-xs text-gold/50">Starts</div>
            <div className="font-medium text-gold">{season.startDate}</div>
          </div>
        )}
        {season.playerCount !== undefined && (
          <div className="text-center">
            <div className="text-xs text-gold/50">Players</div>
            <div className="font-medium text-gold">{season.playerCount.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mb-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Join button */}
      <Button variant="gold" size="lg" onClick={onJoin} isLoading={isLoading} className="w-full">
        Join Season
      </Button>

      {/* Subtext */}
      <p className="mt-4 text-xs text-gold/40">Connect your wallet to begin your conquest</p>
    </div>
  );
};
