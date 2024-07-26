import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  BuildingType,
  EternumGlobalConfig,
  RESOURCE_INPUTS_SCALED,
  STOREHOUSE_CAPACITY,
} from "@bibliothecadao/eternum";
import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";

export class ProductionManager {
  productionModel:
    | Component<ClientComponents["Production"]["schema"]>
    | OverridableComponent<ClientComponents["Production"]["schema"]>;
  resourceModel:
    | Component<ClientComponents["Resource"]["schema"]>
    | OverridableComponent<ClientComponents["Resource"]["schema"]>;
  buildingQuantity:
    | Component<ClientComponents["BuildingQuantityv2"]["schema"]>
    | OverridableComponent<ClientComponents["BuildingQuantityv2"]["schema"]>;
  entityId: bigint;
  resourceId: bigint;

  constructor(
    productionModel:
      | Component<ClientComponents["Production"]["schema"]>
      | OverridableComponent<ClientComponents["Production"]["schema"]>,
    resourceModel:
      | Component<ClientComponents["Resource"]["schema"]>
      | OverridableComponent<ClientComponents["Resource"]["schema"]>,
    buildingQuantity:
      | Component<ClientComponents["BuildingQuantityv2"]["schema"]>
      | OverridableComponent<ClientComponents["BuildingQuantityv2"]["schema"]>,
    entityId: bigint,
    resourceId: bigint,
  ) {
    this.productionModel = productionModel;
    this.buildingQuantity = buildingQuantity;
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

  public timeUntilValueReached(currentTick: number, value: number): number {
    const production = this._getProduction(this.resourceId);
    const resource = this._getResource(this.resourceId);

    if (!production || !resource) return 0;

    const [sign, rate] = this._netRate(this.resourceId);
    const balance = this.balance(currentTick);

    if (rate !== 0) {
      if (sign) {
        // Positive net rate, increase balance
        const timeToValue = (value - balance) / rate;
        return Math.round(timeToValue > 0 ? timeToValue : 0);
      } else {
        // Negative net rate, decrease balance but not below zero
        const timeToValue = balance / -rate;
        return Math.round(timeToValue > 0 ? timeToValue : 0);
      }
    } else {
      return 0;
    }
  }

  public getStoreCapacity(): number {
    const quantity =
      getComponentValue(
        this.buildingQuantity,
        getEntityIdFromKeys([BigInt(this.entityId || "0"), BigInt(BuildingType.Storehouse)]),
      )?.value || "0";
    return (
      (Number(quantity) * STOREHOUSE_CAPACITY + STOREHOUSE_CAPACITY) * EternumGlobalConfig.resources.resourcePrecision
    );
  }

  public isConsumingInputsWithoutOutput(currentTick: number): boolean {
    const production = this._getProduction(this.resourceId);
    if (!production) return false;
    return production?.production_rate > 0n && !this._inputs_available(currentTick, this.resourceId);
  }

  private _balance(currentTick: number, resourceId: bigint): number {
    const resource = this._getResource(resourceId);

    const [sign, rate] = this._netRate(resourceId);

    if (rate !== 0) {
      if (sign) {
        // Positive net rate, increase balance

        const balance = Number(resource?.balance || 0n) + this._productionDuration(currentTick, resourceId) * rate;

        return balance > this.getStoreCapacity() ? this.getStoreCapacity() : balance;
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

    const [_, value] = this.netRate(currentTick);
    const balance = this.balance(currentTick);

    if (value != 0) {
      if (value < 0) {
        const lossPerTick = Math.abs(value);
        const numTicksLeft = balance / lossPerTick;
        return currentTick + Number(numTicksLeft);
      } else {
        return Number.MAX_SAFE_INTEGER;
      }
    } else {
      if (balance > 0) {
        return Number.MAX_SAFE_INTEGER;
      } else {
        return currentTick;
      }
    }
  }

  private _inputs_available(currentTick: number, resourceId: bigint): boolean {
    const inputs = RESOURCE_INPUTS_SCALED[Number(resourceId.toString())];

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
