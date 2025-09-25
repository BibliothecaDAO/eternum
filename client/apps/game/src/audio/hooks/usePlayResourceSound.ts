import { useCallback } from "react";
import { ResourcesIds } from "@bibliothecadao/types";
import { getResourceSoundId } from "@/three/sound/utils";
import { useAudio } from "./useAudio";

/**
 * Hook for playing resource-specific sounds
 */
export function usePlayResourceSound() {
  const { play } = useAudio();

  const playResourceSound = useCallback(
    (resourceId: ResourcesIds | undefined) => {
      const soundId = getResourceSoundId(resourceId);
      play(soundId).catch(console.error);
    },
    [play],
  );

  return { playResourceSound };
}
