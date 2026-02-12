import { AudioCategory, useAudio, useMusicPlayer, ScrollingTrackName } from "@/audio";
import { useScreenOrientation } from "@bibliothecadao/react";
import Button from "@/ui/design-system/atoms/button";
import { RangeInput } from "@/ui/design-system/atoms";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Maximize2, Minimize2, Music, Volume2, VolumeX, X } from "lucide-react";
import { useState } from "react";

interface LandingSettingsProps {
  onClose: () => void;
  className?: string;
}

/**
 * Simplified settings panel for the landing page.
 * Includes audio controls and basic preferences.
 */
export const LandingSettings = ({ onClose, className }: LandingSettingsProps) => {
  const { setCategoryVolume, setMasterVolume, setMuted, audioState } = useAudio();
  const { trackName, next: nextTrack } = useMusicPlayer();
  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());

  const handleFullScreen = () => {
    toggleFullScreen();
    setFullScreen(!fullScreen);
  };

  // Get volume values with safe defaults
  const masterVolume = audioState?.masterVolume ?? 0.5;
  const isMuted = audioState?.muted ?? false;
  const musicVolume = audioState?.categoryVolumes?.[AudioCategory.MUSIC] ?? 0.4;
  const uiVolume = audioState?.categoryVolumes?.[AudioCategory.UI] ?? 0.5;

  return (
    <div
      className={cn(
        "relative w-full max-w-md",
        "rounded-lg border border-gold/30",
        "bg-black/90 backdrop-blur-md",
        "p-6",
        "shadow-[0_0_60px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-gold">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gold/60 transition-colors hover:bg-gold/10 hover:text-gold"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Divider */}
      <div className="mb-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Audio Section */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/70">
          <Volume2 className="h-4 w-4" />
          Audio
        </h3>

        {/* Master Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gold/60">Master Volume</span>
            <button
              type="button"
              onClick={() => setMuted(!isMuted)}
              className="text-gold/60 transition-colors hover:text-gold"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <RangeInput
            title=""
            value={Math.round(masterVolume * 100)}
            fromTitle="0"
            toTitle="100"
            onChange={(value) => setMasterVolume(value / 100)}
          />
        </div>

        {/* Music Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gold/60">Music</span>
            <span className="text-xs text-gold/40">{Math.round(musicVolume * 100)}%</span>
          </div>
          <RangeInput
            title=""
            value={Math.round(musicVolume * 100)}
            fromTitle="0"
            toTitle="100"
            onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
          />
        </div>

        {/* UI/Sound Effects Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gold/60">Sound Effects</span>
            <span className="text-xs text-gold/40">{Math.round(uiVolume * 100)}%</span>
          </div>
          <RangeInput
            title=""
            value={Math.round(uiVolume * 100)}
            fromTitle="0"
            toTitle="100"
            onChange={(value) => setCategoryVolume(AudioCategory.UI, value / 100)}
          />
        </div>

        {/* Now Playing */}
        {trackName && (
          <div className="flex items-center gap-3 rounded-lg bg-gold/5 p-3">
            <Music className="h-4 w-4 flex-shrink-0 text-gold/60" />
            <div className="min-w-0 flex-1">
              <ScrollingTrackName trackName={trackName} />
            </div>
            <button
              type="button"
              onClick={nextTrack}
              className="text-xs text-gold/60 transition-colors hover:text-gold"
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Display Section */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/70">
          <Maximize2 className="h-4 w-4" />
          Display
        </h3>

        {/* Fullscreen Toggle */}
        <Button
          variant="outline"
          size="md"
          onClick={handleFullScreen}
          className="w-full justify-center gap-2"
          forceUppercase={false}
        >
          {fullScreen ? (
            <>
              <Minimize2 className="h-4 w-4" />
              Exit Fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              Enter Fullscreen
            </>
          )}
        </Button>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gold/40">More settings available in-game</p>
      </div>
    </div>
  );
};
