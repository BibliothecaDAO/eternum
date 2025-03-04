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
  // unused
  TradingPost = 15,
  WorkersHut = 16,
  // unused
  WatchTower = 17,
  Walls = 18,
  Storehouse = 19,
  Bank = 20,
  FragmentMine = 21,
}

export const BuildingEnumToString: Record<BuildingType, string> = {
  [BuildingType.None]: "None",
  [BuildingType.Castle]: "Castle",
  [BuildingType.Resource]: "Resource",
  [BuildingType.Farm]: "Farm",
  [BuildingType.FishingVillage]: "Fishing Village",
  [BuildingType.Barracks1]: "Barracks 1",
  [BuildingType.Barracks2]: "Barracks 2",
  [BuildingType.Barracks3]: "Barracks 3",
  [BuildingType.Market]: "Market",
  [BuildingType.ArcheryRange1]: "Archery Range 1",
  [BuildingType.ArcheryRange2]: "Archery Range 2",
  [BuildingType.ArcheryRange3]: "Archery Range 3",
  [BuildingType.Stable1]: "Stable 1",
  [BuildingType.Stable2]: "Stable 2",
  [BuildingType.Stable3]: "Stable 3",
  [BuildingType.TradingPost]: "Trading Post",
  [BuildingType.WorkersHut]: "Workers Hut",
  [BuildingType.WatchTower]: "Watch Tower",
  [BuildingType.Walls]: "Walls",
  [BuildingType.Storehouse]: "Storehouse",
  [BuildingType.Bank]: "Bank",
  [BuildingType.FragmentMine]: "Fragment Mine",
};

export function getBuildingType(name: BuildingType): CairoCustomEnum {
  switch (name) {
    case BuildingType.None:
      return new CairoCustomEnum({ None: {} });
    case BuildingType.Castle:
      return new CairoCustomEnum({ Castle: {} });
    case BuildingType.Resource:
      return new CairoCustomEnum({ Resource: {} });
    case BuildingType.Farm:
      return new CairoCustomEnum({ Farm: {} });
    case BuildingType.FishingVillage:
      return new CairoCustomEnum({ FishingVillage: {} });
    case BuildingType.Barracks1:

      return new CairoCustomEnum({ Barracks1: {} });
    case BuildingType.Barracks2:
      return new CairoCustomEnum({ Barracks2: {} });
    case BuildingType.Barracks3:
      return new CairoCustomEnum({ Barracks3: {} });
    case BuildingType.Market:
      return new CairoCustomEnum({ Market: {} });
    case BuildingType.ArcheryRange1:
      return new CairoCustomEnum({ ArcheryRange1: {} });
    case BuildingType.ArcheryRange2:
      return new CairoCustomEnum({ ArcheryRange2: {} });
    case BuildingType.ArcheryRange3:
      return new CairoCustomEnum({ ArcheryRange3: {} });
    case BuildingType.Stable1:
      return new CairoCustomEnum({ Stable1: {} });
    case BuildingType.Stable2:
      return new CairoCustomEnum({ Stable2: {} });
    case BuildingType.Stable3:
      return new CairoCustomEnum({ Stable3: {} });
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
    case BuildingType.Bank:
      return new CairoCustomEnum({ Bank: {} });
    case BuildingType.FragmentMine:
      return new CairoCustomEnum({ FragmentMine: {} });
  }
}

export function getProducedResource(name: BuildingType): number {
  switch (name) {
    case BuildingType.None:
      return 0;
    case BuildingType.Castle:
      return 0;
    case BuildingType.Resource:
      return 0;
    case BuildingType.Farm:
      return ResourcesIds.Wheat;
    case BuildingType.FishingVillage:
      return ResourcesIds.Fish;
    case BuildingType.Barracks1:
      return ResourcesIds.Knight;
    case BuildingType.Barracks2:
      return ResourcesIds.KnightT2;
    case BuildingType.Barracks3:
      return ResourcesIds.KnightT3;
    case BuildingType.Market:
      return 0;
    case BuildingType.ArcheryRange1:
      return ResourcesIds.Crossbowman;
    case BuildingType.ArcheryRange2:
      return ResourcesIds.CrossbowmanT2;
    case BuildingType.ArcheryRange3:
      return ResourcesIds.CrossbowmanT3;
    case BuildingType.Stable1:
      return ResourcesIds.Paladin;
    case BuildingType.Stable2:
      return ResourcesIds.PaladinT2;
    case BuildingType.Stable3:
      return ResourcesIds.PaladinT3;
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
    case BuildingType.Bank:
      return 0;
    case BuildingType.FragmentMine:
      return 0;
  }
}

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
