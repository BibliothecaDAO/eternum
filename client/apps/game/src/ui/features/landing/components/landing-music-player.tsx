import { AudioCategory, useAudio, useMusicPlayer } from "@/audio";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Music2, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback } from "react";

export const LandingMusicPlayer = () => {
  const { audioState, setCategoryVolume, setMuted } = useAudio();
  const { currentTrackId, trackName, next, requiresInteraction, requestStart } = useMusicPlayer();

  const isMuted = audioState?.muted ?? false;
  const musicVolume = audioState?.categoryVolumes?.[AudioCategory.MUSIC] ?? 0.4;
  const currentTrackLabel = currentTrackId ? trackName : "Awaiting first track";

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
    <div className="pointer-events-none fixed inset-x-3 bottom-20 z-30 lg:inset-x-auto lg:bottom-6 lg:left-24">
      <section
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-full border border-gold/20",
          "bg-black/70 backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-gold/55">
            <Music2 className="h-4 w-4" />
            <button
              type="button"
              onClick={handleToggleMute}
              className="rounded-full border border-gold/15 bg-black/35 p-2 text-gold/65 transition-colors hover:border-gold/35 hover:text-gold"
              aria-label={isMuted ? "Unmute music" : "Mute music"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-full border border-gold/15 bg-black/35 p-2 text-gold/65 transition-colors hover:border-gold/35 hover:text-gold"
              aria-label="Skip track"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-cinzel text-sm text-gold">{currentTrackLabel}</p>
            <p className="text-[11px] text-gold/45">{requiresInteraction ? "Start music with a control" : "Music"}</p>
          </div>

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
        </div>
      </section>
    </div>
  );
};
