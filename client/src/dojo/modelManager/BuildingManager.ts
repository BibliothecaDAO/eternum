import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../utils/utils";
import { BuildingType } from "./types";

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

  getBuilding() {
    return getComponentValue(
      this.buildingModel,
      getEntityIdFromKeys([this.outer_col, this.outer_row, this.inner_col, this.inner_row]),
    );
  }

  getProductionBoost(value: number) {
    const building = this.getBuilding();
    switch (building?.category) {
      case 1:
        return value * 1;
      case 2:
        return value * 1;
      case 3:
        return value * 0.1;
      case 4:
        return value * 1;
      default:
        return 0;
    }
  }
}
