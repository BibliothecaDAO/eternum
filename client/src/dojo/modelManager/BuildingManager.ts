import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../utils/utils";
import { BuildingType } from "./types";

enum BuildingCategory {
  None,
  Castle,
  Resource,
  Farm,
  FishingVillage,
  Barracks,
  Market,
  ArcheryRange,
  Stable,
}

const ResourceTypes = {
  WHEAT: 1,
  FISH: 2,
  KNIGHT: 3,
  CROSSBOWMAN: 4,
  PALADIN: 5,
};

export class BuildingManager {
  buildingModel: Component<BuildingType> | OverridableComponent<BuildingType>;
  outer_col: bigint;
  outer_row: bigint;
  inner_col: bigint;
  inner_row: bigint;

  constructor(
    buildingModel: Component<BuildingType> | OverridableComponent<BuildingType>,
    outer_col: bigint,
    outer_row: bigint,
    inner_col: bigint,
    inner_row: bigint,
  ) {
    this.buildingModel = buildingModel;
    this.outer_col = outer_col;
    this.outer_row = outer_row;
    this.inner_col = inner_col;
    this.inner_row = inner_row;
  }

  public getBuilding() {
    return getComponentValue(
      this.buildingModel,
      getEntityIdFromKeys([this.outer_col, this.outer_row, this.inner_col, this.inner_row]),
    );
  }

  public privategetProducedResource() {
    const building = this.getBuilding();
    if (!building) return 0;

    switch (building.category) {
      case BuildingCategory.Resource:
        return building.produced_resource_type;
      case BuildingCategory.Farm:
        return ResourceTypes.WHEAT;
      case BuildingCategory.FishingVillage:
        return ResourceTypes.FISH;
      case BuildingCategory.Barracks:
        return ResourceTypes.KNIGHT;
      case BuildingCategory.ArcheryRange:
        return ResourceTypes.CROSSBOWMAN;
      case BuildingCategory.Stable:
        return ResourceTypes.PALADIN;
      default:
        return 0;
    }
  }

  public isResourceProducer() {
    const producedResource = this.getProducedResource();
    return producedResource !== 0;
  }

  public isProductionMultiplier() {
    return !(this.getProductionBoost() !== 0);
  }

  public getProductionBoost() {
    const building = this.getBuilding();
    if (!building) return 0;

    switch (building.category) {
      case BuildingCategory.Farm:
        return 0.1;
      default:
        return 0;
    }
  }
}
