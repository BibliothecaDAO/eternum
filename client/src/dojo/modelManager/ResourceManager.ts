import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import { BuildingType, CapacityConfigCategory, ResourcesIds, type ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { configManager, type SetupResult } from "../setup";

export class ResourceManager {
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

  public netRate(): [boolean, number] {
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

  public timeUntilFinishTick(currentTick: number): number {
    const finishTick = this._finish_tick();
    return finishTick > currentTick ? finishTick - currentTick : 0;
  }

  public optimisticResourceUpdate = (overrideId: string, change: bigint) => {
    const entity = getEntityIdFromKeys([BigInt(this.entityId), BigInt(this.resourceId)]);
    const currentBalance = getComponentValue(this.setup.components.Resource, entity)?.balance || 0n;
    this.setup.components.Resource.addOverride(overrideId, {
      entity,
      value: {
        resource_type: this.resourceId,
        balance: currentBalance + change,
      },
    });
  };

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
    const storehouseCapacityKg = gramToKg(configManager.getCapacityConfig(CapacityConfigCategory.Storehouse));
    const quantity =
      getComponentValue(
        this.setup.components.BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(this.entityId || 0), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;
    return multiplyByPrecision(Number(quantity) * storehouseCapacityKg + storehouseCapacityKg);
  }

  public isConsumingInputsWithoutOutput(currentTick: number): boolean {
    const production = this._getProduction(this.resourceId);
    if (!production) return false;
    return production?.production_rate > 0n && !this._inputs_available(currentTick, this.resourceId);
  }

  public balanceFromComponents(
    resourceId: ResourcesIds,
    rate: number,
    sign: boolean,
    resourceBalance: bigint | undefined,
    productionDuration: number,
    depletionDuration: number,
  ): number {
    return this._calculateBalance(resourceId, rate, sign, resourceBalance, productionDuration, depletionDuration);
  }

  private _calculateBalance(
    resourceId: ResourcesIds,
    rate: number,
    sign: boolean,
    resourceBalance: bigint | undefined,
    productionDuration: number,
    depletionDuration: number,
  ): number {
    if (rate !== 0) {
      if (sign) {
        // Positive net rate, increase balance
        const balance = Number(resourceBalance || 0n) + productionDuration * rate;
        const storeCapacity = this.getStoreCapacity();
        const maxAmountStorable = multiplyByPrecision(
          storeCapacity / (configManager.getResourceWeight(resourceId) || 1000),
        );
        const result = Math.min(balance, maxAmountStorable);
        return result;
      } else {
        // Negative net rate, decrease balance but not below zero
        const balance = Number(resourceBalance || 0n) - -depletionDuration * rate;
        if (balance < 0) {
          return 0;
        } else {
          return balance;
        }
      }
    } else {
      // No net rate change, return current balance
      const currentBalance = Number(resourceBalance || 0n);
      return currentBalance;
    }
  }

  private _balance(currentTick: number, resourceId: ResourcesIds): number {
    const resource = this._getResource(resourceId);

    const [sign, rate] = this._netRate(resourceId);
    const productionDuration = this._productionDuration(currentTick, resourceId);
    const productionDepletion = this._depletionDuration(currentTick, resourceId);
    return this._calculateBalance(resourceId, rate, sign, resource?.balance, productionDuration, productionDepletion);
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

    let consumptionRate = Number(production.consumption_rate);
  
    // Check if this is a Wonder producing Lords
    const isWonder = getComponentValue(
      this.setup.components.Realm,
      getEntityIdFromKeys([BigInt(this.entityId)])
    )?.has_wonder || false;
      
    if (isWonder && resourceId === ResourcesIds.Lords) {
      consumptionRate = consumptionRate * 0.1; // 10% of normal production rate for Wonders
    }

    const difference = Number(production.production_rate) - consumptionRate;
    return [difference > 0, difference];
  }

  private _balanceExhaustionTick(currentTick: number, resourceId: ResourcesIds): number {
    const production = this._getProduction(resourceId);
    const resource = this._getResource(resourceId);

    // If there is no production or resource, return current tick
    if (!production || !resource) return currentTick;

    const [_, value] = this.netRate();
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
    const inputs = configManager.resourceInputs[resourceId];

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
