import { CairoCustomEnum } from "starknet";
import { ResourcesIds } from "../constants";

// Knip ignore tag
/** @public */
export enum StructureType {
  Realm = 1,
  Hyperstructure = 2,
  Bank = 3,
  FragmentMine = 4,
  Village = 5
}

export enum BuildingType {
  None = 0,
  WorkersHut = 1,
  Storehouse = 2,
  // Resource Buildings
  ResourceStone = 3,
  ResourceCoal = 4,
  ResourceWood = 5,
  ResourceCopper = 6,
  ResourceIronwood = 7,
  ResourceObsidian = 8,
  ResourceGold = 9,
  ResourceSilver = 10,
  ResourceMithral = 11,
  ResourceAlchemicalSilver = 12,
  ResourceColdIron = 13,
  ResourceDeepCrystal = 14,
  ResourceRuby = 15,
  ResourceDiamonds = 16,
  ResourceHartwood = 17,
  ResourceIgnium = 18,
  ResourceTwilightQuartz = 19,
  ResourceTrueIce = 20,
  ResourceAdamantine = 21,
  ResourceSapphire = 22,
  ResourceEtherealSilica = 23,
  ResourceDragonhide = 24,
  ResourceLabor = 25,
  ResourceEarthenShard = 26,
  ResourceDonkey = 27,
  ResourceKnightT1 = 28,
  ResourceKnightT2 = 29,
  ResourceKnightT3 = 30,
  ResourceCrossbowmanT1 = 31,
  ResourceCrossbowmanT2 = 32,
  ResourceCrossbowmanT3 = 33,
  ResourcePaladinT1 = 34,
  ResourcePaladinT2 = 35,
  ResourcePaladinT3 = 36,
  ResourceWheat = 37,
  ResourceFish = 38,
  Bank = 39
}

export const BuildingEnumToString: Record<BuildingType, string> = {
  [BuildingType.None]: "None",
  [BuildingType.WorkersHut]: "Workers Hut",
  [BuildingType.Storehouse]: "Storehouse",
  [BuildingType.ResourceStone]: "Stone",
  [BuildingType.ResourceCoal]: "Coal",
  [BuildingType.ResourceWood]: "Wood",
  [BuildingType.ResourceCopper]: "Copper",
  [BuildingType.ResourceIronwood]: "Ironwood",
  [BuildingType.ResourceObsidian]: "Obsidian",
  [BuildingType.ResourceGold]: "Gold",
  [BuildingType.ResourceSilver]: "Silver",
  [BuildingType.ResourceMithral]: "Mithral",
  [BuildingType.ResourceAlchemicalSilver]: "Alchemical Silver",
  [BuildingType.ResourceColdIron]: "Cold Iron",
  [BuildingType.ResourceDeepCrystal]: "Deep Crystal",
  [BuildingType.ResourceRuby]: "Ruby",
  [BuildingType.ResourceDiamonds]: "Diamonds",
  [BuildingType.ResourceHartwood]: "Hartwood",
  [BuildingType.ResourceIgnium]: "Ignium",
  [BuildingType.ResourceTwilightQuartz]: "Twilight Quartz",
  [BuildingType.ResourceTrueIce]: "True Ice",
  [BuildingType.ResourceAdamantine]: "Adamantine",
  [BuildingType.ResourceSapphire]: "Sapphire",
  [BuildingType.ResourceEtherealSilica]: "Ethereal Silica",
  [BuildingType.ResourceDragonhide]: "Dragonhide",
  [BuildingType.ResourceLabor]: "Castle",
  [BuildingType.ResourceEarthenShard]: "Fragment Mine",
  [BuildingType.ResourceDonkey]: "Market",
  [BuildingType.ResourceKnightT1]: "Barracks 1",
  [BuildingType.ResourceKnightT2]: "Barracks 2",
  [BuildingType.ResourceKnightT3]: "Barracks 3",
  [BuildingType.ResourceCrossbowmanT1]: "Archery Range 1",
  [BuildingType.ResourceCrossbowmanT2]: "Archery Range 2",
  [BuildingType.ResourceCrossbowmanT3]: "Archery Range 3",
  [BuildingType.ResourcePaladinT1]: "Stable 1",
  [BuildingType.ResourcePaladinT2]: "Stable 2",
  [BuildingType.ResourcePaladinT3]: "Stable 3",
  [BuildingType.ResourceWheat]: "Farm",
  [BuildingType.ResourceFish]: "Fishing Village",
  [BuildingType.Bank]: "Bank",
};



