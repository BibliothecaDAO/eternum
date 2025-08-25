import { useCallback, useRef } from "react";

interface UseClickSoundOptions {
  src: string;
  volume?: number;
}

export const useClickSound = ({ src, volume = 0.5 }: UseClickSoundOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on first use
  const initializeAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.volume = volume;
      audioRef.current.preload = "auto";
    }
  }, [src, volume]);

  const playClickSound = useCallback(() => {
    initializeAudio();

    if (audioRef.current) {
      // Reset audio to beginning and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // Silently handle autoplay policy restrictions
        console.debug("Click sound play failed:", error);
      });
    }
  }, [initializeAudio]);

  return { playClickSound };
};
