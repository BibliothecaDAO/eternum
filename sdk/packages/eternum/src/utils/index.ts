import { CairoCustomEnum } from "starknet";
import { ResourcesIds } from "../constants";

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
