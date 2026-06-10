import { AudioCategory, useAudio, useMusicPlayer } from "@/audio";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Music2, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback } from "react";

type LandingMusicPlayerPresentation = "floating" | "header";

interface LandingMusicPlayerProps {
  className?: string;
  presentation?: LandingMusicPlayerPresentation;
}

const resolvePlayerContainerClasses = (presentation: LandingMusicPlayerPresentation) => {
  if (presentation === "header") {
    return "min-w-0 shrink-0";
  }

  return "pointer-events-none fixed inset-x-3 bottom-20 z-30 lg:inset-x-auto lg:bottom-6 lg:left-24";
};

const resolvePlayerShellClasses = (presentation: LandingMusicPlayerPresentation) => {
  if (presentation === "header") {
    return "w-[124px] rounded-full border border-gold/15 bg-black/45 shadow-[0_10px_30px_rgba(0,0,0,0.3)] xl:w-[132px]";
  }

  return "w-full max-w-md rounded-full border border-gold/20 bg-black/70 shadow-[0_18px_70px_rgba(0,0,0,0.55)]";
};

const resolvePlayerRowClasses = (presentation: LandingMusicPlayerPresentation) => {
  if (presentation === "header") {
    return "gap-1.5 px-2.5 py-1.5";
  }

  return "gap-3 px-4 py-3";
};

const resolveControlButtonClasses = (presentation: LandingMusicPlayerPresentation) => {
  if (presentation === "header") {
    return "rounded-full border border-gold/15 bg-black/30 p-1.5 text-gold/65 transition-colors hover:border-gold/35 hover:text-gold";
  }

  return "rounded-full border border-gold/15 bg-black/35 p-2 text-gold/65 transition-colors hover:border-gold/35 hover:text-gold";
};

export const LandingMusicPlayer = ({ className, presentation = "floating" }: LandingMusicPlayerProps) => {
  const { audioState, setCategoryVolume, setMuted } = useAudio();
  const { currentTrackId, trackName, next, requiresInteraction, requestStart } = useMusicPlayer();

  const isMuted = audioState?.muted ?? false;
  const musicVolume = audioState?.categoryVolumes?.[AudioCategory.MUSIC] ?? 0.08;
  const currentTrackLabel = currentTrackId ? trackName : "Awaiting first track";
  const isHeaderPresentation = presentation === "header";

  const handleSkip = useCallback(() => {
    if (requiresInteraction) {
      void requestStart();
      return;
    }
    next();
  }, [next, requestStart, requiresInteraction]);

  const handleToggleMute = useCallback(() => {
    if (requiresInteraction && isMuted) {
      void requestStart();
    }
    setMuted(!isMuted);
  }, [isMuted, requestStart, requiresInteraction, setMuted]);

  return (
    <div className={cn(resolvePlayerContainerClasses(presentation), className)}>
      <section className={cn("pointer-events-auto backdrop-blur-xl", resolvePlayerShellClasses(presentation))}>
        <div className={cn("flex items-center", resolvePlayerRowClasses(presentation))}>
          <div className="flex items-center gap-2 text-gold/55">
            <Music2 className={cn(isHeaderPresentation ? "h-3.5 w-3.5" : "h-4 w-4")} />
            <button
              type="button"
              onClick={handleToggleMute}
              className={resolveControlButtonClasses(presentation)}
              aria-label={isMuted ? "Unmute music" : "Mute music"}
            >
              {isMuted ? (
                <VolumeX className={cn(isHeaderPresentation ? "h-3 w-3" : "h-4 w-4")} />
              ) : (
                <Volume2 className={cn(isHeaderPresentation ? "h-3 w-3" : "h-4 w-4")} />
              )}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className={resolveControlButtonClasses(presentation)}
              aria-label="Skip track"
            >
              <SkipForward className={cn(isHeaderPresentation ? "h-3 w-3" : "h-4 w-4")} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-cinzel text-gold",
                isHeaderPresentation ? "text-[10px] uppercase tracking-[0.14em] text-gold/70" : "text-sm",
              )}
            >
              {isHeaderPresentation ? "Music" : currentTrackLabel}
            </p>
            {!isHeaderPresentation ? (
              <p className="text-[11px] text-gold/45">{requiresInteraction ? "Start music with a control" : "Music"}</p>
            ) : null}
          </div>

          {!isHeaderPresentation ? (
            <div className="flex min-w-[132px] items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(musicVolume * 100)}
                onChange={(event) => setCategoryVolume(AudioCategory.MUSIC, Number(event.target.value) / 100)}
                className="h-1.5 flex-1 cursor-pointer accent-[#dfaa54]"
                aria-label="Music volume"
              />
              <span className="w-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-gold/50">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
