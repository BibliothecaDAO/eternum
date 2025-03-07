import { dir, soundSelector } from "@/hooks/helpers/use-ui-sound";
import { BuildingType } from "@bibliothecadao/eternum";

export const playSound = (sound: string, hasSound: boolean, volume: number) => {
  const audio = new Audio(dir + sound);
  if (!hasSound) {
    audio.volume = 0;
  } else {
    audio.volume = volume / 100;
  }
  audio.play();
};

export const playBuildingSound = (buildingType: BuildingType | undefined, hasSound: boolean, volume: number) => {
  const buildingSounds: Partial<Record<BuildingType, string>> = {
    [BuildingType.None]: "",
    [BuildingType.Bank]: soundSelector.buildLabor,
    [BuildingType.ResourceCrossbowmanT1]: soundSelector.buildArcherRange,
    [BuildingType.ResourceCrossbowmanT2]: soundSelector.buildArcherRange,
    [BuildingType.ResourceCrossbowmanT3]: soundSelector.buildArcherRange,
    [BuildingType.ResourcePaladinT1]: soundSelector.buildStables,
    [BuildingType.ResourcePaladinT2]: soundSelector.buildStables,
    [BuildingType.ResourcePaladinT3]: soundSelector.buildStables,
    [BuildingType.ResourceKnightT1]: soundSelector.buildBarracks,
    [BuildingType.ResourceKnightT2]: soundSelector.buildBarracks,
    [BuildingType.ResourceKnightT3]: soundSelector.buildBarracks,
    [BuildingType.ResourceLabor]: soundSelector.buildCastle,
    [BuildingType.ResourceWheat]: soundSelector.buildFarm,
    [BuildingType.ResourceFish]: soundSelector.buildFishingVillage,
    [BuildingType.ResourceEarthenShard]: soundSelector.buildMine,
    [BuildingType.ResourceStone]: "",
    [BuildingType.ResourceCoal]: "",
    [BuildingType.ResourceWood]: "",
    [BuildingType.ResourceCopper]: "",
    [BuildingType.ResourceIronwood]: "",
    [BuildingType.ResourceObsidian]: "",
    [BuildingType.ResourceGold]: "",
    [BuildingType.ResourceSilver]: "",
    [BuildingType.ResourceMithral]:"",
    [BuildingType.ResourceAlchemicalSilver]: "",
    [BuildingType.ResourceColdIron]: "",
    [BuildingType.ResourceDeepCrystal]: "",
    [BuildingType.ResourceRuby]: "",
    [BuildingType.ResourceDiamonds]: "",
    [BuildingType.ResourceHartwood]: "",
    [BuildingType.ResourceIgnium]: "",
    [BuildingType.ResourceTwilightQuartz]: "",
    [BuildingType.ResourceTrueIce]: "",
    [BuildingType.ResourceAdamantine]: "",
    [BuildingType.ResourceSapphire]: "",
    [BuildingType.ResourceEtherealSilica]: "",
    [BuildingType.ResourceDragonhide]: "",
    [BuildingType.ResourceDonkey]: soundSelector.buildMarket,
    [BuildingType.Storehouse]: soundSelector.buildStorehouse,
    [BuildingType.WorkersHut]: soundSelector.buildWorkHut,
  };

  const soundFile =
    buildingType === undefined
      ? soundSelector.buildCastle
      : (buildingSounds[buildingType as BuildingType] ?? soundSelector.buildMine);

  playSound(soundFile, hasSound, volume);
};
