import { useCallback } from "react";
import { AudioManager } from "../core/AudioManager";
import { AudioCategory } from "../types";

// Ultra-lightweight hook for settings - no state management
export function useSimpleAudio() {
  const manager = AudioManager.getInstance();

  const setMuted = useCallback(
    (muted: boolean) => {
      manager.setMuted(muted);
    },
    [manager],
  );

  const setCategoryVolume = useCallback(
    (category: AudioCategory, volume: number) => {
      manager.setCategoryVolume(category, volume);
    },
    [manager],
  );

  // Get current state synchronously - no reactive updates
  const getCurrentState = useCallback(() => {
    return manager.getState();
  }, [manager]);

  return {
    setMuted,
    setCategoryVolume,
    getCurrentState,
  };
}
