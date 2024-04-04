import useSound from "use-sound";
import useUIStore from "./store/useUIStore";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useCallback, useState } from "react";
import { BuildingType } from "./store/_buildModeStore";

const dir = "/sound/";

export const soundSelector = {
  click: "ui/click.mp3",
  sign: "ui/sign.mp3",
  harvest: "ui/harvest.mp3",
  fly: "ui/whoosh.mp3",
  levelUp: "ui/level-up.mp3",
  explore: "ui/explore.mp3",
  buildLabor: "buildings/workhuts.mp3",
  buildMilitary: "buildings/military.mp3",
  buildCastle: "buildings/castle.mp3",
  buildBarracks: "buildings/barracks.mp3",
  buildArcherRange: "buildings/archer_range.mp3",
  buildMageTower: "buildings/mage_tower.mp3",
  buildWorkHut: "buildings/workhuts.mp3",
  buildFishingVillage: "buildings/fishing_village.mp3",
  buildFarm: "buildings/farm.mp3",
  buildStorehouse: "buildings/storehouse.mp3",
  buildMine: "buildings/mine.mp3",
  buildMarket: "buildings/market.mp3",
  buildStables: "buildings/stables.mp3",
  addWheat: "resources/wheat.mp3",
  addFish: "resources/fish.mp3",
  addWood: "resources/wood.mp3",
  addStone: "resources/stone.mp3",
  addCoal: "resources/coal.mp3",
  addCopper: "resources/copper.mp3",
  addObsidian: "resources/obsidian.mp3",
  addSilver: "resources/silver.mp3",
  addIronwood: "resources/ironwood.mp3",
  addColdIron: "resources/cold_iron.mp3",
  addGold: "resources/gold.mp3",
  addHartwood: "resources/hartwood.mp3",
  addDiamonds: "resources/diamonds.mp3",
  addSapphire: "resources/sapphire.mp3",
  addRuby: "resources/ruby.mp3",
  addDeepCrystal: "resources/deep_crystal.mp3",
  addIgnium: "resources/ignium.mp3",
  addEtherealSilica: "resources/ethereal_silica.mp3",
  addTrueIce: "resources/true_ice.mp3",
  addTwilightQuartz: "resources/twilight_quartz.mp3",
  addAlchemicalSilver: "resources/alchemical_silver.mp3",
  addAdamantine: "resources/adamantine.mp3",
  addMithral: "resources/mithral.mp3",
  addDragonhide: "resources/dragonhide.mp3",
  addLords: "resources/lords.mp3",
  unitRunning: "units/running.mp3",
  unitRunningAlternative: "units/running_2.mp3",
};

export const useUiSounds = (selector: string) => {
  const effectsLevel = useUIStore((state) => state.effectsLevel);
  const isSoundOn = useUIStore((state) => state.isSoundOn);

  const [play, { stop, sound }] = useSound(dir + selector, {
    volume: isSoundOn ? effectsLevel / 100 : 0,
  });

  const fade = useCallback(() => {
    sound && sound.fade(isSoundOn ? effectsLevel / 100 : 0, 0, 250);
  }, [effectsLevel, isSoundOn, sound]);

  return {
    play,
    stop,
    fade,
  };
};

