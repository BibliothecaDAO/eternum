import { useCallback, useRef } from "react";

interface UseClickSoundOptions {
  src: string;
  volume?: number;
  isMobile?: boolean;
}

export const useClickSound = ({ src, volume = 0.5, isMobile = false }: UseClickSoundOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on first use
  const initializeAudio = useCallback(() => {
    // Don't create audio on mobile devices
    if (isMobile || audioRef.current) return;
    
    audioRef.current = new Audio(src);
    audioRef.current.volume = volume;
    audioRef.current.preload = "auto";
  }, [src, volume, isMobile]);

  const playClickSound = useCallback(() => {
    // Don't play audio on mobile devices
    if (isMobile) return;
    
    initializeAudio();

    if (audioRef.current) {
      // Stop any currently playing sound first
      audioRef.current.pause();
      // Reset audio to beginning and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // Silently handle autoplay policy restrictions
        console.debug("Click sound play failed:", error);
      });
    }
  }, [initializeAudio, isMobile]);

  return { playClickSound };
};
