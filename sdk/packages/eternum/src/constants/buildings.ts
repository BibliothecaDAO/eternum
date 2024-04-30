import { BuildingType } from "../utils";
import { ResourcesIds } from "./resources";

export const BASE_POPULATION_CAPACITY = 5;

interface ResourceDescription {
  [key: number]: string;
}

export const BUILDING_INFORMATION: ResourceDescription = {
  [BuildingType.Castle]: "Where the heart of your realm beats, the Castle is the foundation of your kingdom.",
  [BuildingType.Resource]: "Resource buildings, harnessing the land's magic, produce essential resources.",
  [BuildingType.Farm]: "Enchanted Farms, blessed by Gaia, yield golden wheat.",
  [BuildingType.FishingVillage]: "Mystical Fishing Villages, guided by the Moon, harvest the bounty of the seas.",
  [BuildingType.Barracks]: "Barracks, where valor and magic intertwine, train noble Knights.",
  [BuildingType.Market]: "Markets, bustling with arcane traders, summon Donkeys for mystical trading.",
  [BuildingType.ArcheryRange]: "Archery Ranges, under the watchful eyes of elven masters, train Crossbow men.",
  [BuildingType.Stable]: "Stables, infused with ancient spirits, summon valiant Paladins.",
  [BuildingType.DonkeyFarm]: "Enigmatic Donkey Farms, where earth meets sky, mystically produce donkeys.",
  [BuildingType.TradingPost]: "Trading Posts, at the crossroads of destiny, expand the horizons of trade.",
  [BuildingType.WorkersHut]:
    "Workers Huts, blessed by the ancestors, expand the heart of your realm allowing for greater capacity.",
  [BuildingType.WatchTower]: "Watch Towers, piercing the veils of fog, extend the gaze of your kingdom.",
  [BuildingType.Walls]: "Walls, imbued with the strength of titans, fortify your domain against the shadows.",
  [BuildingType.Storehouse]: "Storehouses, where abundance flows, swell with the wealth of the land.",
};

export const BUILDING_CAPACITY: { [key: number]: number } = {
  [BuildingType.Castle]: 5,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: 0,
  [BuildingType.FishingVillage]: 0,
  [BuildingType.Barracks]: 0,
  [BuildingType.Market]: 0,
  [BuildingType.ArcheryRange]: 0,
  [BuildingType.Stable]: 0,
  [BuildingType.DonkeyFarm]: 0,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 5,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};

export const BUILDING_POPULATION: { [key: number]: number } = {
  [BuildingType.Castle]: 0,
  [BuildingType.Resource]: 2,
  [BuildingType.Farm]: 1,
  [BuildingType.FishingVillage]: 1,
  [BuildingType.Barracks]: 2,
  [BuildingType.Market]: 3,
  [BuildingType.ArcheryRange]: 2,
  [BuildingType.Stable]: 3,
  [BuildingType.DonkeyFarm]: 2,
  [BuildingType.TradingPost]: 2,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 2,
  [BuildingType.Walls]: 2,
  [BuildingType.Storehouse]: 2,
};

export const BUILDING_PRODUCTION_PER_TICK: { [key: number]: number } = {
  [BuildingType.Resource]: 10,
  [BuildingType.Farm]: 30,
  [BuildingType.FishingVillage]: 30,
  [BuildingType.Barracks]: 2,
  [BuildingType.Market]: 3,
  [BuildingType.ArcheryRange]: 2,
  [BuildingType.Stable]: 2,
  [BuildingType.DonkeyFarm]: 0,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};

export const BUILDING_RESOURCE_PRODUCED: { [key: number]: number } = {
  [BuildingType.Castle]: 0,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: ResourcesIds.Wheat,
  [BuildingType.FishingVillage]: ResourcesIds.Fish,
  [BuildingType.Barracks]: ResourcesIds.Knight,
  [BuildingType.Market]: ResourcesIds.Donkey,
  [BuildingType.ArcheryRange]: ResourcesIds.Crossbowmen,
  [BuildingType.Stable]: ResourcesIds.Paladin,
  [BuildingType.DonkeyFarm]: 0,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};
