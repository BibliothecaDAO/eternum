import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useEffect, useRef } from "react";
import { useBackgroundMusic } from "../providers/music-router-provider";

export const useMusicPlayer = () => {
  const { trackName, skip, isPlaying, isReady } = useBackgroundMusic();

  return {
    trackName,
    next: skip,
    isPlaying,
    isReady,
  };
};

export const ScrollingTrackName = ({ trackName }: { trackName: string }) => {
  const trackNameRef = useRef<HTMLDivElement>(null);
  const mode = useGameModeConfig();

  useEffect(() => {
    const trackNameElement = trackNameRef.current;
    if (!trackNameElement) return;

    trackNameElement.classList.remove("scrolling");

    const checkScrolling = () => {
      const trackNameWidth = trackNameElement.scrollWidth;
      const containerWidth = trackNameElement.parentElement?.clientWidth || 0;

      if (trackNameWidth > containerWidth) {
        trackNameElement.style.animationDuration = `${trackNameWidth / 20}s`;
        trackNameElement.classList.add("scrolling");
      }
    };

    const timeoutId = setTimeout(checkScrolling, 0);
    return () => clearTimeout(timeoutId);
  }, [trackName]);

  return (
    <div className="w-full p-1 overflow-hidden text-xs border border-gold">
      <div className="track-name" ref={trackNameRef}>
        {trackName} - {mode.audio.trackArtist}
      </div>
    </div>
  );
};
