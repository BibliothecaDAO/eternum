import { ResourceMiningTypes } from "@/types";
import { BuildingType } from "@bibliothecadao/eternum";

export const FELT_CENTER = 2147483646;

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
export const BUILDING_IMAGES_PATH = {
  [BuildingType.Castle]: "",
  [BuildingType.Bank]: "",
  [BuildingType.FragmentMine]: "",
  [BuildingType.Resource]: BUILD_IMAGES_PREFIX + "mine.png",
  [BuildingType.Farm]: BUILD_IMAGES_PREFIX + "farm.png",
  [BuildingType.FishingVillage]: BUILD_IMAGES_PREFIX + "fishing_village.png",
  [BuildingType.Barracks]: BUILD_IMAGES_PREFIX + "barracks.png",
  [BuildingType.Stable]: BUILD_IMAGES_PREFIX + "stable.png",
  [BuildingType.Market]: BUILD_IMAGES_PREFIX + "market.png",
  [BuildingType.ArcheryRange]: BUILD_IMAGES_PREFIX + "archery.png",
  [BuildingType.TradingPost]: BUILD_IMAGES_PREFIX + "trading_post.png",
  [BuildingType.WorkersHut]: BUILD_IMAGES_PREFIX + "workers_hut.png",
  [BuildingType.WatchTower]: BUILD_IMAGES_PREFIX + "watch_tower.png",
  [BuildingType.Walls]: BUILD_IMAGES_PREFIX + "walls.png",
  [BuildingType.Storehouse]: BUILD_IMAGES_PREFIX + "storehouse.png",
  [ResourceMiningTypes.Forge]: BUILD_IMAGES_PREFIX + "forge.png",
  [ResourceMiningTypes.Mine]: BUILD_IMAGES_PREFIX + "mine.png",
  [ResourceMiningTypes.LumberMill]: BUILD_IMAGES_PREFIX + "lumber_mill.png",
  [ResourceMiningTypes.Dragonhide]: BUILD_IMAGES_PREFIX + "dragonhide.png",
};

export const BuildingThumbs = {
  hex: "/images/buildings/thumb/question.png",
  military: "/images/buildings/thumb/sword.png",
  construction: "/images/buildings/thumb/crane.png",
  trade: "/images/buildings/thumb/trade.png",
  resources: "/images/buildings/thumb/resources.png",
  banks: "/images/buildings/thumb/banks.png",
  worldStructures: "/images/buildings/thumb/world-map.png",
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: "/images/buildings/thumb/world-map.png",
  squire: "/images/buildings/thumb/squire.png",
  question: "/images/buildings/thumb/question-wood.png",
  scale: "/images/buildings/thumb/scale.png",
  settings: "/images/buildings/thumb/settings.png",
  guild: "/images/buildings/thumb/guilds.png",
};
