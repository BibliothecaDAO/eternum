import { ResourcesIds } from ".";
import { ResourceInputs } from "../types";
import { BuildingType } from "./structures";

export const BUILDING_INFORMATION: {
  [key: number]: string;
} = {
  [BuildingType.Castle]: "Where the heart of your realm beats, the Castle is the foundation of your kingdom.",
  [BuildingType.Bank]: "Banks, where the wealth of the land flows, store the riches of your realm.",
  [BuildingType.FragmentMine]: "Shards Mines, where the earth's magic is harnessed, produce Earthenshards.",
  [BuildingType.Resource]: "Resource buildings, harnessing the land's magic, produce essential resources.",
  [BuildingType.Farm]: "Enchanted Farms, blessed by Gaia, yield golden wheat.",
  [BuildingType.FishingVillage]: "Mystical Fishing Villages, guided by the Moon, harvest the bounty of the seas.",
  [BuildingType.Barracks]: "Barracks, where valor and magic intertwine, train noble Knights.",
  [BuildingType.Market]: "Markets, bustling with arcane traders, summon Donkeys for mystical trading.",
  [BuildingType.ArcheryRange]: "Archery Ranges, under the watchful eyes of elven masters, train Crossbow men.",
  [BuildingType.Stable]: "Stables, infused with ancient spirits, summon valiant Paladins.",
  [BuildingType.TradingPost]: "Trading Posts, at the crossroads of destiny, expand the horizons of trade.",
  [BuildingType.WorkersHut]:
    "Workers Huts, blessed by the ancestors, expand the heart of your realm allowing for greater capacity.",
  [BuildingType.WatchTower]: "Watch Towers, piercing the veils of fog, extend the gaze of your kingdom.",
  [BuildingType.Walls]: "Walls, imbued with the strength of titans, fortify your domain against the shadows.",
  [BuildingType.Storehouse]: "Storehouses, where abundance flows, swell with the wealth of the land.",
};

export const BUILDING_CAPACITY: { [key: number]: number } = {
  [BuildingType.Castle]: 5,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: 0,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: 0,
  [BuildingType.FishingVillage]: 0,
  [BuildingType.Barracks]: 0,
  [BuildingType.Market]: 0,
  [BuildingType.ArcheryRange]: 0,
  [BuildingType.Stable]: 0,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 5,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};

export const BUILDING_POPULATION: { [key: number]: number } = {
  [BuildingType.Castle]: 0,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: 0,
  [BuildingType.Resource]: 2,
  [BuildingType.Farm]: 1,
  [BuildingType.FishingVillage]: 1,
  [BuildingType.Barracks]: 2,
  [BuildingType.Market]: 3,
  [BuildingType.ArcheryRange]: 2,
  [BuildingType.Stable]: 3,
  [BuildingType.TradingPost]: 2,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 2,
  [BuildingType.Walls]: 2,
  [BuildingType.Storehouse]: 2,
};

export const BUILDING_RESOURCE_PRODUCED: { [key: number]: number } = {
  [BuildingType.Castle]: 0,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: ResourcesIds.Earthenshard,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: ResourcesIds.Wheat,
  [BuildingType.FishingVillage]: ResourcesIds.Fish,
  [BuildingType.Barracks]: ResourcesIds.Knight,
  [BuildingType.Market]: ResourcesIds.Donkey,
  [BuildingType.ArcheryRange]: ResourcesIds.Crossbowman,
  [BuildingType.Stable]: ResourcesIds.Paladin,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};

export const BUILDING_COSTS: ResourceInputs = {
  [BuildingType.Castle]: [],
  [BuildingType.Bank]: [],
  [BuildingType.FragmentMine]: [],
  [BuildingType.Resource]: [],
  [BuildingType.Farm]: [{ resource: ResourcesIds.Fish, amount: 900 }],
  [BuildingType.FishingVillage]: [{ resource: ResourcesIds.Wheat, amount: 900 }],

  [BuildingType.Market]: [
    { resource: ResourcesIds.Fish, amount: 1500 },
    { resource: ResourcesIds.Stone, amount: 250 },
    { resource: ResourcesIds.Obsidian, amount: 100 },
    { resource: ResourcesIds.Ruby, amount: 50 },
    { resource: ResourcesIds.DeepCrystal, amount: 10 },
  ],
  [BuildingType.Barracks]: [
    { resource: ResourcesIds.Wheat, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 150 },
    { resource: ResourcesIds.Coal, amount: 150 },
    { resource: ResourcesIds.Silver, amount: 100 },
    { resource: ResourcesIds.Gold, amount: 90 },
  ],
  [BuildingType.ArcheryRange]: [
    { resource: ResourcesIds.Fish, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 150 },
    { resource: ResourcesIds.Obsidian, amount: 150 },
    { resource: ResourcesIds.Gold, amount: 50 },
    { resource: ResourcesIds.Hartwood, amount: 50 },
  ],
  [BuildingType.Stable]: [
    { resource: ResourcesIds.Wheat, amount: 2000 },
    { resource: ResourcesIds.Wood, amount: 150 },
    { resource: ResourcesIds.Silver, amount: 150 },
    { resource: ResourcesIds.Ironwood, amount: 70 },
    { resource: ResourcesIds.Gold, amount: 50 },
  ],
  [BuildingType.TradingPost]: [],
  [BuildingType.WorkersHut]: [
    { resource: ResourcesIds.Wheat, amount: 600 },
    { resource: ResourcesIds.Stone, amount: 150 },
    { resource: ResourcesIds.Wood, amount: 150 },
    { resource: ResourcesIds.Coal, amount: 150 },
  ],
  [BuildingType.WatchTower]: [],
  [BuildingType.Walls]: [],
  [BuildingType.Storehouse]: [
    { resource: ResourcesIds.Fish, amount: 2000 },
    { resource: ResourcesIds.Coal, amount: 150 },
    { resource: ResourcesIds.Stone, amount: 150 },
    { resource: ResourcesIds.Sapphire, amount: 20 },
  ],
};
