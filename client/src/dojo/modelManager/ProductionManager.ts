import { Component, getComponentValue, Type } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../utils/utils";

type ProductionType = {
  entity_id: Type.BigInt;
  resource_type: Type.Number;
  production_rate: Type.Number; // per tick
  production_boost_rate: Type.Number; // per tick
  consumed_rate: Type.Number; // per tick
  last_updated: Type.Number;
  active: Type.Boolean;
};

export class ProductionManager {
  model: Component<ProductionType>;
  entityId: bigint;
  resourceId: bigint;

  constructor(model: Component<ProductionType>, entityId: bigint, resourceId: bigint) {
    this.model = model;
    this.entityId = entityId;
    this.resourceId = resourceId;
  }

  // Retrieves the production data for the current entity
  private getProduction() {
    return getComponentValue(this.model, getEntityIdFromKeys([this.entityId, this.resourceId]));
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
    return this.generated() - this.consumed();
  }

  // Public method to estimate the time until resources are depleted
  untilDepleted() {
    const netRate = this.netRate();
    return netRate !== 0 ? this.balance() / netRate : Infinity;
  }
}
