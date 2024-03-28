import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../utils/utils";
import { ProductionType, ResourceType } from "./types";

export class ProductionManager {
  productionModel: Component<ProductionType> | OverridableComponent<ProductionType>;
  resourceModel: Component<ResourceType> | OverridableComponent<ResourceType>;
  entityId: bigint;
  resourceId: bigint;

  constructor(
    productionModel: Component<ProductionType> | OverridableComponent<ProductionType>,
    resourceModel: Component<ResourceType> | OverridableComponent<ResourceType>,
    entityId: bigint,
    resourceId: bigint,
  ) {
    this.productionModel = productionModel;
    this.entityId = entityId;
    this.resourceId = resourceId;
    this.resourceModel = resourceModel;
  }

  // Retrieves the production data for the current entity
  private getProduction() {
    return getComponentValue(this.productionModel, getEntityIdFromKeys([this.entityId, this.resourceId]));
  }

  // Calculates the time elapsed since the last update
  private sinceLastUpdate() {
    const production = this.getProduction();
    return production ? Date.now() - production.last_updated : 0;
  }

  // Computes the total generated resources since the last update
  private generated() {
    const production = this.getProduction();
    return production && production.active
      ? (production.production_rate + production.production_boost_rate) * this.sinceLastUpdate()
      : 0;
  }

  // Computes the total consumed resources since the last update
  private consumed() {
    const production = this.getProduction();
    return production && production.active ? production.consumed_rate * this.sinceLastUpdate() : 0;
  }

  // Public method to get the net production rate
  netRate() {
    const production = this.getProduction();
    return production && production.active
      ? production.production_rate + production.production_boost_rate - production.consumed_rate
      : 0;
  }

  // Public method to calculate the remaining balance of resources
  balance() {
    const resource = getComponentValue(this.resourceModel, getEntityIdFromKeys([this.entityId, this.resourceId]));
    return (Number(resource?.balance) || 0) + this.generated() - this.consumed();
  }

  // Public method to estimate the time until resources are depleted
  untilDepleted() {
    const netRate = this.netRate();
    return netRate !== 0 ? this.balance() / netRate : Infinity;
  }
}
