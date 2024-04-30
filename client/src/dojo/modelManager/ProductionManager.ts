import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { ProductionType, ResourceType } from "./types";
import { RESOURCE_INPUTS } from "@bibliothecadao/eternum";

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
    return this._getProduction(this.resourceId);
  }

  public getResource() {
    return this._getResource(this.resourceId);
  }

  public isActive(): boolean {
    const production = this._getProduction(this.resourceId);
    return production !== undefined && (production.building_count > 0 || production.consumption_rate > 0);
  }

  public netRate(currentTick: number): [boolean, number] {
    if (!this._inputs_available(currentTick, this.resourceId)) return [false, 0];
    return this._netRate(this.resourceId);
  }

  public balanceExhaustionTick(currentTick: number): number {
    return this._balanceExhaustionTick(currentTick, this.resourceId);
  }

  public productionDuration(currentTick: number): number {
    return this._productionDuration(currentTick, this.resourceId);
  }

  public depletionDuration(currentTick: number): number {
    return this._depletionDuration(currentTick, this.resourceId);
  }

  public balance(currentTick: number): number {
    return this._balance(currentTick, this.resourceId);
  }

  private _balance(currentTick: number, resourceId: bigint): number {
    const resource = this._getResource(resourceId);

    const [sign, rate] = this._netRate(resourceId);

    if (rate !== 0) {
      if (sign) {
        // Positive net rate, increase balance
        return Number(resource?.balance || 0n) + this._productionDuration(currentTick, resourceId) * rate;
      } else {
        // Negative net rate, decrease balance but not below zero
        let balance = Number(resource?.balance || 0n) - -this._depletionDuration(currentTick, resourceId) * rate;
        if (balance < 0) {
          return 0;
        } else {
          return balance;
        }
      }
    } else {
      // No net rate change, return current balance
      return Number(resource?.balance || 0n);
    }
  }

  private _productionDuration(currentTick: number, resourceId: bigint): number {
    const production = this._getProduction(resourceId);

    if (!production) return 0;

    if (production.last_updated_tick >= production.input_finish_tick && production.input_finish_tick !== BigInt(0)) {
      return 0;
    }

    if (production.input_finish_tick === BigInt(0) || production.input_finish_tick > currentTick) {
      return Number(currentTick) - Number(production.last_updated_tick);
    } else {
      return Number(production.input_finish_tick) - Number(production.last_updated_tick);
    }
  }

  private _depletionDuration(currentTick: number, resourceId: bigint): number {
    const production = this._getProduction(resourceId);
    return Number(currentTick) - Number(production?.last_updated_tick);
  }

  private _netRate(resourceId: bigint): [boolean, number] {
    const production = this._getProduction(resourceId);
    if (!production) return [false, 0];
    const difference = Number(production.production_rate) - Number(production.consumption_rate);
    return [difference > 0, difference];
  }

  private _balanceExhaustionTick(currentTick: number, resourceId: bigint): number {
    const production = this._getProduction(resourceId);
    const resource = this._getResource(resourceId);

    // If there is no production or resource, return current tick
    if (!production || !resource) return currentTick;

    const [sign, value] = this.netRate(currentTick);
    if (value > BigInt(0)) {
      if (!sign) {
        const lossPerTick = value;
        const numTicksLeft = Number(resource.balance) / lossPerTick;
        return currentTick + Number(numTicksLeft);
      } else {
        return Number.MAX_SAFE_INTEGER;
      }
    } else {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  private _inputs_available(currentTick: number, resourceId: bigint): boolean {
    const inputs = RESOURCE_INPUTS[Number(resourceId.toString())];

    // Ensure inputs is an array before proceeding
    if (inputs.length == 0) {
      return true;
    }

    for (const input of inputs) {
      const balance = this._balance(currentTick, BigInt(input.resource));
      if (balance === undefined || balance <= 0) {
        return false;
      }
    }
    return true;
  }

  private _getProduction(resourceId: bigint) {
    return getComponentValue(this.productionModel, getEntityIdFromKeys([this.entityId, resourceId]));
  }

  private _getResource(resourceId: bigint) {
    return getComponentValue(this.resourceModel, getEntityIdFromKeys([this.entityId, resourceId]));
  }
}
