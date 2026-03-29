import { AudioCategory, formatTrackDisplayName, useAudio, useMusicPlayer } from "@/audio";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { LoaderCircle, Music2, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback } from "react";

export const LandingMusicPlayer = () => {
  const { audioState, setCategoryVolume, setMuted } = useAudio();
  const { currentTrackId, playlist, trackName, next, selectTrack, requiresInteraction, requestStart, isPlaying } =
    useMusicPlayer();
  const setCustomTrack = selectTrack;

  const isMuted = audioState?.muted ?? false;
  const musicVolume = audioState?.categoryVolumes?.[AudioCategory.MUSIC] ?? 0.4;
  const currentTrackLabel = currentTrackId ? trackName : "Awaiting first track";

  const handleTrackSelect = useCallback(
    (trackId: string) => {
      if (requiresInteraction) {
        void requestStart();
      }
      setCustomTrack(trackId);
    },
    [requestStart, requiresInteraction, setCustomTrack],
  );

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
          "pointer-events-auto w-full max-w-md overflow-hidden rounded-[22px] border border-gold/20",
          "bg-black/70 backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
        )}
      >
        <div className="border-b border-gold/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold/55">
                <Music2 className="h-3.5 w-3.5" />
                Dashboard Player
              </div>
              <p className="mt-2 truncate font-cinzel text-base text-gold">{currentTrackLabel}</p>
              <p className="mt-1 text-xs text-gold/55">{requiresInteraction ? "Start music" : "Music ready"}</p>
            </div>

            <div className="flex items-center gap-2">
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
          </div>
        </div>

        <div className="px-4 py-3">
          {requiresInteraction && (
            <button
              type="button"
              onClick={() => void requestStart()}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold transition-colors hover:border-gold/45 hover:bg-gold/15"
            >
              <LoaderCircle className="h-3.5 w-3.5" />
              Start music
            </button>
          )}

          <div className="flex flex-wrap gap-2">
            {playlist.map((trackId) => {
              const isActive = trackId === currentTrackId;

              return (
                <button
                  key={trackId}
                  type="button"
                  onClick={() => handleTrackSelect(trackId)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all",
                    isActive
                      ? "border-gold/55 bg-gold/15 text-gold shadow-[0_0_14px_rgba(223,170,84,0.22)]"
                      : "border-gold/15 bg-black/35 text-gold/60 hover:border-gold/35 hover:text-gold",
                  )}
                  aria-pressed={isActive}
                >
                  {formatTrackDisplayName(trackId)}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3">
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
              {isPlaying ? `${Math.round(musicVolume * 100)}%` : "Idle"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
