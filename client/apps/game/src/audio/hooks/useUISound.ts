import { useCallback } from "react";
import { useAudio } from "./useAudio";

// Lightweight hook for playing individual UI sounds
export function useUISound(soundId: string) {
  const { play } = useAudio();

  const playSound = useCallback(() => {
    play(soundId).catch(console.error);
  }, [play, soundId]);

  return playSound;
}
