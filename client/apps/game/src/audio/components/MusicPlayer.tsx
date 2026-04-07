import { useEffect, useRef } from "react";
import { useBackgroundMusic } from "../providers/music-router-provider";
import { formatTrackDisplayName } from "../shared/track-display";

export const useMusicPlayer = () => {
  const {
    currentTrackId,
    trackName,
    playlist,
    skip,
    isPlaying,
    isReady,
    requiresInteraction,
    setCustomTrack,
    requestStart,
  } = useBackgroundMusic();

  return {
    currentTrackId,
    trackName,
    playlist,
    next: skip,
    selectTrack: setCustomTrack,
    isPlaying,
    isReady,
    requiresInteraction,
    requestStart,
  };
};

export const ScrollingTrackName = ({ trackName, trackArtist }: { trackName: string; trackArtist?: string }) => {
  const trackNameRef = useRef<HTMLDivElement>(null);

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
        {trackName}
        {trackArtist ? ` - ${trackArtist}` : ""}
      </div>
    </div>
  );
};
