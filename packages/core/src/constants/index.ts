export * from "./buildings";
export * from "./hex";
export * from "./ids";
export * from "./market";
export * from "./misc";
export * from "./orders";
export * from "./quests";
export * from "./realmLevels";
export * from "./resources";
export * from "./structures";
export * from "./troops";
export * from "./utils";

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
  // Demonhide = 23,
  AncientFragment = 24,
  Donkey = 25,
  Knight = 26,
  Crossbowman = 27,
  Paladin = 28,
  Wheat = 29,
  Fish = 30,
  Lords = 31,
}

export enum LaborIds {
  Stone = 255 - ResourcesIds.Stone,
  Coal = 255 - ResourcesIds.Coal,
  Wood = 255 - ResourcesIds.Wood,
  Copper = 255 - ResourcesIds.Copper,
  Ironwood = 255 - ResourcesIds.Ironwood,
  Obsidian = 255 - ResourcesIds.Obsidian,
  Gold = 255 - ResourcesIds.Gold,
  Silver = 255 - ResourcesIds.Silver,
  Mithral = 255 - ResourcesIds.Mithral,
  AlchemicalSilver = 255 - ResourcesIds.AlchemicalSilver,
  ColdIron = 255 - ResourcesIds.ColdIron,
  DeepCrystal = 255 - ResourcesIds.DeepCrystal,
  Ruby = 255 - ResourcesIds.Ruby,
  Diamonds = 255 - ResourcesIds.Diamonds,
  Hartwood = 255 - ResourcesIds.Hartwood,
  Ignium = 255 - ResourcesIds.Ignium,
  TwilightQuartz = 255 - ResourcesIds.TwilightQuartz,
  TrueIce = 255 - ResourcesIds.TrueIce,
  Adamantine = 255 - ResourcesIds.Adamantine,
  Sapphire = 255 - ResourcesIds.Sapphire,
  EtherealSilica = 255 - ResourcesIds.EtherealSilica,
  Dragonhide = 255 - ResourcesIds.Dragonhide,
  Donkey = 255 - ResourcesIds.Donkey,
  Knight = 255 - ResourcesIds.Knight,
  Crossbowman = 255 - ResourcesIds.Crossbowman,
  Paladin = 255 - ResourcesIds.Paladin,
}
