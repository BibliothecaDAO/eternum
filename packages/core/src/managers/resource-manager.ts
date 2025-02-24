// import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BuildingType, CapacityConfig, ResourcesIds, StructureType } from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { ID } from "../types";
import { gramToKg, multiplyByPrecision, unpackValue } from "../utils";
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
    const resource = this._getResource();
    if (!resource) return undefined;

    switch (this.resourceId) {
      case ResourcesIds.Stone:
        return resource.STONE_PRODUCTION;
      case ResourcesIds.Coal:
        return resource.COAL_PRODUCTION;
      case ResourcesIds.Wood:
        return resource.WOOD_PRODUCTION;
      case ResourcesIds.Copper:
        return resource.COPPER_PRODUCTION;
      case ResourcesIds.Ironwood:
        return resource.IRONWOOD_PRODUCTION;
      case ResourcesIds.Obsidian:
        return resource.OBSIDIAN_PRODUCTION;
      case ResourcesIds.Gold:
        return resource.GOLD_PRODUCTION;
      case ResourcesIds.Silver:
        return resource.SILVER_PRODUCTION;
      case ResourcesIds.Mithral:
        return resource.MITHRAL_PRODUCTION;
      case ResourcesIds.AlchemicalSilver:
        return resource.ALCHEMICAL_SILVER_PRODUCTION;
      case ResourcesIds.ColdIron:
        return resource.COLD_IRON_PRODUCTION;
      case ResourcesIds.DeepCrystal:
        return resource.DEEP_CRYSTAL_PRODUCTION;
      case ResourcesIds.Ruby:
        return resource.RUBY_PRODUCTION;
      case ResourcesIds.Diamonds:
        return resource.DIAMONDS_PRODUCTION;
      case ResourcesIds.Hartwood:
        return resource.HARTWOOD_PRODUCTION;
      case ResourcesIds.Ignium:
        return resource.IGNIUM_PRODUCTION;
      case ResourcesIds.TwilightQuartz:
        return resource.TWILIGHT_QUARTZ_PRODUCTION;
      case ResourcesIds.TrueIce:
        return resource.TRUE_ICE_PRODUCTION;
      case ResourcesIds.Adamantine:
        return resource.ADAMANTINE_PRODUCTION;
      case ResourcesIds.Sapphire:
        return resource.SAPPHIRE_PRODUCTION;
      case ResourcesIds.EtherealSilica:
        return resource.ETHEREAL_SILICA_PRODUCTION;
      case ResourcesIds.Dragonhide:
        return resource.DRAGONHIDE_PRODUCTION;
      case ResourcesIds.Labor:
        return resource.LABOR_PRODUCTION;
      case ResourcesIds.AncientFragment:
        return resource.EARTHEN_SHARD_PRODUCTION;
      case ResourcesIds.Donkey:
        return resource.DONKEY_PRODUCTION;
      case ResourcesIds.Knight:
        return resource.KNIGHT_T1_PRODUCTION;
      case ResourcesIds.KnightT2:
        return resource.KNIGHT_T2_PRODUCTION;
      case ResourcesIds.KnightT3:
        return resource.KNIGHT_T3_PRODUCTION;
      case ResourcesIds.Crossbowman:
        return resource.CROSSBOWMAN_T1_PRODUCTION;
      case ResourcesIds.CrossbowmanT2:
        return resource.CROSSBOWMAN_T2_PRODUCTION;
      case ResourcesIds.CrossbowmanT3:
        return resource.CROSSBOWMAN_T3_PRODUCTION;
      case ResourcesIds.Paladin:
        return resource.PALADIN_T1_PRODUCTION;
      case ResourcesIds.PaladinT2:
        return resource.PALADIN_T2_PRODUCTION;
      case ResourcesIds.PaladinT3:
        return resource.PALADIN_T3_PRODUCTION;
      case ResourcesIds.Wheat:
        return resource.WHEAT_PRODUCTION;
      case ResourcesIds.Fish:
        return resource.FISH_PRODUCTION;
      case ResourcesIds.Lords:
        return resource.LORDS_PRODUCTION;
      default:
        return undefined;
    }
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

  public balanceWithProduction(currentTick: number): number {
    const resource = this._getResource();
    console.log({ resource });
    const balance = this.balance();
    const amountProduced = this._amountProduced(resource, currentTick);
    const finalBalance = this._limitBalanceByStoreCapacity(balance + amountProduced);
    return Number(finalBalance);
  }

  public optimisticResourceUpdate = (overrideId: string, change: bigint) => {
    const entity = getEntityIdFromKeys([BigInt(this.entityId), BigInt(this.resourceId)]);
    const currentBalance = this.balance();
    const weight = configManager.getResourceWeight(this.resourceId);
    const currentWeight = getComponentValue(this.components.Resource, entity)?.weight || { capacity: 0n, weight: 0n };

    switch (this.resourceId) {
      case ResourcesIds.Stone:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            STONE_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Coal:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            COAL_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Wood:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            WOOD_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Copper:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            COPPER_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Ironwood:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            IRONWOOD_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Obsidian:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            OBSIDIAN_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Gold:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            GOLD_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Silver:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            SILVER_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Mithral:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            MITHRAL_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.AlchemicalSilver:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            ALCHEMICAL_SILVER_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.ColdIron:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            COLD_IRON_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.DeepCrystal:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            DEEP_CRYSTAL_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Ruby:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            RUBY_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Diamonds:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            DIAMONDS_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Hartwood:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            HARTWOOD_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Ignium:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            IGNIUM_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.TwilightQuartz:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            TWILIGHT_QUARTZ_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.TrueIce:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            TRUE_ICE_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Adamantine:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            ADAMANTINE_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Sapphire:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            SAPPHIRE_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.EtherealSilica:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            ETHEREAL_SILICA_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Dragonhide:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            DRAGONHIDE_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Labor:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            LABOR_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.AncientFragment:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            EARTHEN_SHARD_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Donkey:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            DONKEY_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Knight:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            KNIGHT_T1_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.KnightT2:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            KNIGHT_T2_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.KnightT3:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            KNIGHT_T3_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Crossbowman:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            CROSSBOWMAN_T1_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.CrossbowmanT2:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            CROSSBOWMAN_T2_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.CrossbowmanT3:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            CROSSBOWMAN_T3_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Paladin:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            PALADIN_T1_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.PaladinT2:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            PALADIN_T2_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.PaladinT3:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            PALADIN_T3_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Wheat:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            WHEAT_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Fish:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            FISH_BALANCE: currentBalance + change,
          },
        });
        break;
      case ResourcesIds.Lords:
        this.components.Resource.addOverride(overrideId, {
          entity,
          value: {
            weight: {
              ...currentWeight,
              weight: currentWeight.weight + BigInt(weight),
            },
            LORDS_BALANCE: currentBalance + change,
          },
        });
        break;
      default:
        break;
    }
  };

  public timeUntilValueReached(currentTick: number): number {
    const production = this.getProduction();
    if (!production || production.building_count === 0) return 0;

    // Get production details
    const lastUpdatedTick = production.last_updated_at;
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
    if (production.production_rate === 0n || production.output_amount_left === 0n) return production.last_updated_at;

    // For food resources, production never ends
    if (this.isFood()) {
      return Number.MAX_SAFE_INTEGER;
    }

    // Calculate when production will end based on remaining output and rate
    const remainingTicks = Number(production.output_amount_left) / Number(production.production_rate);
    return production.last_updated_at + Math.ceil(remainingTicks);
  }

  public getStoreCapacity(): number {
    const structure = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(this.entityId || 0)]));
    if (structure?.base?.category === StructureType.FragmentMine) return Infinity;

    const storehouseCapacityKg = gramToKg(configManager.getCapacityConfig(CapacityConfig.Storehouse));
    const packedBuildingCount =
      getComponentValue(this.components.StructureBuildings, getEntityIdFromKeys([BigInt(this.entityId || 0)]))
        ?.packed_counts || 0n;

    const quantity = unpackValue(packedBuildingCount)[BuildingType.Storehouse] || 0;

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

  public balance(): bigint {
    const resource = this._getResource();
    if (!resource) return 0n;

    switch (this.resourceId) {
      case ResourcesIds.Stone:
        return resource.STONE_BALANCE;
      case ResourcesIds.Coal:
        return resource.COAL_BALANCE;
      case ResourcesIds.Wood:
        return resource.WOOD_BALANCE;
      case ResourcesIds.Copper:
        return resource.COPPER_BALANCE;
      case ResourcesIds.Ironwood:
        return resource.IRONWOOD_BALANCE;
      case ResourcesIds.Obsidian:
        return resource.OBSIDIAN_BALANCE;
      case ResourcesIds.Gold:
        return resource.GOLD_BALANCE;
      case ResourcesIds.Silver:
        return resource.SILVER_BALANCE;
      case ResourcesIds.Mithral:
        return resource.MITHRAL_BALANCE;
      case ResourcesIds.AlchemicalSilver:
        return resource.ALCHEMICAL_SILVER_BALANCE;
      case ResourcesIds.ColdIron:
        return resource.COLD_IRON_BALANCE;
      case ResourcesIds.DeepCrystal:
        return resource.DEEP_CRYSTAL_BALANCE;
      case ResourcesIds.Ruby:
        return resource.RUBY_BALANCE;
      case ResourcesIds.Diamonds:
        return resource.DIAMONDS_BALANCE;
      case ResourcesIds.Hartwood:
        return resource.HARTWOOD_BALANCE;
      case ResourcesIds.Ignium:
        return resource.IGNIUM_BALANCE;
      case ResourcesIds.TwilightQuartz:
        return resource.TWILIGHT_QUARTZ_BALANCE;
      case ResourcesIds.TrueIce:
        return resource.TRUE_ICE_BALANCE;
      case ResourcesIds.Adamantine:
        return resource.ADAMANTINE_BALANCE;
      case ResourcesIds.Sapphire:
        return resource.SAPPHIRE_BALANCE;
      case ResourcesIds.EtherealSilica:
        return resource.ETHEREAL_SILICA_BALANCE;
      case ResourcesIds.Dragonhide:
        return resource.DRAGONHIDE_BALANCE;
      case ResourcesIds.Labor:
        return resource.LABOR_BALANCE;
      case ResourcesIds.AncientFragment:
        return resource.EARTHEN_SHARD_BALANCE;
      case ResourcesIds.Donkey:
        return resource.DONKEY_BALANCE;
      case ResourcesIds.Knight:
        return resource.KNIGHT_T1_BALANCE;
      case ResourcesIds.KnightT2:
        return resource.KNIGHT_T2_BALANCE;
      case ResourcesIds.KnightT3:
        return resource.KNIGHT_T3_BALANCE;
      case ResourcesIds.Crossbowman:
        return resource.CROSSBOWMAN_T1_BALANCE;
      case ResourcesIds.CrossbowmanT2:
        return resource.CROSSBOWMAN_T2_BALANCE;
      case ResourcesIds.CrossbowmanT3:
        return resource.CROSSBOWMAN_T3_BALANCE;
      case ResourcesIds.Paladin:
        return resource.PALADIN_T1_BALANCE;
      case ResourcesIds.PaladinT2:
        return resource.PALADIN_T2_BALANCE;
      case ResourcesIds.PaladinT3:
        return resource.PALADIN_T3_BALANCE;
      case ResourcesIds.Wheat:
        return resource.WHEAT_BALANCE;
      case ResourcesIds.Fish:
        return resource.FISH_BALANCE;
      case ResourcesIds.Lords:
        return resource.LORDS_BALANCE;
      default:
        return 0n;
    }
  }

  private _getResource() {
    return getComponentValue(this.components.Resource, getEntityIdFromKeys([BigInt(this.entityId)]));
  }
}
