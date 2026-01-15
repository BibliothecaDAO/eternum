import { BuildingType } from "./structures";

export const BUILDINGS_CENTER = [10, 10];
export const DUMMY_HYPERSTRUCTURE_ENTITY_ID = 99999999n;

export const BUILDING_INFORMATION: {
  [key: number]: string;
} = {
  [BuildingType.None]: "No building",
  [BuildingType.WorkersHut]:
    "Workers Huts, blessed by the ancestors, expand the heart of your realm allowing for greater capacity.",
  [BuildingType.Storehouse]: "Storehouses, where abundance flows, swell with the wealth of the land.",
  [BuildingType.ResourceStone]: "Stone quarries, carved from ancient mountains, yield precious Stone.",
  [BuildingType.ResourceCoal]: "Coal mines, delving deep into darkness, unearth valuable Coal.",
  [BuildingType.ResourceWood]: "Lumber camps, nestled in mystical forests, harvest enchanted Wood.",
  [BuildingType.ResourceCopper]: "Copper mines, blessed by earth spirits, extract gleaming Copper.",
  [BuildingType.ResourceIronwood]: "Ironwood groves, where metal meets nature, grow mighty Ironwood.",
  [BuildingType.ResourceObsidian]: "Obsidian flows, born of volcanic fury, yield dark Obsidian.",
  [BuildingType.ResourceGold]: "Gold mines, touched by dragon's breath, reveal precious Gold.",
  [BuildingType.ResourceSilver]: "Silver mines, blessed by moonlight, uncover pure Silver.",
  [BuildingType.ResourceMithral]: "Mithral forges, where starlight meets earth, craft legendary Mithral.",
  [BuildingType.ResourceAlchemicalSilver]:
    "Alchemical workshops, where magic transforms metal, create Alchemical Silver.",
  [BuildingType.ResourceColdIron]: "Cold Iron foundries, where winter's bite meets metal, forge Cold Iron.",
  [BuildingType.ResourceDeepCrystal]: "Deep Crystal caves, where earth's heart beats, grow mystical Deep Crystal.",
  [BuildingType.ResourceRuby]: "Ruby mines, where dragon's blood crystallized, yield precious Rubies.",
  [BuildingType.ResourceDiamonds]: "Diamond mines, where starlight turned solid, uncover perfect Diamonds.",
  [BuildingType.ResourceHartwood]: "Hartwood sanctuaries, blessed by ancient spirits, nurture magical Hartwood.",
  [BuildingType.ResourceIgnium]: "Ignium forges, where eternal flames dance, create powerful Ignium.",
  [BuildingType.ResourceTwilightQuartz]: "Twilight caves, where day meets night, grow mysterious Twilight Quartz.",
  [BuildingType.ResourceTrueIce]: "True Ice caverns, where winter sleeps, form eternal True Ice.",
  [BuildingType.ResourceAdamantine]: "Adamantine forges, where legends are born, craft indestructible Adamantine.",
  [BuildingType.ResourceSapphire]: "Sapphire mines, where ocean meets stone, yield perfect Sapphires.",
  [BuildingType.ResourceEtherealSilica]: "Ethereal gardens, where reality thins, crystallize Ethereal Silica.",
  [BuildingType.ResourceDragonhide]: "Dragonhide sanctuaries, where ancient beasts rest, yield mystical Dragonhide.",
  [BuildingType.ResourceLabor]: "Labor camps, where dedicated workers toil, produce valuable Labor.",
  [BuildingType.ResourceAncientFragment]: "Ancient ruins, where history sleeps, reveal powerful Ancient Fragments.",
  [BuildingType.ResourceDonkey]: "Markets, bustling with arcane traders, summon Donkeys for mystical trading.",
  [BuildingType.ResourceKnightT1]: "Tier 1 Barracks, where valor and magic intertwine, train noble Knights.",
  [BuildingType.ResourceKnightT2]: "Tier 2 Barracks, where heroes are forged, train elite Knights.",
  [BuildingType.ResourceKnightT3]: "Tier 3 Barracks, where legends are born, train legendary Knights.",
  [BuildingType.ResourceCrossbowmanT1]:
    "Tier 1 Archery Ranges, under the watchful eyes of elven masters, train Crossbowmen.",
  [BuildingType.ResourceCrossbowmanT2]: "Tier 2 Archery Ranges, where precision meets magic, train elite Crossbowmen.",
  [BuildingType.ResourceCrossbowmanT3]:
    "Tier 3 Archery Ranges, where master archers emerge, train legendary Crossbowmen.",
  [BuildingType.ResourcePaladinT1]: "Tier 1 Stables, infused with ancient spirits, summon valiant Paladins.",
  [BuildingType.ResourcePaladinT2]: "Tier 2 Stables, blessed by holy light, train elite Paladins.",
  [BuildingType.ResourcePaladinT3]: "Tier 3 Stables, where divine power manifests, create legendary Paladins.",
  [BuildingType.ResourceWheat]: "Enchanted Farms, blessed by Gaia, yield golden Wheat.",
  [BuildingType.ResourceFish]: "Mystical Fishing Villages, guided by the Moon, harvest the bounty of Fish.",
};
