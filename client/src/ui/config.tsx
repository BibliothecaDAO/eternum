import { BuildingType } from "@bibliothecadao/eternum";

export const DEPTH = 10;
export const HEX_RADIUS = 3;
export const ROWS = 300;
export const COLS = 500;
export const FELT_CENTER = 2147483647;
export const EXPLORE_COLOUR = 0x2563eb;
export const TRAVEL_COLOUR = 0xffce31;
export const CLICKED_HEX_COLOR = 0xff5733;
export const ACCESSIBLE_POSITIONS_COLOUR = 0xffffff;

export enum ResourceMiningTypes {
  Forge = "forge",
  Mine = "mine",
  LumberMill = "lumber_mill",
  Dragonhide = "dragonhide",
}

export const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
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
