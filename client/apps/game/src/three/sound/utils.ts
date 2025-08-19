import { AudioManager } from "@/audio/core/AudioManager";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";

export const playSound = (sound: string, hasSound: boolean, volume: number) => {
  const audio = new Audio("/sound/" + sound);
  if (!hasSound) {
    audio.volume = 0;
  } else {
    audio.volume = volume / 100;
  }
  audio.play();
};

export const playBuildingSound = (buildingType: BuildingType | undefined, hasSound: boolean, volume: number) => {
  if (!hasSound) return;

  const buildingSounds: Partial<Record<BuildingType, string>> = {
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

  const soundId =
    buildingType === undefined
      ? "building.construct.castle"
      : (buildingSounds[buildingType as BuildingType] ?? "building.construct.mine");

  AudioManager.getInstance().play(soundId, { volume: volume / 100 });
};

export const playResourceSound = (resourceId: ResourcesIds | undefined, hasSound: boolean, volume: number) => {
  if (!hasSound) return;

  const resourceSounds: Partial<Record<ResourcesIds, string>> = {
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

  const soundId = resourceId === undefined ? "ui.click" : (resourceSounds[resourceId] ?? "ui.click");

  AudioManager.getInstance().play(soundId, { volume: volume / 100 });
};
