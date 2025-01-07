import { ResourceInputs } from "../types";
import { ResourcesIds } from "./index";
import { BuildingType } from "./structures";

export const BUILDING_INFORMATION: {
  [key: number]: string;
} = {
  [BuildingType.Castle]: "Where the heart of your realm beats, the Castle is the foundation of your kingdom.",
  [BuildingType.Bank]: "Banks, where the wealth of the land flows, store the riches of your realm.",
  [BuildingType.FragmentMine]: "Fragment Mines, where the earth's magic is harnessed, produce Ancient Fragments.",
  [BuildingType.Resource]: "Resource buildings, harnessing the land's magic, produce essential resources.",
  [BuildingType.Farm]: "Enchanted Farms, blessed by Gaia, yield golden wheat.",
  [BuildingType.FishingVillage]:
    "Mystical Fishing Villages, guided by the Moon, harvest the bounty of the seas of Fish",
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

export const BUILDING_CAPACITY: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
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

export const BUILDING_POPULATION: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
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

export const BUILDING_RESOURCE_PRODUCED: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
  [BuildingType.Castle]: 0,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: ResourcesIds.AncientFragment,
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
  [BuildingType.None]: [],
  [BuildingType.Castle]: [],
  [BuildingType.Bank]: [],
  [BuildingType.FragmentMine]: [],
  [BuildingType.Resource]: [],
  [BuildingType.Farm]: [{ resource: ResourcesIds.Fish, amount: 450 }],
  [BuildingType.FishingVillage]: [{ resource: ResourcesIds.Wheat, amount: 450 }],

  [BuildingType.Market]: [
    { resource: ResourcesIds.Fish, amount: 750 },
    { resource: ResourcesIds.Stone, amount: 125 },
    { resource: ResourcesIds.Obsidian, amount: 50 },
    { resource: ResourcesIds.Ruby, amount: 25 },
    { resource: ResourcesIds.DeepCrystal, amount: 5 },
  ],
  [BuildingType.Barracks]: [
    { resource: ResourcesIds.Wheat, amount: 1000 },
    { resource: ResourcesIds.Wood, amount: 75 },
    { resource: ResourcesIds.Coal, amount: 75 },
    { resource: ResourcesIds.Silver, amount: 50 },
    { resource: ResourcesIds.Gold, amount: 45 },
  ],
  [BuildingType.ArcheryRange]: [
    { resource: ResourcesIds.Fish, amount: 1000 },
    { resource: ResourcesIds.Wood, amount: 75 },
    { resource: ResourcesIds.Obsidian, amount: 75 },
    { resource: ResourcesIds.Gold, amount: 25 },
    { resource: ResourcesIds.Hartwood, amount: 25 },
  ],
  [BuildingType.Stable]: [
    { resource: ResourcesIds.Wheat, amount: 1000 },
    { resource: ResourcesIds.Wood, amount: 75 },
    { resource: ResourcesIds.Silver, amount: 75 },
    { resource: ResourcesIds.Ironwood, amount: 35 },
    { resource: ResourcesIds.Gold, amount: 25 },
  ],
  [BuildingType.TradingPost]: [],
  [BuildingType.WorkersHut]: [
    { resource: ResourcesIds.Wheat, amount: 300 },
    { resource: ResourcesIds.Stone, amount: 75 },
    { resource: ResourcesIds.Wood, amount: 75 },
    { resource: ResourcesIds.Coal, amount: 75 },
  ],
  [BuildingType.WatchTower]: [],
  [BuildingType.Walls]: [],
  [BuildingType.Storehouse]: [
    { resource: ResourcesIds.Fish, amount: 1000 },
    { resource: ResourcesIds.Coal, amount: 75 },
    { resource: ResourcesIds.Stone, amount: 75 },
    { resource: ResourcesIds.Sapphire, amount: 10 },
  ],
};

// Approx creation of a building per Realm

export const BUILDING_DELTA_USAGE: { [key: number]: number } = {
  [BuildingType.Castle]: 1,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: 0,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: 6,
  [BuildingType.FishingVillage]: 6,
  [BuildingType.Barracks]: 3,
  [BuildingType.Market]: 3,
  [BuildingType.ArcheryRange]: 3,
  [BuildingType.Stable]: 3,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 3,
};
