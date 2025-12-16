import { AudioManager } from "@/audio/core/AudioManager";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";

const DEFAULT_RESOURCE_SOUND_ID = "ui.click";

export const RESOURCE_SOUND_MAP: Record<ResourcesIds, string> = {
  [ResourcesIds.Stone]: "resource.collect.stone",
  [ResourcesIds.Coal]: "resource.collect.coal",
  [ResourcesIds.Wood]: "resource.collect.wood",
  [ResourcesIds.Copper]: "resource.collect.copper",
  [ResourcesIds.Ironwood]: "resource.collect.ironwood",
  [ResourcesIds.Obsidian]: "resource.collect.obsidian",
  [ResourcesIds.Gold]: "resource.collect.gold",
  [ResourcesIds.Silver]: "resource.collect.silver",
  [ResourcesIds.Mithral]: "resource.collect.mithral",
  [ResourcesIds.AlchemicalSilver]: "resource.collect.alchemical_silver",
  [ResourcesIds.ColdIron]: "resource.collect.cold_iron",
  [ResourcesIds.DeepCrystal]: "resource.collect.deep_crystal",
  [ResourcesIds.Ruby]: "resource.collect.ruby",
  [ResourcesIds.Diamonds]: "resource.collect.diamonds",
  [ResourcesIds.Hartwood]: "resource.collect.hartwood",
  [ResourcesIds.Ignium]: "resource.collect.ignium",
  [ResourcesIds.TwilightQuartz]: "resource.collect.twilight_quartz",
  [ResourcesIds.TrueIce]: "resource.collect.true_ice",
  [ResourcesIds.Adamantine]: "resource.collect.adamantine",
  [ResourcesIds.Sapphire]: "resource.collect.sapphire",
  [ResourcesIds.EtherealSilica]: "resource.collect.ethereal_silica",
  [ResourcesIds.Dragonhide]: "resource.collect.dragonhide",
  [ResourcesIds.Labor]: "resource.collect.stone",
  [ResourcesIds.AncientFragment]: "resource.collect.diamonds",
  [ResourcesIds.Donkey]: "resource.collect.wood",
  [ResourcesIds.Knight]: "resource.collect.stone",
  [ResourcesIds.KnightT2]: "resource.collect.stone",
  [ResourcesIds.KnightT3]: "resource.collect.stone",
  [ResourcesIds.Crossbowman]: "resource.collect.stone",
  [ResourcesIds.CrossbowmanT2]: "resource.collect.stone",
  [ResourcesIds.CrossbowmanT3]: "resource.collect.stone",
  [ResourcesIds.Paladin]: "resource.collect.stone",
  [ResourcesIds.PaladinT2]: "resource.collect.stone",
  [ResourcesIds.PaladinT3]: "resource.collect.stone",
  [ResourcesIds.Wheat]: "resource.collect.wheat",
  [ResourcesIds.Fish]: "resource.collect.fish",
  [ResourcesIds.Lords]: "resource.collect.lords",
  [ResourcesIds.Essence]: "resource.collect.diamonds",
  [ResourcesIds.StaminaRelic1]: "relic.chest",
  [ResourcesIds.StaminaRelic2]: "relic.chest",
  [ResourcesIds.DamageRelic1]: "relic.chest",
  [ResourcesIds.DamageRelic2]: "relic.chest",
  [ResourcesIds.DamageReductionRelic1]: "relic.chest",
  [ResourcesIds.DamageReductionRelic2]: "relic.chest",
  [ResourcesIds.ExplorationRelic1]: "ui.explore",
  [ResourcesIds.ExplorationRelic2]: "ui.explore",
  [ResourcesIds.ExplorationRewardRelic1]: "ui.levelup",
  [ResourcesIds.ExplorationRewardRelic2]: "ui.levelup",
  [ResourcesIds.StructureDamageReductionRelic1]: "building.construct.castle",
  [ResourcesIds.StructureDamageReductionRelic2]: "building.construct.castle",
  [ResourcesIds.ProductionRelic1]: "ui.summon",
  [ResourcesIds.ProductionRelic2]: "ui.summon",
  [ResourcesIds.LaborProductionRelic1]: "ui.shovel",
  [ResourcesIds.LaborProductionRelic2]: "ui.shovel",
  [ResourcesIds.TroopProductionRelic1]: "unit.drum",
  [ResourcesIds.TroopProductionRelic2]: "unit.drum",
};

