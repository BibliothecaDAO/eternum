import { dir, soundSelector } from "@/hooks/helpers/use-ui-sound";
import { BuildingType } from "@bibliothecadao/types";

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
    [BuildingType.ResourceLabor]: soundSelector.buildLabor,
    [BuildingType.WorkersHut]: soundSelector.buildWorkHut,
    [BuildingType.Storehouse]: soundSelector.buildStorehouse,
    [BuildingType.ResourceAncientFragment]: soundSelector.buildMine,
    [BuildingType.ResourceKnightT1]: soundSelector.buildBarracks,
    [BuildingType.ResourceKnightT2]: soundSelector.buildBarracks,
    [BuildingType.ResourceKnightT3]: soundSelector.buildBarracks,
    [BuildingType.ResourceCrossbowmanT1]: soundSelector.buildArcherRange,
    [BuildingType.ResourceCrossbowmanT2]: soundSelector.buildArcherRange,
    [BuildingType.ResourceCrossbowmanT3]: soundSelector.buildArcherRange,
    [BuildingType.ResourcePaladinT1]: soundSelector.buildStables,
    [BuildingType.ResourcePaladinT2]: soundSelector.buildStables,
    [BuildingType.ResourcePaladinT3]: soundSelector.buildStables,
    [BuildingType.ResourceWheat]: soundSelector.buildFarm,
    [BuildingType.ResourceFish]: soundSelector.buildFishingVillage,
    [BuildingType.ResourceDonkey]: soundSelector.buildMarket,
    [BuildingType.ResourceStone]: soundSelector.buildMine,
    [BuildingType.ResourceCoal]: soundSelector.buildMine,
    [BuildingType.ResourceWood]: soundSelector.buildLumberMill,
    [BuildingType.ResourceCopper]: soundSelector.buildMine,
    [BuildingType.ResourceIronwood]: soundSelector.buildLumberMill,
    [BuildingType.ResourceObsidian]: soundSelector.buildMine,
    [BuildingType.ResourceGold]: soundSelector.buildMine,
    [BuildingType.ResourceSilver]: soundSelector.buildMine,
    [BuildingType.ResourceMithral]: soundSelector.buildMine,
    [BuildingType.ResourceAlchemicalSilver]: soundSelector.buildMine,
    [BuildingType.ResourceColdIron]: soundSelector.buildMine,
    [BuildingType.ResourceDeepCrystal]: soundSelector.buildMine,
    [BuildingType.ResourceRuby]: soundSelector.buildMine,
    [BuildingType.ResourceDiamonds]: soundSelector.buildMine,
    [BuildingType.ResourceHartwood]: soundSelector.buildLumberMill,
    [BuildingType.ResourceIgnium]: soundSelector.buildMageTower,
    [BuildingType.ResourceTwilightQuartz]: soundSelector.buildMageTower,
    [BuildingType.ResourceTrueIce]: soundSelector.buildMageTower,
    [BuildingType.ResourceAdamantine]: soundSelector.buildMageTower,
    [BuildingType.ResourceSapphire]: soundSelector.buildMageTower,
    [BuildingType.ResourceEtherealSilica]: soundSelector.buildMageTower,
    [BuildingType.ResourceDragonhide]: soundSelector.buildMageTower,
  };

  const soundFile =
    buildingType === undefined
      ? soundSelector.buildCastle
      : (buildingSounds[buildingType as BuildingType] ?? soundSelector.buildMine);

  playSound(soundFile, hasSound, volume);
};
