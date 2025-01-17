import { CairoCustomEnum } from "starknet";
import { ResourcesIds } from "../constants";
import { ResourceInputs } from "../types";

// Knip ignore tag
/** @public */
export enum StructureType {
  Realm = 1,
  Hyperstructure = 2,
  Bank = 3,
  FragmentMine = 4,
  Settlement = 5,
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
  // unused
  TradingPost = 9,
  WorkersHut = 10,
  // unused
  WatchTower = 11,
  // unused
  Walls = 12,
  Storehouse = 13,
  Bank = 14,
  FragmentMine = 15,
}

export const BuildingEnumToString: Record<BuildingType, string> = {
  [BuildingType.None]: "None",
  [BuildingType.Castle]: "Castle",
  [BuildingType.Resource]: "Resource",
  [BuildingType.Farm]: "Farm",
  [BuildingType.FishingVillage]: "Fishing Village",
  [BuildingType.Barracks]: "Barracks",
  [BuildingType.Market]: "Market",
  [BuildingType.ArcheryRange]: "Archery Range",
  [BuildingType.Stable]: "Stable",
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
    case BuildingType.Barracks:
      return new CairoCustomEnum({ Barracks: {} });
    case BuildingType.Market:
      return new CairoCustomEnum({ Market: {} });
    case BuildingType.ArcheryRange:
      return new CairoCustomEnum({ ArcheryRange: {} });
    case BuildingType.Stable:
      return new CairoCustomEnum({ Stable: {} });
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
    case BuildingType.Barracks:
      return ResourcesIds.Knight;
    case BuildingType.Market:
      return 0;
    case BuildingType.ArcheryRange:
      return ResourcesIds.Crossbowman;
    case BuildingType.Stable:
      return ResourcesIds.Paladin;
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

export enum CapacityConfigCategory {
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
  nextBlockTimestamp: number | undefined,
  blocked: boolean | undefined,
  arrivalTime: bigint | undefined,
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

export const STRUCTURE_COSTS: ResourceInputs = {
  [StructureType.Hyperstructure]: [], //todo hyperstructure costs
  [StructureType.Bank]: [{ resource: ResourcesIds.Gold, amount: 100_000 }],
  [StructureType.Settlement]: [
    { resource: ResourcesIds.Wheat, amount: 100_000 },
    { resource: ResourcesIds.Fish, amount: 100_000 },
  ],
};
