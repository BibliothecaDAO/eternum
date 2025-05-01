import { CairoCustomEnum } from "starknet";
import { ResourcesIds } from "../constants";

// Knip ignore tag
/** @public */
export enum StructureType {
  Realm = 1,
  Hyperstructure = 2,
  Bank = 3,
  FragmentMine = 4,
  Village = 5,
}

export enum BuildingType {
  None = 0,
  // Non Resource Buildings
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
  ResourceAncientFragment = 26,
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
}

export const BuildingTypeToString: Record<BuildingType, string> = {
  [BuildingType.None]: "None",
  [BuildingType.WorkersHut]: "Workers Hut",
  [BuildingType.Storehouse]: "Storehouse",
  [BuildingType.ResourceStone]: "Stone Resource",
  [BuildingType.ResourceCoal]: "Coal Resource",
  [BuildingType.ResourceWood]: "Wood Resource",
  [BuildingType.ResourceCopper]: "Copper Resource",
  [BuildingType.ResourceIronwood]: "Ironwood Resource",
  [BuildingType.ResourceObsidian]: "Obsidian Resource",
  [BuildingType.ResourceGold]: "Gold Resource",
  [BuildingType.ResourceSilver]: "Silver Resource",
  [BuildingType.ResourceMithral]: "Mithral Resource",
  [BuildingType.ResourceAlchemicalSilver]: "Alchemical Silver Resource",
  [BuildingType.ResourceColdIron]: "Cold Iron Resource",
  [BuildingType.ResourceDeepCrystal]: "Deep Crystal Resource",
  [BuildingType.ResourceRuby]: "Ruby Resource",
  [BuildingType.ResourceDiamonds]: "Diamonds Resource",
  [BuildingType.ResourceHartwood]: "Hartwood Resource",
  [BuildingType.ResourceIgnium]: "Ignium Resource",
  [BuildingType.ResourceTwilightQuartz]: "Twilight Quartz Resource",
  [BuildingType.ResourceTrueIce]: "True Ice Resource",
  [BuildingType.ResourceAdamantine]: "Adamantine Resource",
  [BuildingType.ResourceSapphire]: "Sapphire Resource",
  [BuildingType.ResourceEtherealSilica]: "Ethereal Silica Resource",
  [BuildingType.ResourceDragonhide]: "Dragonhide Resource",
  [BuildingType.ResourceLabor]: "Labor Resource",
  [BuildingType.ResourceAncientFragment]: "Ancient Fragment Resource",
  [BuildingType.ResourceDonkey]: "Market",
  [BuildingType.ResourceKnightT1]: "Knight T1 Resource",
  [BuildingType.ResourceKnightT2]: "Knight T2 Resource",
  [BuildingType.ResourceKnightT3]: "Knight T3 Resource",
  [BuildingType.ResourceCrossbowmanT1]: "Crossbowman T1 Resource",
  [BuildingType.ResourceCrossbowmanT2]: "Crossbowman T2 Resource",
  [BuildingType.ResourceCrossbowmanT3]: "Crossbowman T3 Resource",
  [BuildingType.ResourcePaladinT1]: "Paladin T1 Resource",
  [BuildingType.ResourcePaladinT2]: "Paladin T2 Resource",
  [BuildingType.ResourcePaladinT3]: "Paladin T3 Resource",
  [BuildingType.ResourceWheat]: "Farm",
  [BuildingType.ResourceFish]: "Fishing Village",
};

export function getBuildingCategory(category: BuildingType): CairoCustomEnum {
  return new CairoCustomEnum({ [BuildingTypeToString[category].replace(/\s+/g, "")]: {} });
}

export function getBuildingFromResource(resourceId: ResourcesIds): BuildingType {
  switch (resourceId) {
    case ResourcesIds.Stone:
      return BuildingType.ResourceStone;
    case ResourcesIds.Coal:
      return BuildingType.ResourceCoal;
    case ResourcesIds.Wood:
      return BuildingType.ResourceWood;
    case ResourcesIds.Copper:
      return BuildingType.ResourceCopper;
    case ResourcesIds.Ironwood:
      return BuildingType.ResourceIronwood;
    case ResourcesIds.Obsidian:
      return BuildingType.ResourceObsidian;
    case ResourcesIds.Gold:
      return BuildingType.ResourceGold;
    case ResourcesIds.Silver:
      return BuildingType.ResourceSilver;
    case ResourcesIds.Mithral:
      return BuildingType.ResourceMithral;
    case ResourcesIds.AlchemicalSilver:
      return BuildingType.ResourceAlchemicalSilver;
    case ResourcesIds.ColdIron:
      return BuildingType.ResourceColdIron;
    case ResourcesIds.DeepCrystal:
      return BuildingType.ResourceDeepCrystal;
    case ResourcesIds.Ruby:
      return BuildingType.ResourceRuby;
    case ResourcesIds.Diamonds:
      return BuildingType.ResourceDiamonds;
    case ResourcesIds.Hartwood:
      return BuildingType.ResourceHartwood;
    case ResourcesIds.Ignium:
      return BuildingType.ResourceIgnium;
    case ResourcesIds.TwilightQuartz:
      return BuildingType.ResourceTwilightQuartz;
    case ResourcesIds.TrueIce:
      return BuildingType.ResourceTrueIce;
    case ResourcesIds.Adamantine:
      return BuildingType.ResourceAdamantine;
    case ResourcesIds.Sapphire:
      return BuildingType.ResourceSapphire;
    case ResourcesIds.EtherealSilica:
      return BuildingType.ResourceEtherealSilica;
    case ResourcesIds.Dragonhide:
      return BuildingType.ResourceDragonhide;
    case ResourcesIds.Labor:
      return BuildingType.ResourceLabor;
    case ResourcesIds.AncientFragment:
      return BuildingType.ResourceAncientFragment;
    case ResourcesIds.Wheat:
      return BuildingType.ResourceWheat;
    case ResourcesIds.Fish:
      return BuildingType.ResourceFish;
    case ResourcesIds.Donkey:
      return BuildingType.ResourceDonkey;
    case ResourcesIds.Knight:
      return BuildingType.ResourceKnightT1;
    case ResourcesIds.KnightT2:
      return BuildingType.ResourceKnightT2;
    case ResourcesIds.KnightT3:
      return BuildingType.ResourceKnightT3;
    case ResourcesIds.Crossbowman:
      return BuildingType.ResourceCrossbowmanT1;
    case ResourcesIds.CrossbowmanT2:
      return BuildingType.ResourceCrossbowmanT2;
    case ResourcesIds.CrossbowmanT3:
      return BuildingType.ResourceCrossbowmanT3;
    case ResourcesIds.Paladin:
      return BuildingType.ResourcePaladinT1;
    case ResourcesIds.PaladinT2:
      return BuildingType.ResourcePaladinT2;
    case ResourcesIds.PaladinT3:
      return BuildingType.ResourcePaladinT3;

    default:
      return BuildingType.None;
  }
}

