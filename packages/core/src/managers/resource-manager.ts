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
    return production !== undefined && production.building_count > 0;
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

  public timeUntilValueReached(currentTick: number, value: number): number {
    const production = this.getProduction();
    if (!production || production.production_rate === 0n) return 0;

    const balance = this.balance(currentTick);
    if (value <= Number(balance)) return 0;

    return (value - Number(balance)) / Number(production.production_rate);
  }

  public getProductionEndsAt(): number {
    const productionEndsAt = this._productionEndsAt();
    return Number(productionEndsAt);
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

    if (!production || production.building_count == 0) return 0n;
    
    let totalAmountProduced = BigInt(currentTick - production.last_updated_at) * BigInt(production.production_rate);
    if (!this.isFood() && totalAmountProduced > production.output_amount_left) {
      totalAmountProduced = production.output_amount_left;
    }

    return totalAmountProduced;
  }

  private _productionEndsAt(): number {
    const resource = this._getResource();
    const production = resource?.production;
    if (!production) return 0;
    if (production.building_count === 0) return 0;

    let productionTicksLeft = BigInt(production.output_amount_left) / BigInt(production.production_rate);
    if (this.isFood()) {
      productionTicksLeft = BigInt(1) << BigInt(64);
    }

    return production.last_updated_at + Number(productionTicksLeft);
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
