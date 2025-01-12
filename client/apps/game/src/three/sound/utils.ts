import { dir, soundSelector } from "@/hooks/use-ui-sound";
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
    [BuildingType.Castle]: soundSelector.buildCastle,
    [BuildingType.WorkersHut]: soundSelector.buildWorkHut,
    [BuildingType.WatchTower]: soundSelector.buildMageTower,
    [BuildingType.Storehouse]: soundSelector.buildStorehouse,
    [BuildingType.Bank]: soundSelector.buildLabor,
    [BuildingType.FragmentMine]: soundSelector.buildMine,
    [BuildingType.Barracks]: soundSelector.buildBarracks,
    [BuildingType.ArcheryRange]: soundSelector.buildArcherRange,
    [BuildingType.Stable]: soundSelector.buildStables,
    [BuildingType.Farm]: soundSelector.buildFarm,
    [BuildingType.FishingVillage]: soundSelector.buildFishingVillage,
    [BuildingType.Market]: soundSelector.buildMarket,
  };

  const soundFile =
    buildingType === undefined
      ? soundSelector.buildCastle
      : (buildingSounds[buildingType as BuildingType] ?? soundSelector.buildMine);

  playSound(soundFile, hasSound, volume);
};
