import { AssetRarity } from "../utils/cosmetics";
import { useCallback, useRef } from "react";

// Sound file paths
const SOUNDS = {
  reveal: "/sound/ui/level-up.mp3",
  victory: "/sound/events/battle_victory.mp3",
} as const;

// High rarities that trigger celebration sound
const HIGH_RARITIES: AssetRarity[] = [AssetRarity.Epic, AssetRarity.Legendary, AssetRarity.Mythic];

interface UseChestSoundsOptions {
  enabled?: boolean;
  volume?: number;
}

/**
 * Hook for playing chest opening sound effects.
 * Provides sounds for:
 * - Card reveal completion (standard chime)
 * - High-rarity celebration (victory fanfare)
 */
export function useChestSounds({ enabled = true, volume = 0.5 }: UseChestSoundsOptions = {}) {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Get or create audio element for a sound
  const getAudio = useCallback(
    (src: string): HTMLAudioElement | null => {
      if (!enabled) return null;

      let audio = audioCache.current.get(src);
      if (!audio) {
        audio = new Audio(src);
        audio.volume = volume;
        audio.preload = "auto";
        audioCache.current.set(src, audio);
      }
      return audio;
    },
    [enabled, volume],
  );

  // Play a sound effect
  const playSound = useCallback(
    (src: string, customVolume?: number) => {
      if (!enabled) return;

      const audio = getAudio(src);
      if (!audio) return;

      // Reset and play
      audio.pause();
      audio.currentTime = 0;
      if (customVolume !== undefined) {
        audio.volume = customVolume;
      }
      audio.play().catch(() => {
        // Silently handle autoplay policy restrictions
      });
    },
    [enabled, getAudio],
  );

  // Play reveal completion sound
  const playReveal = useCallback(() => {
    playSound(SOUNDS.reveal, 0.5);
  }, [playSound]);

  // Play victory/celebration sound for high-rarity pulls
  const playVictory = useCallback(() => {
    playSound(SOUNDS.victory, 0.6);
  }, [playSound]);

  // Play appropriate completion sound based on highest rarity
  const playCompletion = useCallback(
    (highestRarity: AssetRarity) => {
      if (HIGH_RARITIES.includes(highestRarity)) {
        playVictory();
      } else {
        playReveal();
      }
    },
    [playReveal, playVictory],
  );

  return {
    playCompletion,
  };
}
