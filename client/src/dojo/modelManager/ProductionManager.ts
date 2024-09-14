import { getEntityIdFromKeys, gramToKg } from "@/ui/utils/utils";
import {
  BuildingType,
  CapacityConfigCategory,
  EternumGlobalConfig,
  type ID,
  RESOURCE_INPUTS_SCALED,
  type ResourcesIds,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { type SetupResult } from "../setup";

export class ProductionManager {
  entityId: ID;
  resourceId: ResourcesIds;

  constructor(
    private readonly setup: SetupResult,
    entityId: ID,
    resourceId: ResourcesIds,
  ) {
    this.entityId = entityId;
    this.resourceId = resourceId;
  }

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
        this.setup.components.BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(this.entityId || 0), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;
    return (
      (Number(quantity) * gramToKg(EternumGlobalConfig.carryCapacityGram[CapacityConfigCategory.Storehouse]) +
        gramToKg(EternumGlobalConfig.carryCapacityGram[CapacityConfigCategory.Storehouse])) *
      EternumGlobalConfig.resources.resourcePrecision
    );
  }

  public isConsumingInputsWithoutOutput(currentTick: number): boolean {
    const production = this._getProduction(this.resourceId);
    if (!production) return false;
    return production?.production_rate > 0n && !this._inputs_available(currentTick, this.resourceId);
  }

  private _balance(currentTick: number, resourceId: ResourcesIds): number {
    const resource = this._getResource(resourceId);

    const [sign, rate] = this._netRate(resourceId);

    if (rate !== 0) {
      if (sign) {
        // Positive net rate, increase balance
        const productionDuration = this._productionDuration(currentTick, resourceId);
        const balance = Number(resource?.balance || 0n) + productionDuration * rate;
        const storeCapacity = this.getStoreCapacity();
        const result = Math.min(balance, storeCapacity);
        return result;
      } else {
        // Negative net rate, decrease balance but not below zero
        const depletionDuration = this._depletionDuration(currentTick, resourceId);
        const balance = Number(resource?.balance || 0n) - -depletionDuration * rate;
        if (balance < 0) {
          return 0;
        } else {
          return balance;
        }
      }
    } else {
      // No net rate change, return current balance
      const currentBalance = Number(resource?.balance || 0n);
      return currentBalance;
    }
  }

  private _finish_tick(): number {
    const productionDeadline = this._getProductionDeadline(this.entityId);
    const production = this._getProduction(this.resourceId);
    if (!productionDeadline || !production) {
      return Number(production?.input_finish_tick || 0);
    } else {
      return Math.min(Number(productionDeadline.deadline_tick), Number(production.input_finish_tick));
    }
  }

  private _productionDuration(currentTick: number, resourceId: ResourcesIds): number {
    const production = this._getProduction(resourceId);
    const input_finish_tick = this._finish_tick();

    if (!production) return 0;

    if (production.last_updated_tick >= input_finish_tick && input_finish_tick !== 0) {
      return 0;
    }

    if (input_finish_tick === 0 || input_finish_tick > currentTick) {
      return Number(currentTick) - Number(production.last_updated_tick);
    } else {
      return Number(input_finish_tick) - Number(production.last_updated_tick);
    }
  }

  private _depletionDuration(currentTick: number, resourceId: ResourcesIds): number {
    const production = this._getProduction(resourceId);
    return Number(currentTick) - Number(production?.last_updated_tick);
  }

  private _netRate(resourceId: ResourcesIds): [boolean, number] {
    const production = this._getProduction(resourceId);
    if (!production) return [false, 0];
    const difference = Number(production.production_rate) - Number(production.consumption_rate);
    return [difference > 0, difference];
  }

  private _balanceExhaustionTick(currentTick: number, resourceId: ResourcesIds): number {
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

  private _inputs_available(currentTick: number, resourceId: ResourcesIds): boolean {
    const inputs = RESOURCE_INPUTS_SCALED[resourceId];

    // Ensure inputs is an array before proceeding
    if (inputs.length == 0) {
      return true;
    }

    for (const input of inputs) {
      const balance = this._balance(currentTick, input.resource);
      if (balance === undefined || balance <= 0) {
        return false;
      }
    }
    return true;
  }

  private _getProduction(resourceId: ResourcesIds) {
    return getComponentValue(
      this.setup.components.Production,
      getEntityIdFromKeys([BigInt(this.entityId), BigInt(resourceId)]),
    );
  }

  private _getProductionDeadline(entityId: ID) {
    return getComponentValue(this.setup.components.ProductionDeadline, getEntityIdFromKeys([BigInt(entityId)]));
  }

  private _getResource(resourceId: ResourcesIds) {
    return getComponentValue(
      this.setup.components.Resource,
      getEntityIdFromKeys([BigInt(this.entityId), BigInt(resourceId)]),
    );
  }
}
