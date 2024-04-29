import { BuildingType } from "../utils";

export const BASE_POPULATION_CAPACITY = 5;

interface ResourceDescription {
  [key: number]: string;
}

export const BUILDING_INFORMATION: ResourceDescription = {
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
