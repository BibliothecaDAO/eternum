import { getIsBlitz } from "@bibliothecadao/eternum";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAssetsByCategory } from "../config/registry";
import { useAudio } from "../hooks/useAudio";
import { AudioCategory } from "../types";

export const useMusicPlayer = () => {
  const { play, audioState, isReady } = useAudio(); // Use audioState instead of getState
  const [currentSource, setCurrentSource] = useState<AudioBufferSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Memoize expensive operations
  const availableTracks = useMemo(() => {
    const musicTracks = getAssetsByCategory(AudioCategory.MUSIC);
    const isBlitz = getIsBlitz();

    return musicTracks.filter((track) => {
      if (isBlitz) {
        return track.id.includes("blitz") || track.id.includes("order_of") || track.id.includes("light_through");
      } else {
        return !track.id.includes("blitz") && !track.id.includes("order_of") && !track.id.includes("light_through");
      }
    });
  }, []); // Empty deps - tracks don't change during runtime

  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => {
    return Math.floor(Math.random() * availableTracks.length);
  });

  const currentTrack = availableTracks[currentTrackIndex];

  const advanceToNextTrack = useCallback(() => {
    const nextIndex = (currentTrackIndex + 1) % availableTracks.length;
    setCurrentTrackIndex(nextIndex);
  }, [currentTrackIndex, availableTracks.length]);

  const playTrack = useCallback(
    async (trackId: string) => {
      try {
        if (!audioState?.muted && isReady) {
          const source = await play(trackId, {
            loop: false,
            onComplete: () => {
              setCurrentSource(null);
              setIsPlaying(false);
              advanceToNextTrack();
            },
          });

          if (source) {
            setCurrentSource(source);
            setIsPlaying(true);
          }
        }
      } catch (error) {
        console.error("Failed to play track:", error);
        setIsPlaying(false);
      }
    },
    [play, audioState?.muted, isReady, advanceToNextTrack],
  );

  const nextTrack = useCallback(() => {
    if (currentSource) {
      currentSource.stop();
      setCurrentSource(null);
      setIsPlaying(false);
    }
    advanceToNextTrack();
  }, [currentSource, advanceToNextTrack]);

  // Auto-start music when system is ready - simple version
  useEffect(() => {
    if (isReady && currentTrack && !isPlaying) {
      playTrack(currentTrack.id);
    }
  }, [isReady, currentTrack?.id, playTrack, isPlaying]);

  // Handle mute/unmute - fixed
  useEffect(() => {
    if (audioState?.muted && currentSource) {
      currentSource.stop();
      setCurrentSource(null);
      setIsPlaying(false);
    }
  }, [audioState?.muted, currentSource]);

  const getTrackDisplayName = (track: typeof currentTrack) => {
    if (!track) return "Loading...";

    // Convert track ID to display name
    const name = track.id
      .replace("music.", "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    return name;
  };

  return {
    trackName: getTrackDisplayName(currentTrack),
    next: nextTrack,
    isPlaying: isPlaying && isReady,
    isReady,
  };
};

export const ScrollingTrackName = ({ trackName }: { trackName: string }) => {
  const trackNameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trackNameElement = trackNameRef.current;
    if (!trackNameElement) return;

    const trackNameWidth = trackNameElement.offsetWidth;
    const containerWidth = trackNameElement.parentElement?.offsetWidth || 0;

    if (trackNameWidth > containerWidth) {
      trackNameElement.style.animationDuration = `${trackNameWidth / 20}s`;
      trackNameElement.classList.add("scrolling");
    }
  }, [trackName]);

  const isBlitz = getIsBlitz();

  return (
    <div className="w-full p-1 overflow-hidden text-xs border border-gold">
      <div className="track-name" ref={trackNameRef}>
        {trackName} - {isBlitz ? "The Minstrels" : "Casey Wescott"}
      </div>
    </div>
  );
};