export function getProducedResource(category: BuildingType): ResourcesIds | undefined {
  switch (category) {
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
    case BuildingType.ResourceAncientFragment:
      return ResourcesIds.AncientFragment;
    case BuildingType.ResourceDonkey:
      return ResourcesIds.Donkey;
    case BuildingType.ResourceKnightT1:
      return ResourcesIds.Knight;
    case BuildingType.ResourceKnightT2:
      return ResourcesIds.KnightT2;
    case BuildingType.ResourceKnightT3:
      return ResourcesIds.KnightT3;
    case BuildingType.ResourceCrossbowmanT1:
      return ResourcesIds.Crossbowman;
    case BuildingType.ResourceCrossbowmanT2:
      return ResourcesIds.CrossbowmanT2;
    case BuildingType.ResourceCrossbowmanT3:
      return ResourcesIds.CrossbowmanT3;
    case BuildingType.ResourcePaladinT1:
      return ResourcesIds.Paladin;
    case BuildingType.ResourcePaladinT2:
      return ResourcesIds.PaladinT2;
    case BuildingType.ResourcePaladinT3:
      return ResourcesIds.PaladinT3;
    case BuildingType.ResourceWheat:
      return ResourcesIds.Wheat;
    case BuildingType.ResourceFish:
      return ResourcesIds.Fish;
    default:
      return undefined;
  }
}

export enum CapacityConfig {
  None = 0,
  RealmStructure = 1,
  Donkey = 2,
  Army = 3,
  Storehouse = 4,
  VillageStructure = 5,
  HyperstructureStructure = 6,
  BankStructure = 7,
  FragmentMineStructure = 8,
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

export const isMilitaryBuilding = (buildingType: BuildingType) => {
  return (
    buildingType === BuildingType.ResourceKnightT1 ||
    buildingType === BuildingType.ResourceKnightT2 ||
    buildingType === BuildingType.ResourceKnightT3 ||
    buildingType === BuildingType.ResourceCrossbowmanT1 ||
    buildingType === BuildingType.ResourceCrossbowmanT2 ||
    buildingType === BuildingType.ResourceCrossbowmanT3 ||
    buildingType === BuildingType.ResourcePaladinT1 ||
    buildingType === BuildingType.ResourcePaladinT2 ||
    buildingType === BuildingType.ResourcePaladinT3
  );
};

export const isResourceBuilding = (buildingType: BuildingType) => {
  return (
    buildingType === BuildingType.ResourceStone ||
    buildingType === BuildingType.ResourceCoal ||
    buildingType === BuildingType.ResourceWood ||
    buildingType === BuildingType.ResourceCopper ||
    buildingType === BuildingType.ResourceIronwood ||
    buildingType === BuildingType.ResourceObsidian ||
    buildingType === BuildingType.ResourceGold ||
    buildingType === BuildingType.ResourceSilver ||
    buildingType === BuildingType.ResourceMithral ||
    buildingType === BuildingType.ResourceAlchemicalSilver ||
    buildingType === BuildingType.ResourceColdIron ||
    buildingType === BuildingType.ResourceDeepCrystal ||
    buildingType === BuildingType.ResourceRuby ||
    buildingType === BuildingType.ResourceDiamonds ||
    buildingType === BuildingType.ResourceHartwood ||
    buildingType === BuildingType.ResourceIgnium ||
    buildingType === BuildingType.ResourceTwilightQuartz ||
    buildingType === BuildingType.ResourceTrueIce ||
    buildingType === BuildingType.ResourceAdamantine ||
    buildingType === BuildingType.ResourceSapphire ||
    buildingType === BuildingType.ResourceEtherealSilica ||
    buildingType === BuildingType.ResourceDragonhide
  );
};

export const isEconomyBuilding = (buildingType: BuildingType) => {
  return (
    buildingType === BuildingType.ResourceWheat ||
    buildingType === BuildingType.ResourceFish ||
    buildingType === BuildingType.ResourceDonkey ||
    buildingType === BuildingType.WorkersHut ||
    buildingType === BuildingType.Storehouse
  );
};

export const isFoodBuilding = (buildingType: BuildingType) => {
  return buildingType === BuildingType.ResourceWheat || buildingType === BuildingType.ResourceFish;
};