export function getBuildingType(name: BuildingType): CairoCustomEnum {
  switch (name) {
    case BuildingType.None:
      return new CairoCustomEnum({ None: {} });
    case BuildingType.WorkersHut:
      return new CairoCustomEnum({ WorkersHut: {} });
    case BuildingType.Storehouse:
      return new CairoCustomEnum({ Storehouse: {} });
    case BuildingType.ResourceStone:
      return new CairoCustomEnum({ ResourceStone: {} });
    case BuildingType.ResourceCoal:
      return new CairoCustomEnum({ ResourceCoal: {} });
    case BuildingType.ResourceWood:
      return new CairoCustomEnum({ ResourceWood: {} });
    case BuildingType.ResourceCopper:
      return new CairoCustomEnum({ ResourceCopper: {} });
    case BuildingType.ResourceIronwood:
      return new CairoCustomEnum({ ResourceIronwood: {} });
    case BuildingType.ResourceObsidian:
      return new CairoCustomEnum({ ResourceObsidian: {} });
    case BuildingType.ResourceGold:
      return new CairoCustomEnum({ ResourceGold: {} });
    case BuildingType.ResourceSilver:
      return new CairoCustomEnum({ ResourceSilver: {} });
    case BuildingType.ResourceMithral:
      return new CairoCustomEnum({ ResourceMithral: {} });
    case BuildingType.ResourceAlchemicalSilver:
      return new CairoCustomEnum({ ResourceAlchemicalSilver: {} });
    case BuildingType.ResourceColdIron:
      return new CairoCustomEnum({ ResourceColdIron: {} });
    case BuildingType.ResourceDeepCrystal:
      return new CairoCustomEnum({ ResourceDeepCrystal: {} });
    case BuildingType.ResourceRuby:
      return new CairoCustomEnum({ ResourceRuby: {} });
    case BuildingType.ResourceDiamonds:
      return new CairoCustomEnum({ ResourceDiamonds: {} });
    case BuildingType.ResourceHartwood:
      return new CairoCustomEnum({ ResourceHartwood: {} });
    case BuildingType.ResourceIgnium:
      return new CairoCustomEnum({ ResourceIgnium: {} });
    case BuildingType.ResourceTwilightQuartz:
      return new CairoCustomEnum({ ResourceTwilightQuartz: {} });
    case BuildingType.ResourceTrueIce:
      return new CairoCustomEnum({ ResourceTrueIce: {} });
    case BuildingType.ResourceAdamantine:
      return new CairoCustomEnum({ ResourceAdamantine: {} });
    case BuildingType.ResourceSapphire:
      return new CairoCustomEnum({ ResourceSapphire: {} });
    case BuildingType.ResourceEtherealSilica:
      return new CairoCustomEnum({ ResourceEtherealSilica: {} });
    case BuildingType.ResourceDragonhide:
      return new CairoCustomEnum({ ResourceDragonhide: {} });
    case BuildingType.ResourceLabor:
      return new CairoCustomEnum({ ResourceLabor: {} });
    case BuildingType.ResourceEarthenShard:
      return new CairoCustomEnum({ ResourceEarthenShard: {} });
    case BuildingType.ResourceDonkey:
      return new CairoCustomEnum({ ResourceDonkey: {} });
    case BuildingType.ResourceKnightT1:
      return new CairoCustomEnum({ ResourceKnightT1: {} });
    case BuildingType.ResourceKnightT2:
      return new CairoCustomEnum({ ResourceKnightT2: {} });
    case BuildingType.ResourceKnightT3:
      return new CairoCustomEnum({ ResourceKnightT3: {} });
    case BuildingType.ResourceCrossbowmanT1:
      return new CairoCustomEnum({ ResourceCrossbowmanT1: {} });
    case BuildingType.ResourceCrossbowmanT2:
      return new CairoCustomEnum({ ResourceCrossbowmanT2: {} });
    case BuildingType.ResourceCrossbowmanT3:
      return new CairoCustomEnum({ ResourceCrossbowmanT3: {} });
    case BuildingType.ResourcePaladinT1:
      return new CairoCustomEnum({ ResourcePaladinT1: {} });
    case BuildingType.ResourcePaladinT2:
      return new CairoCustomEnum({ ResourcePaladinT2: {} });
    case BuildingType.ResourcePaladinT3:
      return new CairoCustomEnum({ ResourcePaladinT3: {} });
    case BuildingType.ResourceWheat:
      return new CairoCustomEnum({ ResourceWheat: {} });
    case BuildingType.ResourceFish:
      return new CairoCustomEnum({ ResourceFish: {} });
    case BuildingType.Bank:
      return new CairoCustomEnum({ Bank: {} });
  }
}

