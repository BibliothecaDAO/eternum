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

export const BuildingEnumToString = {
  0: "None",
  1: "Castle",
  2: "Resource",
  3: "Farm",
  4: "FishingVillage",
  5: "Barracks",
  6: "Market",
  7: "ArcheryRange",
  8: "Stable",
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
    case BuildingType.None:
      return 0;
  }
}
