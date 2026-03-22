import { useAudio } from "@/audio/hooks/useAudio";
import { useCallback } from "react";
import { AssetRarity } from "../utils/cosmetics";

// High rarities that trigger celebration sound
const HIGH_RARITIES: AssetRarity[] = [AssetRarity.Epic, AssetRarity.Legendary, AssetRarity.Mythic];

/**
 * Hook for playing chest opening sound effects.
 * Provides sounds for:
 * - Card reveal completion (standard chime)
 * - High-rarity celebration (victory fanfare)
 */
export function useChestSounds() {
  const { play, isReady } = useAudio();

  const playCompletion = useCallback(
    (highestRarity: AssetRarity) => {
      if (!isReady) return;

      if (HIGH_RARITIES.includes(highestRarity)) {
        play("combat.victory");
      } else {
        play("ui.levelup");
      }
    },
    [isReady, play],
  );

  return {
    playCompletion,
  };
}
