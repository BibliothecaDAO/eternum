import { BuildingType } from "./structures";

export const FELT_CENTER = 2147483646;
export const BUILDINGS_CENTER = [10, 10];
export const DUMMY_HYPERSTRUCTURE_ENTITY_ID = 99999999n;

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
