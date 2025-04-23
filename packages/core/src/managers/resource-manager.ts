// import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import { BuildingType, CapacityConfig, ClientComponents, ID, Resource, ResourcesIds } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { getBuildingCount, kgToGram, multiplyByPrecision } from "../utils";
import { configManager } from "./config-manager";

export class ResourceManager {
  entityId: ID;

  constructor(
    private readonly components: ClientComponents,
    entityId: ID,
  ) {
    this.entityId = entityId;
  }

  public getProduction(resourceId: ResourcesIds) {
    const resource = this._getResource();
    if (!resource) return undefined;

    switch (resourceId) {
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

  public isFood(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  public isActive(resourceId: ResourcesIds): boolean {
    const production = this.getProduction(resourceId);
    if (!production) return false;
    if (this.isFood(resourceId)) {
      return production.production_rate !== 0n;
    }
    return production.building_count > 0 && production.production_rate !== 0n && production.output_amount_left !== 0n;
  }

  public balanceWithProduction(currentTick: number, resourceId: ResourcesIds, hasMaxCapacity: boolean = true): number {
    const production = this.getProduction(resourceId);
    const balance = this.balance(resourceId);
    if (!production) return Number(balance);
    const amountProduced = this._amountProduced(production, currentTick, resourceId);
    if (hasMaxCapacity) {
      const finalBalance = this._limitBalanceByStoreCapacity(balance + amountProduced, resourceId);
      return Number(finalBalance);
    }
    return Number(balance + amountProduced);
  }

  public optimisticResourceUpdate = (resourceId: ResourcesIds, actualResourceChange: number) => {
    const overrideId = uuid();

    const entity = getEntityIdFromKeys([BigInt(this.entityId)]);
    const currentBalance = this.balance(resourceId);
    const weight = configManager.getResourceWeightKg(resourceId);
    // current weight in nanograms per unit with precision
    const currentWeight = getComponentValue(this.components.Resource, entity)?.weight || { capacity: 0n, weight: 0n };
    const amountWithPrecision = BigInt(Math.floor(multiplyByPrecision(actualResourceChange)));
    const weightChange = BigInt(kgToGram(weight)) * amountWithPrecision;

    try {
      switch (resourceId) {
        case ResourcesIds.Stone:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              STONE_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Coal:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              COAL_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Wood:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              WOOD_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Copper:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              COPPER_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Ironwood:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              IRONWOOD_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Obsidian:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              OBSIDIAN_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Gold:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              GOLD_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Silver:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              SILVER_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Mithral:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              MITHRAL_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.AlchemicalSilver:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              ALCHEMICAL_SILVER_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.ColdIron:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              COLD_IRON_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.DeepCrystal:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              DEEP_CRYSTAL_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Ruby:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              RUBY_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Diamonds:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              DIAMONDS_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Hartwood:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              HARTWOOD_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Ignium:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              IGNIUM_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.TwilightQuartz:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              TWILIGHT_QUARTZ_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.TrueIce:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              TRUE_ICE_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Adamantine:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              ADAMANTINE_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Sapphire:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              SAPPHIRE_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.EtherealSilica:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              ETHEREAL_SILICA_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Dragonhide:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              DRAGONHIDE_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Labor:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              LABOR_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.AncientFragment:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              EARTHEN_SHARD_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Donkey:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              DONKEY_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Knight:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              KNIGHT_T1_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.KnightT2:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              KNIGHT_T2_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.KnightT3:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              KNIGHT_T3_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Crossbowman:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              CROSSBOWMAN_T1_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.CrossbowmanT2:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              CROSSBOWMAN_T2_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.CrossbowmanT3:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              CROSSBOWMAN_T3_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Paladin:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              PALADIN_T1_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.PaladinT2:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              PALADIN_T2_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.PaladinT3:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              PALADIN_T3_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Wheat:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              WHEAT_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Fish:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              FISH_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        case ResourcesIds.Lords:
          this.components.Resource.addOverride(overrideId, {
            entity,
            value: {
              weight: {
                ...currentWeight,
                weight: currentWeight.weight + weightChange,
              },
              LORDS_BALANCE: currentBalance + amountWithPrecision,
            },
          });
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(error);
      this.components.Resource.removeOverride(overrideId);
    }

    return () => {
      this.components.Resource.removeOverride(overrideId);
    };
  };

  public timeUntilValueReached(currentTick: number, resourceId: ResourcesIds): number {
    const production = this.getProduction(resourceId);
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

  public getProductionEndsAt(resourceId: ResourcesIds): number {
    const production = this.getProduction(resourceId);
    if (!production || production.building_count === 0) return 0;

    // If no production rate or no output left, return current tick
    if (production.production_rate === 0n || production.output_amount_left === 0n) return production.last_updated_at;

    // For food resources, production never ends
    if (this.isFood(resourceId)) {
      return Number.MAX_SAFE_INTEGER;
    }

    // Calculate when production will end based on remaining output and rate
    const remainingTicks = Number(production.output_amount_left) / Number(production.production_rate);
    return production.last_updated_at + Math.ceil(remainingTicks);
  }

  public getStoreCapacityKg(): { capacityKg: number; quantity: number } {
    const storehouseCapacityKg = configManager.getCapacityConfigKg(CapacityConfig.Storehouse);
    const structureBuildings = getComponentValue(
      this.components.StructureBuildings,
      getEntityIdFromKeys([BigInt(this.entityId || 0)]),
    );

    const structureCapacityKg = configManager.getCapacityConfigKg(CapacityConfig.Structure);

    const packBuildingCounts = [
      structureBuildings?.packed_counts_1 || 0n,
      structureBuildings?.packed_counts_2 || 0n,
      structureBuildings?.packed_counts_3 || 0n,
    ];
    const quantity = getBuildingCount(BuildingType.Storehouse, packBuildingCounts) || 0;

    return {
      capacityKg: Number(quantity) * storehouseCapacityKg + structureCapacityKg,
      quantity,
    };
  }

  private _limitBalanceByStoreCapacity(balance: bigint, resourceId: ResourcesIds): bigint {
    const storeCapacityKg = this.getStoreCapacityKg().capacityKg;

    const maxAmountStorable = multiplyByPrecision(
      storeCapacityKg / (configManager.getResourceWeightKg(resourceId) || 1),
    );

    if (balance > maxAmountStorable) {
      return BigInt(maxAmountStorable);
    }
    return balance;
  }

  private _amountProduced(
    production: {
      building_count: number;
      production_rate: bigint;
      output_amount_left: bigint;
      last_updated_at: number;
    },
    currentTick: number,
    resourceId: ResourcesIds,
  ): bigint {
    if (!production || production.building_count === 0) return 0n;
    if (production.production_rate === 0n) return 0n;

    const ticksSinceLastUpdate = currentTick - production.last_updated_at;
    let totalAmountProduced = BigInt(ticksSinceLastUpdate) * production.production_rate;

    if (!this.isFood(resourceId) && totalAmountProduced > production.output_amount_left) {
      totalAmountProduced = production.output_amount_left;
    }

    return totalAmountProduced;
  }

  public static balance(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    resourceId: ResourcesIds,
  ): bigint {
    if (!resource) return 0n;

    switch (resourceId) {
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

  public balance(resourceId: ResourcesIds): bigint {
    const resource = this._getResource();

    if (!resource) return 0n;

    switch (resourceId) {
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

  /**
   * Returns a list of all resources with their current balances
   * @param nonZeroOnly If true, only returns resources with balances > 0
   * @returns Array of Resource objects containing resourceId and amount
   */
  public getResourceBalances(): Resource[] {
    const resource = this._getResource();
    if (!resource) return [];

    // Define mapping of resource properties to ResourcesIds
    const resourceMapping: [keyof typeof resource, ResourcesIds][] = [
      ["STONE_BALANCE", ResourcesIds.Stone],
      ["COAL_BALANCE", ResourcesIds.Coal],
      ["WOOD_BALANCE", ResourcesIds.Wood],
      ["COPPER_BALANCE", ResourcesIds.Copper],
      ["IRONWOOD_BALANCE", ResourcesIds.Ironwood],
      ["OBSIDIAN_BALANCE", ResourcesIds.Obsidian],
      ["GOLD_BALANCE", ResourcesIds.Gold],
      ["SILVER_BALANCE", ResourcesIds.Silver],
      ["MITHRAL_BALANCE", ResourcesIds.Mithral],
      ["ALCHEMICAL_SILVER_BALANCE", ResourcesIds.AlchemicalSilver],
      ["COLD_IRON_BALANCE", ResourcesIds.ColdIron],
      ["DEEP_CRYSTAL_BALANCE", ResourcesIds.DeepCrystal],
      ["RUBY_BALANCE", ResourcesIds.Ruby],
      ["DIAMONDS_BALANCE", ResourcesIds.Diamonds],
      ["HARTWOOD_BALANCE", ResourcesIds.Hartwood],
      ["IGNIUM_BALANCE", ResourcesIds.Ignium],
      ["TWILIGHT_QUARTZ_BALANCE", ResourcesIds.TwilightQuartz],
      ["TRUE_ICE_BALANCE", ResourcesIds.TrueIce],
      ["ADAMANTINE_BALANCE", ResourcesIds.Adamantine],
      ["SAPPHIRE_BALANCE", ResourcesIds.Sapphire],
      ["ETHEREAL_SILICA_BALANCE", ResourcesIds.EtherealSilica],
      ["DRAGONHIDE_BALANCE", ResourcesIds.Dragonhide],
      ["LABOR_BALANCE", ResourcesIds.Labor],
      ["EARTHEN_SHARD_BALANCE", ResourcesIds.AncientFragment],
      ["DONKEY_BALANCE", ResourcesIds.Donkey],
      ["KNIGHT_T1_BALANCE", ResourcesIds.Knight],
      ["KNIGHT_T2_BALANCE", ResourcesIds.KnightT2],
      ["KNIGHT_T3_BALANCE", ResourcesIds.KnightT3],
      ["CROSSBOWMAN_T1_BALANCE", ResourcesIds.Crossbowman],
      ["CROSSBOWMAN_T2_BALANCE", ResourcesIds.CrossbowmanT2],
      ["CROSSBOWMAN_T3_BALANCE", ResourcesIds.CrossbowmanT3],
      ["PALADIN_T1_BALANCE", ResourcesIds.Paladin],
      ["PALADIN_T2_BALANCE", ResourcesIds.PaladinT2],
      ["PALADIN_T3_BALANCE", ResourcesIds.PaladinT3],
      ["WHEAT_BALANCE", ResourcesIds.Wheat],
      ["FISH_BALANCE", ResourcesIds.Fish],
      ["LORDS_BALANCE", ResourcesIds.Lords],
    ];

    // Use filter and map for a more functional approach
    return resourceMapping
      .filter(([key]) => (resource[key] as bigint) > 0n)
      .map(([key, resourceId]) => ({
        resourceId,
        amount: Number(resource[key]),
      }));
  }

  static getResourceBalances(resource: ComponentValue<ClientComponents["Resource"]["schema"]>): Resource[] {
    const resourceMapping: [keyof typeof resource, ResourcesIds][] = [
      ["STONE_BALANCE", ResourcesIds.Stone],
      ["COAL_BALANCE", ResourcesIds.Coal],
      ["WOOD_BALANCE", ResourcesIds.Wood],
      ["COPPER_BALANCE", ResourcesIds.Copper],
      ["IRONWOOD_BALANCE", ResourcesIds.Ironwood],
      ["OBSIDIAN_BALANCE", ResourcesIds.Obsidian],
      ["GOLD_BALANCE", ResourcesIds.Gold],
      ["SILVER_BALANCE", ResourcesIds.Silver],
      ["MITHRAL_BALANCE", ResourcesIds.Mithral],
      ["ALCHEMICAL_SILVER_BALANCE", ResourcesIds.AlchemicalSilver],
      ["COLD_IRON_BALANCE", ResourcesIds.ColdIron],
      ["DEEP_CRYSTAL_BALANCE", ResourcesIds.DeepCrystal],
      ["RUBY_BALANCE", ResourcesIds.Ruby],
      ["DIAMONDS_BALANCE", ResourcesIds.Diamonds],
      ["HARTWOOD_BALANCE", ResourcesIds.Hartwood],
      ["IGNIUM_BALANCE", ResourcesIds.Ignium],
      ["TWILIGHT_QUARTZ_BALANCE", ResourcesIds.TwilightQuartz],
      ["TRUE_ICE_BALANCE", ResourcesIds.TrueIce],
      ["ADAMANTINE_BALANCE", ResourcesIds.Adamantine],
      ["SAPPHIRE_BALANCE", ResourcesIds.Sapphire],
      ["ETHEREAL_SILICA_BALANCE", ResourcesIds.EtherealSilica],
      ["DRAGONHIDE_BALANCE", ResourcesIds.Dragonhide],
      ["LABOR_BALANCE", ResourcesIds.Labor],
      ["EARTHEN_SHARD_BALANCE", ResourcesIds.AncientFragment],
      ["DONKEY_BALANCE", ResourcesIds.Donkey],
      ["KNIGHT_T1_BALANCE", ResourcesIds.Knight],
      ["KNIGHT_T2_BALANCE", ResourcesIds.KnightT2],
      ["KNIGHT_T3_BALANCE", ResourcesIds.KnightT3],
      ["CROSSBOWMAN_T1_BALANCE", ResourcesIds.Crossbowman],
      ["CROSSBOWMAN_T2_BALANCE", ResourcesIds.CrossbowmanT2],
      ["CROSSBOWMAN_T3_BALANCE", ResourcesIds.CrossbowmanT3],
      ["PALADIN_T1_BALANCE", ResourcesIds.Paladin],
      ["PALADIN_T2_BALANCE", ResourcesIds.PaladinT2],
      ["PALADIN_T3_BALANCE", ResourcesIds.PaladinT3],
      ["WHEAT_BALANCE", ResourcesIds.Wheat],
      ["FISH_BALANCE", ResourcesIds.Fish],
      ["LORDS_BALANCE", ResourcesIds.Lords],
    ];

    return resourceMapping
      .filter(([key]) => (resource[key] as bigint) > 0n)
      .map(([key, resourceId]) => ({
        resourceId,
        amount: Number(resource[key]),
      }));
  }

  private static _amountProduced(
    production: {
      building_count: number;
      production_rate: bigint;
      output_amount_left: bigint;
      last_updated_at: number;
    },
    currentTick: number,
    isFood: boolean,
  ): bigint {
    if (!production || production.building_count === 0) return 0n;
    if (production.production_rate === 0n) return 0n;

    const ticksSinceLastUpdate = currentTick - production.last_updated_at;
    let totalAmountProduced = BigInt(ticksSinceLastUpdate) * production.production_rate;

    if (!isFood && totalAmountProduced > production.output_amount_left) {
      totalAmountProduced = production.output_amount_left;
    }

    return totalAmountProduced;
  }

  private static _getBalance(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    resourceId: ResourcesIds,
  ): bigint {
    switch (resourceId) {
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

  public static balanceWithProduction(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    currentTick: number,
    resourceId: ResourcesIds,
  ): number {
    if (!resource) return 0;

    const balance = ResourceManager._getBalance(resource, resourceId);
    const isFood = resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;

    let production;
    switch (resourceId) {
      case ResourcesIds.Stone:
        production = resource.STONE_PRODUCTION;
        break;
      case ResourcesIds.Coal:
        production = resource.COAL_PRODUCTION;
        break;
      case ResourcesIds.Wood:
        production = resource.WOOD_PRODUCTION;
        break;
      case ResourcesIds.Copper:
        production = resource.COPPER_PRODUCTION;
        break;
      case ResourcesIds.Ironwood:
        production = resource.IRONWOOD_PRODUCTION;
        break;
      case ResourcesIds.Obsidian:
        production = resource.OBSIDIAN_PRODUCTION;
        break;
      case ResourcesIds.Gold:
        production = resource.GOLD_PRODUCTION;
        break;
      case ResourcesIds.Silver:
        production = resource.SILVER_PRODUCTION;
        break;
      case ResourcesIds.Mithral:
        production = resource.MITHRAL_PRODUCTION;
        break;
      case ResourcesIds.AlchemicalSilver:
        production = resource.ALCHEMICAL_SILVER_PRODUCTION;
        break;
      case ResourcesIds.ColdIron:
        production = resource.COLD_IRON_PRODUCTION;
        break;
      case ResourcesIds.DeepCrystal:
        production = resource.DEEP_CRYSTAL_PRODUCTION;
        break;
      case ResourcesIds.Ruby:
        production = resource.RUBY_PRODUCTION;
        break;
      case ResourcesIds.Diamonds:
        production = resource.DIAMONDS_PRODUCTION;
        break;
      case ResourcesIds.Hartwood:
        production = resource.HARTWOOD_PRODUCTION;
        break;
      case ResourcesIds.Ignium:
        production = resource.IGNIUM_PRODUCTION;
        break;
      case ResourcesIds.TwilightQuartz:
        production = resource.TWILIGHT_QUARTZ_PRODUCTION;
        break;
      case ResourcesIds.TrueIce:
        production = resource.TRUE_ICE_PRODUCTION;
        break;
      case ResourcesIds.Adamantine:
        production = resource.ADAMANTINE_PRODUCTION;
        break;
      case ResourcesIds.Sapphire:
        production = resource.SAPPHIRE_PRODUCTION;
        break;
      case ResourcesIds.EtherealSilica:
        production = resource.ETHEREAL_SILICA_PRODUCTION;
        break;
      case ResourcesIds.Dragonhide:
        production = resource.DRAGONHIDE_PRODUCTION;
        break;
      case ResourcesIds.Labor:
        production = resource.LABOR_PRODUCTION;
        break;
      case ResourcesIds.AncientFragment:
        production = resource.EARTHEN_SHARD_PRODUCTION;
        break;
      case ResourcesIds.Donkey:
        production = resource.DONKEY_PRODUCTION;
        break;
      case ResourcesIds.Knight:
        production = resource.KNIGHT_T1_PRODUCTION;
        break;
      case ResourcesIds.KnightT2:
        production = resource.KNIGHT_T2_PRODUCTION;
        break;
      case ResourcesIds.KnightT3:
        production = resource.KNIGHT_T3_PRODUCTION;
        break;
      case ResourcesIds.Crossbowman:
        production = resource.CROSSBOWMAN_T1_PRODUCTION;
        break;
      case ResourcesIds.CrossbowmanT2:
        production = resource.CROSSBOWMAN_T2_PRODUCTION;
        break;
      case ResourcesIds.CrossbowmanT3:
        production = resource.CROSSBOWMAN_T3_PRODUCTION;
        break;
      case ResourcesIds.Paladin:
        production = resource.PALADIN_T1_PRODUCTION;
        break;
      case ResourcesIds.PaladinT2:
        production = resource.PALADIN_T2_PRODUCTION;
        break;
      case ResourcesIds.PaladinT3:
        production = resource.PALADIN_T3_PRODUCTION;
        break;
      case ResourcesIds.Wheat:
        production = resource.WHEAT_PRODUCTION;
        break;
      case ResourcesIds.Fish:
        production = resource.FISH_PRODUCTION;
        break;
      case ResourcesIds.Lords:
        production = resource.LORDS_PRODUCTION;
        break;
      default:
        return Number(balance);
    }

    if (!production) return Number(balance);
    const amountProduced = ResourceManager._amountProduced(production, currentTick, isFood);
    return Number(balance + amountProduced);
  }
}