export function getProducedResource(name: BuildingType): number {
  switch (name) {
    case BuildingType.None:
      return 0;
    case BuildingType.WorkersHut:
      return 0;
    case BuildingType.Storehouse:
      return 0;
    case BuildingType.ResourceStone:
      return ResourcesIds.Stone;
    case BuildingType.ResourceCoal:
      return ResourcesIds.Coal;
    case BuildingType.ResourceWood:
      return ResourcesIds.Wood;
    case BuildingType.ResourceCopper:
      return ResourcesIds.Copper;
    case BuildingType.ResourceIronwood:
      return ResourcesIds.Ironwood;
    case BuildingType.ResourceObsidian:
      return ResourcesIds.Obsidian;
    case BuildingType.ResourceGold:
      return ResourcesIds.Gold;
    case BuildingType.ResourceSilver:
      return ResourcesIds.Silver;
    case BuildingType.ResourceMithral:
      return ResourcesIds.Mithral;
    case BuildingType.ResourceAlchemicalSilver:
      return ResourcesIds.AlchemicalSilver;
    case BuildingType.ResourceColdIron:
      return ResourcesIds.ColdIron;
    case BuildingType.ResourceDeepCrystal:
      return ResourcesIds.DeepCrystal;
    case BuildingType.ResourceRuby:
      return ResourcesIds.Ruby;
    case BuildingType.ResourceDiamonds:
      return ResourcesIds.Diamonds;
    case BuildingType.ResourceHartwood:
      return ResourcesIds.Hartwood;
    case BuildingType.ResourceIgnium:
      return ResourcesIds.Ignium;
    case BuildingType.ResourceTwilightQuartz:
      return ResourcesIds.TwilightQuartz;
    case BuildingType.ResourceTrueIce:
      return ResourcesIds.TrueIce;
    case BuildingType.ResourceAdamantine:
      return ResourcesIds.Adamantine;
    case BuildingType.ResourceSapphire:
      return ResourcesIds.Sapphire;
    case BuildingType.ResourceEtherealSilica:
      return ResourcesIds.EtherealSilica;
    case BuildingType.ResourceDragonhide:
      return ResourcesIds.Dragonhide;
    case BuildingType.ResourceLabor:
      return ResourcesIds.Labor;
    case BuildingType.ResourceEarthenShard:
      return ResourcesIds.AncientFragment;
    case BuildingType.ResourceDonkey:
      return ResourcesIds.Donkey;
    case BuildingType.ResourceKnightT3:
      return ResourcesIds.KnightT3;
    case BuildingType.ResourceFish:
      return ResourcesIds.Fish;
    case BuildingType.ResourceCrossbowmanT3:
      return ResourcesIds.CrossbowmanT3;
    case BuildingType.ResourcePaladinT3:
      return ResourcesIds.PaladinT3;
    case BuildingType.ResourceWheat:
      return ResourcesIds.Wheat;
    case BuildingType.ResourcePaladinT2:
      return ResourcesIds.PaladinT2;
    case BuildingType.ResourcePaladinT1:
      return ResourcesIds.Paladin;
    case BuildingType.ResourceCrossbowmanT2:
      return ResourcesIds.CrossbowmanT2;
    case BuildingType.ResourceCrossbowmanT1:
      return ResourcesIds.Crossbowman;
    case BuildingType.ResourceKnightT2:
      return ResourcesIds.KnightT2;
    case BuildingType.ResourceKnightT1:
      return ResourcesIds.Knight;

    case BuildingType.Bank:
      return 0;

  }
}
export const ResourceIdToBuildingType: Record<number, BuildingType> = {
  [ResourcesIds.Stone]: BuildingType.ResourceStone,
  [ResourcesIds.Coal]: BuildingType.ResourceCoal,
  [ResourcesIds.Wood]: BuildingType.ResourceWood,
  [ResourcesIds.Copper]: BuildingType.ResourceCopper,
  [ResourcesIds.Ironwood]: BuildingType.ResourceIronwood,
  [ResourcesIds.Obsidian]: BuildingType.ResourceObsidian,
  [ResourcesIds.Gold]: BuildingType.ResourceGold,
  [ResourcesIds.Silver]: BuildingType.ResourceSilver,
  [ResourcesIds.Mithral]: BuildingType.ResourceMithral,
  [ResourcesIds.AlchemicalSilver]: BuildingType.ResourceAlchemicalSilver,
  [ResourcesIds.ColdIron]: BuildingType.ResourceColdIron,
  [ResourcesIds.DeepCrystal]: BuildingType.ResourceDeepCrystal,
  [ResourcesIds.Ruby]: BuildingType.ResourceRuby,
  [ResourcesIds.Diamonds]: BuildingType.ResourceDiamonds,
  [ResourcesIds.Hartwood]: BuildingType.ResourceHartwood,
  [ResourcesIds.Ignium]: BuildingType.ResourceIgnium,
  [ResourcesIds.TwilightQuartz]: BuildingType.ResourceTwilightQuartz,
  [ResourcesIds.TrueIce]: BuildingType.ResourceTrueIce,
  [ResourcesIds.Adamantine]: BuildingType.ResourceAdamantine,
  [ResourcesIds.Sapphire]: BuildingType.ResourceSapphire,
  [ResourcesIds.EtherealSilica]: BuildingType.ResourceEtherealSilica,
  [ResourcesIds.Dragonhide]: BuildingType.ResourceDragonhide,
  [ResourcesIds.Labor]: BuildingType.ResourceLabor,
  [ResourcesIds.AncientFragment]: BuildingType.ResourceEarthenShard,
  [ResourcesIds.Donkey]: BuildingType.ResourceDonkey,
  [ResourcesIds.Knight]: BuildingType.ResourceKnightT1,
  [ResourcesIds.Crossbowman]: BuildingType.ResourceCrossbowmanT1, 
  [ResourcesIds.KnightT2]: BuildingType.ResourceKnightT2,
  [ResourcesIds.CrossbowmanT2]: BuildingType.ResourceCrossbowmanT2,
  [ResourcesIds.Paladin]: BuildingType.ResourcePaladinT1,
  [ResourcesIds.PaladinT2]: BuildingType.ResourcePaladinT2,
  [ResourcesIds.PaladinT3]: BuildingType.ResourcePaladinT3,
  [ResourcesIds.Wheat]: BuildingType.ResourceWheat,
  [ResourcesIds.Fish]: BuildingType.ResourceFish,
  [ResourcesIds.KnightT3]: BuildingType.ResourceKnightT3,
  [ResourcesIds.CrossbowmanT3]: BuildingType.ResourceCrossbowmanT3,  
};

