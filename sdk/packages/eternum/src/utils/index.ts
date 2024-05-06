import { CairoCustomEnum } from "starknet";
import { ResourcesIds } from "../constants";

export enum WorldBuildingType {
  Bank = 1,
  Settlement = 2,
  Hyperstructure = 3,
}

export enum BuildingType {
  None = 0,
  Castle = 1,
  Resource = 2,
  Farm = 3,
  FishingVillage = 4,
  Barracks = 5,
  Market = 6,
  ArcheryRange = 7,
  Stable = 8,
  DonkeyFarm = 9,
  TradingPost = 10,
  WorkersHut = 11,
  WatchTower = 12,
  Walls = 13,
  Storehouse = 14,
}

export enum ResourceBuildingType {
  Wood = 1,
  Stone = 2,
  Coal = 3,
  Copper = 4,
  Obsidian = 5,
  Silver = 6,
  Ironwood = 7,
  ColdIron = 8,
  Gold = 9,
  Hartwood = 10,
  Diamonds = 11,
  Sapphire = 12,
  Ruby = 13,
  DeepCrystal = 14,
  Ignium = 15,
  EtherealSilica = 16,
  TrueIce = 17,
  TwilightQuartz = 18,
  AlchemicalSilver = 19,
  Adamantine = 20,
  Mithral = 21,
  Dragonhide = 22,
}

export const CombinedBuildingTypes = {
  ...BuildingType,
  ...ResourceBuildingType,
};

// export BUILDING_NONE=0
// export BUILDING_CASTLE=1
// export BUILDING_RESOURCE=2
// export BUILDING_FARM=3
// export BUILDING_FISHING_VILLAGE=4
// export BUILDING_BARRACKS=5
// export BUILDING_MARKET=6
// export BUILDING_ARCHERY_RANGE=7
// export BUILDING_STABLE=8
// export BUILDING_DONKEY_FARM=9
// export BUILDING_TRADING_POST=10
// export BUILDING_WORKERS_HUT=11
// export BUILDING_WATCH_TOWER=12
// export BUILDING_WALLS=13
// export BUILDING_STOREHOUSE=14

export const BuildingEnumToString = {
  0: "None",
  1: "Castle",
  2: "Resource",
  3: "Farm",
  4: "Fishing Village",
  5: "Barracks",
  6: "Market",
  7: "Archery Range",
  8: "Stable",
  9: "Donkey Farm",
  10: "Trading Post",
  11: "Workers Hut",
  12: "Watch Tower",
  13: "Walls",
  14: "Storehouse",
};

export const BuildingStringToEnum = {
  None: 0,
  Castle: 1,
  Resource: 2,
  Farm: 3,
  FishingVillage: 4,
  Barracks: 5,
  Market: 6,
  ArcheryRange: 7,
  Stable: 8,
  DonkeyFarm: 9,
  TradingPost: 10,
  WorkersHut: 11,
  WatchTower: 12,
  Walls: 13,
  Storehouse: 14,
};

export function getBuildingType(name: BuildingType): CairoCustomEnum {
  switch (name) {
    case BuildingType.Castle:
      return new CairoCustomEnum({ Castle: {} });
    case BuildingType.Resource:
      return new CairoCustomEnum({ Resource: {} });
    case BuildingType.Farm:
      return new CairoCustomEnum({ Farm: {} });
    case BuildingType.FishingVillage:
      return new CairoCustomEnum({ FishingVillage: {} });
    case BuildingType.Barracks:
      return new CairoCustomEnum({ Barracks: {} });
    case BuildingType.Market:
      return new CairoCustomEnum({ Market: {} });
    case BuildingType.ArcheryRange:
      return new CairoCustomEnum({ ArcheryRange: {} });
    case BuildingType.Stable:
      return new CairoCustomEnum({ Stable: {} });
    case BuildingType.DonkeyFarm:
      return new CairoCustomEnum({ DonkeyFarm: {} });
    case BuildingType.TradingPost:
      return new CairoCustomEnum({ TradingPost: {} });
    case BuildingType.WorkersHut:
      return new CairoCustomEnum({ WorkersHut: {} });
    case BuildingType.WatchTower:
      return new CairoCustomEnum({ WatchTower: {} });
    case BuildingType.Walls:
      return new CairoCustomEnum({ Walls: {} });
    case BuildingType.Storehouse:
      return new CairoCustomEnum({ Storehouse: {} });
    case BuildingType.None:
      return new CairoCustomEnum({ None: {} });
  }
}

export function getProducedResource(name: BuildingType): number {
  switch (name) {
    case BuildingType.Castle:
      return 0;
    case BuildingType.Resource:
      return 0;
    case BuildingType.Farm:
      return ResourcesIds.Wheat;
    case BuildingType.FishingVillage:
      return ResourcesIds.Fish;
    case BuildingType.Barracks:
      return ResourcesIds.Knight;
    case BuildingType.Market:
      return 0;
    case BuildingType.ArcheryRange:
      return ResourcesIds.Crossbowmen;
    case BuildingType.Stable:
      return ResourcesIds.Paladin;
    case BuildingType.DonkeyFarm:
      return ResourcesIds.Donkey;
    case BuildingType.TradingPost:
      return 0;
    case BuildingType.WorkersHut:
      return 0;
    case BuildingType.WatchTower:
      return 0;
    case BuildingType.Walls:
      return 0;
    case BuildingType.Storehouse:
      return 0;
    case BuildingType.None:
      return 0;
  }
}

export enum EntityState {
  Traveling,
  WaitingForDeparture,
  Idle,
  WaitingToOffload,
  NotApplicable, // When the entity should not be rendered
}

export function determineEntityState(
  nextBlockTimestamp: number | undefined,
  blocked: boolean | undefined,
  arrivalTime: number | undefined,
  hasResources: boolean,
): EntityState {
  const isTraveling =
    !blocked && nextBlockTimestamp !== undefined && arrivalTime !== undefined && arrivalTime > nextBlockTimestamp;
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
