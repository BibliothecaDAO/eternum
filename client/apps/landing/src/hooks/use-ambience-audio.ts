import { useEffect, useRef } from "react";

interface UseAmbienceAudioOptions {
  src: string;
  volume?: number;
  quietVolume?: number;
  loop?: boolean;
  mute?: boolean;
}

export const useAmbienceAudio = ({
  src,
  volume = 0.4,
  quietVolume = 0.1,
  loop = true,
  mute = false,
}: UseAmbienceAudioOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Don't create audio on mobile devices
    if (mute) return;

    audioRef.current = new Audio(src);
    audioRef.current.loop = loop;
    audioRef.current.volume = volume;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [src, loop, volume, mute]);

  const play = async () => {
    // Don't play audio on mobile devices
    if (mute || !audioRef.current || isPlayingRef.current) return;

    try {
      await audioRef.current.play();
      isPlayingRef.current = true;
    } catch (error) {
      console.warn("Ambience audio autoplay failed:", error);
    }
  };

  const pause = () => {
    if (mute || !audioRef.current) return;
    audioRef.current.pause();
    isPlayingRef.current = false;
  };

  const stop = () => {
    if (mute || !audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    isPlayingRef.current = false;
  };

  const setVolume = (newVolume: number) => {
    if (mute || !audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, newVolume));
  };

  const fadeToQuiet = (duration = 500) => {
    if (mute || !audioRef.current) return;

    const startVolume = audioRef.current.volume;
    const startTime = Date.now();

    const fade = () => {
      if (!audioRef.current) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentVolume = startVolume + (quietVolume - startVolume) * progress;

      audioRef.current.volume = currentVolume;

      if (progress < 1) {
        requestAnimationFrame(fade);
      }
    };

    fade();
  };

  const fadeToNormal = (duration = 500) => {
    if (mute || !audioRef.current) return;

    const startVolume = audioRef.current.volume;
    const startTime = Date.now();

    const fade = () => {
      if (!audioRef.current) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentVolume = startVolume + (volume - startVolume) * progress;

      audioRef.current.volume = currentVolume;

      if (progress < 1) {
        requestAnimationFrame(fade);
      }
    };

    fade();
  };

  return {
    play,
    pause,
    stop,
    setVolume,
    fadeToQuiet,
    fadeToNormal,
    isPlaying: isPlayingRef.current,
  };
};