export enum CapacityConfig {
  None = 0,
  Structure = 1,
  Donkey = 2,
  Army = 3,
  Storehouse = 4,
}

export const CAPACITY_CONFIG_CATEGORY_STRING_MAP: { [key: string]: number } = {
  None: 0,
  Structure: 1,
  Donkey: 2,
  Army: 3,
  Storehouse: 4,
};

export enum EntityState {
  Traveling,
  WaitingForDeparture,
  Idle,
  WaitingToOffload,
  NotApplicable, // When the entity should not be rendered
}

export function determineEntityState(
  currentBlockTimestamp: number | undefined,
  blocked: boolean | undefined,
  arrivalTime: bigint | undefined,
  hasResources: boolean,
): EntityState {
  const isTraveling =
    !blocked && currentBlockTimestamp !== undefined && arrivalTime !== undefined && arrivalTime > currentBlockTimestamp;
  const isWaitingForDeparture = blocked;
  const isIdle = !isTraveling && !isWaitingForDeparture && !hasResources;
  const isWaitingToOffload = !blocked && !isTraveling && hasResources;

  if (isTraveling) {
    return EntityState.Traveling;
  }
  if (isWaitingForDeparture) {
    return EntityState.WaitingForDeparture;
  }
  if (isIdle) {
    return EntityState.Idle;
  }
  if (isWaitingToOffload) {
    return EntityState.WaitingToOffload;
  }
  return EntityState.Idle; // Default state
}
