// TODO: get all values from core package

export enum CapacityConfigCategory {
  None = 0,
  Structure = 1,
  Donkey = 2,
  Army = 3,
  Storehouse = 4,
}

export enum BuildingType {
  None = 0,
  Castle = 1,
  Resource = 2,
  Farm = 3,
  FishingVillage = 4,
  Barracks1 = 5,
  Barracks2 = 6,
  Barracks3 = 7,
  Market = 8,
  ArcheryRange1 = 9,
  ArcheryRange2 = 10,
  ArcheryRange3 = 11,
  Stable1 = 12,
  Stable2 = 13,
  Stable3 = 14,
  WorkersHut = 15,
  Storehouse = 16,
  Bank = 17,
  FragmentMine = 18,
}

export enum ResourcesIds {
  Stone = 1,
  Coal = 2,
  Wood = 3,
  Copper = 4,
  Ironwood = 5,
  Obsidian = 6,
  Gold = 7,
  Silver = 8,
  Mithral = 9,
  AlchemicalSilver = 10,
  ColdIron = 11,
  DeepCrystal = 12,
  Ruby = 13,
  Diamonds = 14,
  Hartwood = 15,
  Ignium = 16,
  TwilightQuartz = 17,
  TrueIce = 18,
  Adamantine = 19,
  Sapphire = 20,
  EtherealSilica = 21,
  Dragonhide = 22,
  Labor = 23,
  AncientFragment = 24,
  Donkey = 25,
  Knight = 26,
  Crossbowman = 27,
  Paladin = 28,
  Wheat = 29,
  Fish = 30,
  Lords = 31,
}

export interface Resources {
  trait: string;
  value: number;
  colour: string;
  id: number;
  description: string;
  img: string;
  ticker: string;
  rarity?: string;
}

export enum RealmLevels {
  Settlement,
  City,
  Kingdom,
  Empire,
}
