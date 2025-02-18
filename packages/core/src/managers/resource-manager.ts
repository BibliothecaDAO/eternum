// import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BuildingType, CapacityConfig, ResourcesIds, StructureType } from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { ID } from "../types";
import { gramToKg, multiplyByPrecision } from "../utils";
import { configManager } from "./config-manager";

export class ResourceManager {
  entityId: ID;
  resourceId: ResourcesIds;

  constructor(
    private readonly components: ClientComponents,
    entityId: ID,
    resourceId: ResourcesIds,
  ) {
    this.entityId = entityId;
    this.resourceId = resourceId;
  }

  public getProduction() {
    return this._getResource()?.production;
  }

  public getResource() {
    return this._getResource();
  }

  public isFood(): boolean {
    return this.resourceId === ResourcesIds.Wheat || this.resourceId === ResourcesIds.Fish;
  }

  public isActive(): boolean {
    const production = this.getProduction();
    if (!production) return false;
    if (this.isFood()) {
      return production.production_rate !== 0n;
    }
    return production.building_count > 0 && production.production_rate !== 0n && production.output_amount_left !== 0n;
  }

  public balance(currentTick: number): number {
    return Number(this._balance(currentTick));
  }

  public optimisticResourceUpdate = (overrideId: string, change: bigint) => {
    const entity = getEntityIdFromKeys([BigInt(this.entityId), BigInt(this.resourceId)]);
    const currentBalance = getComponentValue(this.components.Resource, entity)?.balance || 0n;
    this.components.Resource.addOverride(overrideId, {
      entity,
      value: {
        resource_type: this.resourceId,
        balance: currentBalance + change,
      },
    });
  };

  public timeUntilValueReached(currentTick: number): number {
    const production = this.getProduction();
    if (!production || production.building_count === 0) return 0;

    // Get production details
    const lastUpdatedTick = production.last_updated_tick;
    const productionRate = production.production_rate;
    const outputAmountLeft = production.output_amount_left;

    // If no production rate or no output left, return 0
    if (productionRate === 0n || outputAmountLeft === 0n) return 0;

    // Calculate ticks since last update
    const ticksSinceLastUpdate = currentTick - lastUpdatedTick;

    // Calculate remaining ticks based on output amount left and production rate
    const remainingTicks = Number(outputAmountLeft) / Number(productionRate);

    // Return remaining ticks, accounting for ticks that have already passed
    return Math.max(0, remainingTicks - ticksSinceLastUpdate);
  }

  public getProductionEndsAt(): number {
    const production = this.getProduction();
    if (!production || production.building_count === 0) return 0;

    // If no production rate or no output left, return current tick
    if (production.production_rate === 0n || production.output_amount_left === 0n) return production.last_updated_tick;

    // For food resources, production never ends
    if (this.isFood()) {
      return Number.MAX_SAFE_INTEGER;
    }

    // Calculate when production will end based on remaining output and rate
    const remainingTicks = Number(production.output_amount_left) / Number(production.production_rate);
    return production.last_updated_tick + Math.ceil(remainingTicks);
  }

  public getStoreCapacity(): number {
    const structure = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(this.entityId || 0)]));
    if (structure?.category === StructureType[StructureType.FragmentMine]) return Infinity;

    const storehouseCapacityKg = gramToKg(configManager.getCapacityConfig(CapacityConfig.Storehouse));
    const quantity =
      getComponentValue(
        this.components.BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(this.entityId || 0), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;
    return multiplyByPrecision(Number(quantity) * storehouseCapacityKg + storehouseCapacityKg);
  }

  private _limitBalanceByStoreCapacity(balance: bigint): bigint {
    const storeCapacity = this.getStoreCapacity();
    const maxAmountStorable = multiplyByPrecision(
      storeCapacity / (configManager.getResourceWeight(this.resourceId) || 1000),
    );
    if (balance > maxAmountStorable) {
      return BigInt(maxAmountStorable);
    }
    return balance;
  }

  private _amountProduced(resource: any, currentTick: number): bigint {
    if (!resource) return 0n;
    const production = resource.production!;

    if (!production || production.building_count === 0) return 0n;
    if (production.production_rate === 0n || production.output_amount_left === 0n) return 0n;

    const ticksSinceLastUpdate = currentTick - production.last_updated_tick;
    let totalAmountProduced = BigInt(ticksSinceLastUpdate) * production.production_rate;

    if (!this.isFood() && totalAmountProduced > production.output_amount_left) {
      totalAmountProduced = production.output_amount_left;
    }

    return totalAmountProduced;
  }

  private _balance(currentTick: number): bigint {
    const resource = this._getResource();
    const balance = resource?.balance || 0n;
    const amountProduced = this._amountProduced(resource, currentTick);
    const finalBalance = this._limitBalanceByStoreCapacity(balance + amountProduced);
    return finalBalance;
  }

  private _getResource() {
    return getComponentValue(
      this.components.Resource,
      getEntityIdFromKeys([BigInt(this.entityId), BigInt(this.resourceId)]),
    );
  }
}
