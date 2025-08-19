import { useCallback } from "react";
import { ResourcesIds } from "@bibliothecadao/types";
import { useAudio } from "./useAudio";

/**
 * Hook for playing resource-specific sounds
 */
export function usePlayResourceSound() {
  const { play } = useAudio();

  const playResourceSound = useCallback(
    (resourceId: ResourcesIds | undefined) => {
      if (!resourceId) {
        play("ui.click").catch(console.error);
        return;
      }

      // Map resource IDs to sound asset IDs
      const resourceSoundMap: Partial<Record<ResourcesIds, string>> = {
        [ResourcesIds.Wheat]: "resources.wheat.add",
        [ResourcesIds.Fish]: "resources.fish.add",
        [ResourcesIds.Wood]: "resources.wood.add",
        [ResourcesIds.Stone]: "resources.stone.add",
        [ResourcesIds.Coal]: "resources.coal.add",
        [ResourcesIds.Copper]: "resources.copper.add",
        [ResourcesIds.Obsidian]: "resources.obsidian.add",
        [ResourcesIds.Silver]: "resources.silver.add",
        [ResourcesIds.Ironwood]: "resources.ironwood.add",
        [ResourcesIds.ColdIron]: "resources.coldiron.add",
        [ResourcesIds.Gold]: "resources.gold.add",
        [ResourcesIds.Hartwood]: "resources.hartwood.add",
        [ResourcesIds.Diamonds]: "resources.diamonds.add",
        [ResourcesIds.Sapphire]: "resources.sapphire.add",
        [ResourcesIds.Ruby]: "resources.ruby.add",
        [ResourcesIds.DeepCrystal]: "resources.deepcrystal.add",
        [ResourcesIds.Ignium]: "resources.ignium.add",
        [ResourcesIds.EtherealSilica]: "resources.etherealsilica.add",
        [ResourcesIds.TrueIce]: "resources.trueice.add",
        [ResourcesIds.TwilightQuartz]: "resources.twilightquartz.add",
        [ResourcesIds.AlchemicalSilver]: "resources.alchemicalsilver.add",
        [ResourcesIds.Adamantine]: "resources.adamantine.add",
        [ResourcesIds.Mithral]: "resources.mithral.add",
        [ResourcesIds.Dragonhide]: "resources.dragonhide.add",
        [ResourcesIds.Lords]: "resources.lords.add",
      };

      const soundId = resourceSoundMap[resourceId] || "ui.click";
      play(soundId).catch(console.error);
    },
    [play],
  );

  return { playResourceSound };
}