export const getResourceSoundId = (resourceId?: ResourcesIds): string => {
  if (resourceId === undefined) {
    return DEFAULT_RESOURCE_SOUND_ID;
  }
  return RESOURCE_SOUND_MAP[resourceId] ?? DEFAULT_RESOURCE_SOUND_ID;
};

/**
 * @deprecated Use AudioManager.getInstance().play() directly. This function bypasses the audio system.
 */
export const playSound = (sound: string, hasSound: boolean, volume: number) => {
  const audio = new Audio("/sound/" + sound);
  if (!hasSound) {
    audio.volume = 0;
  } else {
    audio.volume = volume / 100;
  }
  audio.play();
};

const BUILDING_SOUNDS: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceLabor]: "building.construct.military",
  [BuildingType.WorkersHut]: "building.construct.workhut",
  [BuildingType.Storehouse]: "building.construct.storehouse",
  [BuildingType.ResourceAncientFragment]: "building.construct.mine",
  [BuildingType.ResourceKnightT1]: "building.construct.barracks",
  [BuildingType.ResourceKnightT2]: "building.construct.barracks",
  [BuildingType.ResourceKnightT3]: "building.construct.barracks",
  [BuildingType.ResourceCrossbowmanT1]: "building.construct.archer_range",
  [BuildingType.ResourceCrossbowmanT2]: "building.construct.archer_range",
  [BuildingType.ResourceCrossbowmanT3]: "building.construct.archer_range",
  [BuildingType.ResourcePaladinT1]: "building.construct.stables",
  [BuildingType.ResourcePaladinT2]: "building.construct.stables",
  [BuildingType.ResourcePaladinT3]: "building.construct.stables",
  [BuildingType.ResourceWheat]: "building.construct.farm",
  [BuildingType.ResourceFish]: "building.construct.fishing_village",
  [BuildingType.ResourceDonkey]: "building.construct.market",
  [BuildingType.ResourceStone]: "building.construct.mine",
  [BuildingType.ResourceCoal]: "building.construct.mine",
  [BuildingType.ResourceWood]: "building.construct.lumber_mill",
  [BuildingType.ResourceCopper]: "building.construct.mine",
  [BuildingType.ResourceIronwood]: "building.construct.lumber_mill",
  [BuildingType.ResourceObsidian]: "building.construct.mine",
  [BuildingType.ResourceGold]: "building.construct.mine",
  [BuildingType.ResourceSilver]: "building.construct.mine",
  [BuildingType.ResourceMithral]: "building.construct.mine",
  [BuildingType.ResourceAlchemicalSilver]: "building.construct.mine",
  [BuildingType.ResourceColdIron]: "building.construct.mine",
  [BuildingType.ResourceDeepCrystal]: "building.construct.mine",
  [BuildingType.ResourceRuby]: "building.construct.mine",
  [BuildingType.ResourceDiamonds]: "building.construct.mine",
  [BuildingType.ResourceHartwood]: "building.construct.lumber_mill",
  [BuildingType.ResourceIgnium]: "building.construct.mage_tower",
  [BuildingType.ResourceTwilightQuartz]: "building.construct.mage_tower",
  [BuildingType.ResourceTrueIce]: "building.construct.mage_tower",
  [BuildingType.ResourceAdamantine]: "building.construct.mage_tower",
  [BuildingType.ResourceSapphire]: "building.construct.mage_tower",
  [BuildingType.ResourceEtherealSilica]: "building.construct.mage_tower",
  [BuildingType.ResourceDragonhide]: "building.construct.mage_tower",
};

/**
 * Play building construction sound. Uses AudioManager state for muting/volume.
 * No need to pass hasSound/volume - AudioManager handles it via category volumes.
 */
export const playBuildingSound = (buildingType: BuildingType | undefined) => {
  const soundId =
    buildingType === undefined
      ? "building.construct.castle"
      : (BUILDING_SOUNDS[buildingType as BuildingType] ?? "building.construct.mine");

  // AudioManager handles muted state and category volumes internally
  AudioManager.getInstance().play(soundId);
};

/**
 * Play resource collection sound. Uses AudioManager state for muting/volume.
 * No need to pass hasSound/volume - AudioManager handles it via category volumes.
 */
export const playResourceSound = (resourceId: ResourcesIds | undefined) => {
  const soundId = getResourceSoundId(resourceId);

  // AudioManager handles muted state and category volumes internally
  AudioManager.getInstance().play(soundId);
};
