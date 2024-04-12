import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
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
  public getProduction() {
    return getComponentValue(this.productionModel, getEntityIdFromKeys([this.entityId, this.resourceId]));
  }

  public getResource() {
    return getComponentValue(this.resourceModel, getEntityIdFromKeys([this.entityId, this.resourceId]));
  }

  public isActive(): boolean {
    const production = this.getProduction();
    return production !== undefined && production.building_count > 0;
  }

  public bonus() {
    const production = this.getProduction();
    if (!production) return BigInt(0);
    return (production.production_rate * BigInt(production.building_count) * production.bonus_percent) / BigInt(10_000);
  }

  public actualProductionRate() {
    const production = this.getProduction();
    if (!production) return BigInt(0);
    return production.production_rate * BigInt(production.building_count) + this.bonus();
  }

  public netRate(): [boolean, number] {
    const production = this.getProduction();
    if (!production) return [false, 0];
    const productionRate = this.actualProductionRate();
    const difference = Number(productionRate) - Number(production.consumption_rate);
    return [difference > 0, difference];
  }

  public balanceExhaustionTick(currentTick: number): number {
    const production = this.getProduction();
    const resource = this.getResource();

    if (!production || !resource) return currentTick; // Handling undefined values

    const [sign, value] = this.netRate();
    if (value > BigInt(0)) {
      if (!sign) {
        const lossPerTick = value;
        const numTicksLeft = Number(resource.balance) / lossPerTick;
        return currentTick + Number(numTicksLeft); // Assuming conversion is safe
      } else {
        return Number.MAX_SAFE_INTEGER;
      }
    } else {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  public productionDuration(currentTick: number): number {
    const production = this.getProduction();

    if (!production) return 0;

    if (production.last_updated_tick >= production.end_tick && production.end_tick !== BigInt(0)) {
      return 0;
    }

    if (production.end_tick === BigInt(0) || production.end_tick > currentTick) {
      return Number(currentTick) - Number(production.last_updated_tick);
    } else {
      return Number(production.end_tick) - Number(production.last_updated_tick);
    }
  }

  public depletionDuration(currentTick: number): number {
    const production = this.getProduction();
    if (!production) return 0;

    if (production.end_tick > production.last_updated_tick) {
      return Number(currentTick) - Number(production.last_updated_tick);
    }

    const exhaustionTick = production.end_tick + (production.last_updated_tick - production.end_tick);
    return Number(currentTick) - Number(exhaustionTick);
  }

  public balance(currentTick: number): number {
    const resource = this.getResource();

    const [sign, rate] = this.netRate();

    console.log(sign, rate);
    if (rate !== 0) {
      if (sign) {
        // Positive net rate, increase balance
        return Number(resource?.balance || 0n) + this.productionDuration(currentTick) * rate;
      } else {
        // Negative net rate, decrease balance but not below zero
        return Number(resource?.balance || 0n) - -this.depletionDuration(currentTick) * rate;
      }
    } else {
      // No net rate change, return current balance
      return Number(resource?.balance || 0n);
    }
  }
}