export const usePlayResourceSound = () => {
  const { play: playFarm } = useUiSounds(soundSelector.addWheat);
  const { play: playFishingVillage } = useUiSounds(soundSelector.addFish);
  const { play: playAddWood } = useUiSounds(soundSelector.addWood);
  const { play: playAddStone } = useUiSounds(soundSelector.addStone);
  const { play: playAddCoal } = useUiSounds(soundSelector.addCoal);
  const { play: playAddCopper } = useUiSounds(soundSelector.addCopper);
  const { play: playAddObsidian } = useUiSounds(soundSelector.addObsidian);
  const { play: playAddSilver } = useUiSounds(soundSelector.addSilver);
  const { play: playAddIronwood } = useUiSounds(soundSelector.addIronwood);
  const { play: playAddColdIron } = useUiSounds(soundSelector.addColdIron);
  const { play: playAddGold } = useUiSounds(soundSelector.addGold);
  const { play: playAddHartwood } = useUiSounds(soundSelector.addHartwood);
  const { play: playAddDiamonds } = useUiSounds(soundSelector.addDiamonds);
  const { play: playAddSapphire } = useUiSounds(soundSelector.addSapphire);
  const { play: playAddRuby } = useUiSounds(soundSelector.addRuby);
  const { play: playAddDeepCrystal } = useUiSounds(soundSelector.addDeepCrystal);
  const { play: playAddIgnium } = useUiSounds(soundSelector.addIgnium);
  const { play: playAddEtherealSilica } = useUiSounds(soundSelector.addEtherealSilica);
  const { play: playAddTrueIce } = useUiSounds(soundSelector.addTrueIce);
  const { play: playAddTwilightQuartz } = useUiSounds(soundSelector.addTwilightQuartz);
  const { play: playAddAlchemicalSilver } = useUiSounds(soundSelector.addAlchemicalSilver);
  const { play: playAddAdamantine } = useUiSounds(soundSelector.addAdamantine);
  const { play: playAddMithral } = useUiSounds(soundSelector.addMithral);
  const { play: playAddDragonhide } = useUiSounds(soundSelector.addDragonhide);
  const { play: playAddLords } = useUiSounds(soundSelector.addLords);
  // eslint-disable-next-line sonarjs/no-small-switch
  const playResourceSound = (resourceId: ResourcesIds) => {
    switch (resourceId) {
      case ResourcesIds.Fish:
        playFishingVillage();
        break;
      case ResourcesIds.Wheat:
        playFarm();
        break;
      case ResourcesIds.Wood:
        playAddWood();
        break;
      case ResourcesIds.Stone:
        playAddStone();
        break;
      case ResourcesIds.Coal:
        playAddCoal();
        break;
      case ResourcesIds.Copper:
        playAddCopper();
        break;
      case ResourcesIds.Obsidian:
        playAddObsidian();
        break;
      case ResourcesIds.Silver:
        playAddSilver();
        break;
      case ResourcesIds.Ironwood:
        playAddIronwood();
        break;
      case ResourcesIds.ColdIron:
        playAddColdIron();
        break;
      case ResourcesIds.Gold:
        playAddGold();
        break;
      case ResourcesIds.Hartwood:
        playAddHartwood();
        break;
      case ResourcesIds.Diamonds:
        playAddDiamonds();
        break;
      case ResourcesIds.Sapphire:
        playAddSapphire();
        break;
      case ResourcesIds.Ruby:
        playAddRuby();
        break;
      case ResourcesIds.DeepCrystal:
        playAddDeepCrystal();
        break;
      case ResourcesIds.Ignium:
        playAddIgnium();
        break;
      case ResourcesIds.EtherealSilica:
        playAddEtherealSilica();
        break;
      case ResourcesIds.TrueIce:
        playAddTrueIce();
        break;
      case ResourcesIds.TwilightQuartz:
        playAddTwilightQuartz();
        break;
      case ResourcesIds.AlchemicalSilver:
        playAddAlchemicalSilver();
        break;
      case ResourcesIds.Adamantine:
        playAddAdamantine();
        break;
      case ResourcesIds.Mithral:
        playAddMithral();
        break;
      case ResourcesIds.Dragonhide:
        playAddDragonhide();
        break;
      case ResourcesIds.Lords:
        playAddLords();
        break;
      default:
        break;
    }
  };

  return {
    playResourceSound,
  };
};

export const useRunningSound = () => {
  const { play: playFirst, fade: fadeFirst } = useUiSounds(soundSelector.unitRunning);
  const { play: playSecond, fade: fadeSecond } = useUiSounds(soundSelector.unitRunningAlternative);
  const [isFirst, setIsFirst] = useState(true);

  const play = useCallback(() => {
    if (isFirst) {
      playFirst();
    } else {
      playSecond();
    }
    setIsFirst((prev) => !prev);
  }, [isFirst, playFirst, playSecond]);

  const stop = useCallback(() => {
    fadeFirst();
    fadeSecond();
  }, [fadeFirst, fadeSecond, isFirst]);

  return {
    play,
    stop,
  };
};

export const useBuildingSound = () => {
  const { play: playBuildCastle } = useUiSounds(soundSelector.buildCastle);
  const { play: playBuildFarm } = useUiSounds(soundSelector.buildFarm);
  const { play: playBuildFishingVillage } = useUiSounds(soundSelector.buildFishingVillage);
  const { play: playBuildMine } = useUiSounds(soundSelector.buildMine);
  const { play: playBuildStables } = useUiSounds(soundSelector.buildStables);
  const { play: playBuildWorkHut } = useUiSounds(soundSelector.buildWorkHut);
  const { play: playBuildArcherRange } = useUiSounds(soundSelector.buildArcherRange);
  const { play: playBuildBarracks } = useUiSounds(soundSelector.buildBarracks);
  const { play: playBuildMarket } = useUiSounds(soundSelector.buildMarket);
  const { play: playBuildStorehouse } = useUiSounds(soundSelector.buildStorehouse);

  const playBuildingSound = (buildingType: BuildingType) => {
    switch (buildingType) {
      case BuildingType.Castle:
        playBuildCastle();
        break;
      case BuildingType.Farm:
        playBuildFarm();
        break;
      case BuildingType.Fishery:
        playBuildFishingVillage();
        break;
      case BuildingType.Mine:
        playBuildMine();
        break;
      case BuildingType.Stable:
        playBuildStables();
        break;
      case BuildingType.Workhut:
        playBuildWorkHut();
        break;
      case BuildingType.ArcherRange:
        playBuildArcherRange();
        break;
      case BuildingType.Barracks:
        playBuildBarracks();
        break;
      case BuildingType.Market:
        playBuildMarket();
        break;
      case BuildingType.Storehouse:
        playBuildStorehouse();
        break;
      default:
        break;
    }
  };

  return {
    playBuildingSound,
  };
};
