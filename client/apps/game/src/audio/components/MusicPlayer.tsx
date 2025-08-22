import { getIsBlitz } from "@bibliothecadao/eternum";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAssetsByCategory } from "../config/registry";
import { useAudio } from "../hooks/useAudio";
import { AudioCategory } from "../types";

export const useMusicPlayer = () => {
  const { play, audioState, isReady } = useAudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const availableTracks = useMemo(() => {
    const musicTracks = getAssetsByCategory(AudioCategory.MUSIC);
    const isBlitz = getIsBlitz();
    return musicTracks.filter((track) => {
      if (isBlitz)
        return track.id.includes("blitz") || track.id.includes("order_of") || track.id.includes("light_through");
      return !track.id.includes("blitz") && !track.id.includes("order_of") && !track.id.includes("light_through");
    });
  }, []);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() =>
    availableTracks.length > 0 ? Math.floor(Math.random() * availableTracks.length) : 0,
  );
  const currentTrack = availableTracks[currentTrackIndex];
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const requestIdRef = useRef(0);
  const startPlayRef = useRef<(index: number) => void>(() => {});

  const stopCurrent = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlay = useCallback(
    async (index: number) => {
      if (!isReady || audioState?.muted) return;
      const track = availableTracks[index];
      if (!track) return;
      requestIdRef.current += 1;
      const rid = requestIdRef.current;
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {}
        sourceRef.current = null;
      }
      setCurrentTrackIndex(index);
      setIsPlaying(false);
      const source = await play(track.id, {
        loop: false,
        onComplete: () => {
          if (rid !== requestIdRef.current) return;
          sourceRef.current = null;
          setIsPlaying(false);
          const nextIndex = (index + 1) % availableTracks.length;
          startPlayRef.current(nextIndex);
        },
      });
      if (!source) return;
      if (rid !== requestIdRef.current) {
        try {
          source.stop();
        } catch {}
        return;
      }
      sourceRef.current = source;
      setIsPlaying(true);
    },
    [isReady, audioState?.muted, availableTracks, play],
  );

  useEffect(() => {
    startPlayRef.current = startPlay;
  }, [startPlay]);

  const nextTrack = useCallback(() => {
    const nextIndex = (currentTrackIndex + 1) % availableTracks.length;
    startPlayRef.current(nextIndex);
  }, [currentTrackIndex, availableTracks.length]);

  useEffect(() => {
    if (isReady && !audioState?.muted && availableTracks.length > 0 && !sourceRef.current) {
      startPlayRef.current(currentTrackIndex);
    }
  }, [isReady, audioState?.muted, availableTracks.length, currentTrackIndex]);

  useEffect(() => {
    if (audioState?.muted) stopCurrent();
  }, [audioState?.muted, stopCurrent]);

  const getTrackDisplayName = (track: typeof currentTrack) => {
    if (!track) return "Loading...";
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
  const isBlitz = useMemo(() => getIsBlitz(), []);

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
        {trackName} - {isBlitz ? "The Minstrels" : "Casey Wescott"}
      </div>
    </div>
  );
};
