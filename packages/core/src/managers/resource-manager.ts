// import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import {
  BuildingType,
  ClientComponents,
  ID,
  RelicEffect,
  Resource,
  RESOURCE_PRECISION,
  ResourcesIds,
  TickIds,
} from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { getBuildingCount, gramToKg, kgToGram, multiplyByPrecision } from "../utils";
import { configManager } from "./config-manager";

export class ResourceManager {
  entityId: ID;

  constructor(
    private readonly components: ClientComponents,
    entityId: ID,
  ) {
    this.entityId = entityId;
  }

  public getResource() {
    return this._getResource();
  }

  private _getResource() {
    return getComponentValue(this.components.Resource, getEntityIdFromKeys([BigInt(this.entityId)]));
  }

  public isFood(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  public isActive(resourceId: ResourcesIds): boolean {
    const resource = this._getResource();
    if (!resource) return false;
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
    if (!production) return false;
    if (this.isFood(resourceId)) {
      return production.production_rate !== 0n;
    }
    return production.building_count > 0 && production.production_rate !== 0n && production.output_amount_left !== 0n;
  }

  public balanceWithProduction(
    currentTick: number,
    resourceId: ResourcesIds,
  ): { balance: number; hasReachedMaxCapacity: boolean; amountProduced: bigint; amountProducedLimited: bigint } {
    const resource = this._getResource();
    if (!resource) return { balance: 0, hasReachedMaxCapacity: false, amountProduced: 0n, amountProducedLimited: 0n };
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
    const balance = this.balance(resourceId);
    if (!production)
      return { balance: Number(balance), hasReachedMaxCapacity: false, amountProduced: 0n, amountProducedLimited: 0n };
    const amountProduced = this._amountProduced(production, currentTick, resourceId);
    const amountProducedLimited = this._limitProductionByStoreCapacity(amountProduced, resourceId);
    return {
      balance: Number(balance + amountProducedLimited),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced,
      amountProduced,
      amountProducedLimited,
    };
  }

  public getRelicEffect(
    resourceId: ResourcesIds,
  ): ComponentValue<ClientComponents["RelicEffect"]["schema"]> | undefined {
    if (!ResourceManager.isRelic(resourceId)) return undefined;
    const relicEffect = getComponentValue(
      this.components.RelicEffect,
      getEntityIdFromKeys([BigInt(this.entityId), BigInt(resourceId)]),
    );
    return relicEffect;
  }

  public isRelicActive(resourceId: ResourcesIds, currentTick: number): boolean {
    if (!ResourceManager.isRelic(resourceId)) return false;

    const relicEffect = this.getRelicEffect(resourceId);
    if (!relicEffect) return false;

    return ResourceManager.isRelicActive(
      {
        start_tick: relicEffect.effect_start_tick,
        end_tick: relicEffect.effect_end_tick,
        usage_left: relicEffect.effect_usage_left,
      },
      currentTick,
    );
  }

  public getRelicTimeUntilExpiry(resourceId: ResourcesIds, currentTick: number): number {
    if (!ResourceManager.isRelic(resourceId)) return 0;

    const relicEffect = this.getRelicEffect(resourceId);
    if (!relicEffect) return 0;

    // Check if relic is still active
    if (!this.isRelicActive(resourceId, currentTick)) return 0;

    // Get tick interval for armies (since relics use army ticks)
    const tickInterval = configManager.getTick(TickIds.Armies) || 1;

    // Calculate time remaining in seconds
    return ResourceManager.relicsTimeLeft(relicEffect.effect_end_tick, currentTick, tickInterval);
  }

  public optimisticResourceUpdate = (resourceId: ResourcesIds, actualResourceChange: number) => {
    const overrideId = uuid();

    const entity = getEntityIdFromKeys([BigInt(this.entityId)]);
    const currentBalance = this.balance(resourceId);
    const weight = configManager.getResourceWeightKg(resourceId) || 0;
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
    const resource = this._getResource();
    if (!resource) return 0;
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
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
    const resource = this._getResource();
    if (!resource) return 0;
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
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

  public getStoreCapacityKg(): { capacityKg: number; capacityUsedKg: number; quantity: number } {
    const resource = this._getResource()!;
    const structureBuildings = getComponentValue(
      this.components.StructureBuildings,
      getEntityIdFromKeys([BigInt(this.entityId || 0)]),
    );
    const packBuildingCounts = [
      structureBuildings?.packed_counts_1 || 0n,
      structureBuildings?.packed_counts_2 || 0n,
      structureBuildings?.packed_counts_3 || 0n,
    ];
    const quantity = structureBuildings ? getBuildingCount(BuildingType.Storehouse, packBuildingCounts) || 0 : 0;

    return {
      capacityKg: gramToKg(Number(resource?.weight.capacity || 0) / RESOURCE_PRECISION),
      capacityUsedKg: gramToKg(Number(resource?.weight.weight || 0) / RESOURCE_PRECISION),
      quantity,
    };
  }

  public balance(resourceId: ResourcesIds): bigint {
    const resource = this._getResource();
    if (!resource) return 0n;
    return ResourceManager.balanceAndProduction(resource, resourceId).balance;
  }

  private _limitProductionByStoreCapacity(amountProduced: bigint, resourceId: ResourcesIds): bigint {
    const { capacityKg, capacityUsedKg } = this.getStoreCapacityKg();
    const capacityLeft = capacityKg - capacityUsedKg;

    const maxAmountStorable = multiplyByPrecision(capacityLeft / (configManager.getResourceWeightKg(resourceId) || 1));

    if (amountProduced > maxAmountStorable) {
      return BigInt(maxAmountStorable);
    }
    return amountProduced;
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

  /**
   * STATIC FUNCTIONS
   * all the static functions are used when we don't have recs synced
   * in that case, we can query the components by other means (sql, grpc) and pass in the component values
   */
  public static balanceAndProduction(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    resourceId: ResourcesIds,
  ): {
    balance: bigint;
    production: {
      building_count: number;
      production_rate: bigint;
      output_amount_left: bigint;
      last_updated_at: number;
    };
  } {
    const noProduction = {
      building_count: 0,
      production_rate: 0n,
      output_amount_left: 0n,
      last_updated_at: 0,
    };
    switch (resourceId) {
      case ResourcesIds.Stone:
        return { balance: resource.STONE_BALANCE, production: resource.STONE_PRODUCTION };
      case ResourcesIds.Coal:
        return { balance: resource.COAL_BALANCE, production: resource.COAL_PRODUCTION };
      case ResourcesIds.Wood:
        return { balance: resource.WOOD_BALANCE, production: resource.WOOD_PRODUCTION };
      case ResourcesIds.Copper:
        return { balance: resource.COPPER_BALANCE, production: resource.COPPER_PRODUCTION };
      case ResourcesIds.Ironwood:
        return { balance: resource.IRONWOOD_BALANCE, production: resource.IRONWOOD_PRODUCTION };
      case ResourcesIds.Obsidian:
        return { balance: resource.OBSIDIAN_BALANCE, production: resource.OBSIDIAN_PRODUCTION };
      case ResourcesIds.Gold:
        return { balance: resource.GOLD_BALANCE, production: resource.GOLD_PRODUCTION };
      case ResourcesIds.Silver:
        return { balance: resource.SILVER_BALANCE, production: resource.SILVER_PRODUCTION };
      case ResourcesIds.Mithral:
        return { balance: resource.MITHRAL_BALANCE, production: resource.MITHRAL_PRODUCTION };
      case ResourcesIds.AlchemicalSilver:
        return { balance: resource.ALCHEMICAL_SILVER_BALANCE, production: resource.ALCHEMICAL_SILVER_PRODUCTION };
      case ResourcesIds.ColdIron:
        return { balance: resource.COLD_IRON_BALANCE, production: resource.COLD_IRON_PRODUCTION };
      case ResourcesIds.DeepCrystal:
        return { balance: resource.DEEP_CRYSTAL_BALANCE, production: resource.DEEP_CRYSTAL_PRODUCTION };
      case ResourcesIds.Ruby:
        return { balance: resource.RUBY_BALANCE, production: resource.RUBY_PRODUCTION };
      case ResourcesIds.Diamonds:
        return { balance: resource.DIAMONDS_BALANCE, production: resource.DIAMONDS_PRODUCTION };
      case ResourcesIds.Hartwood:
        return { balance: resource.HARTWOOD_BALANCE, production: resource.HARTWOOD_PRODUCTION };
      case ResourcesIds.Ignium:
        return { balance: resource.IGNIUM_BALANCE, production: resource.IGNIUM_PRODUCTION };
      case ResourcesIds.TwilightQuartz:
        return { balance: resource.TWILIGHT_QUARTZ_BALANCE, production: resource.TWILIGHT_QUARTZ_PRODUCTION };
      case ResourcesIds.TrueIce:
        return { balance: resource.TRUE_ICE_BALANCE, production: resource.TRUE_ICE_PRODUCTION };
      case ResourcesIds.Adamantine:
        return { balance: resource.ADAMANTINE_BALANCE, production: resource.ADAMANTINE_PRODUCTION };
      case ResourcesIds.Sapphire:
        return { balance: resource.SAPPHIRE_BALANCE, production: resource.SAPPHIRE_PRODUCTION };
      case ResourcesIds.EtherealSilica:
        return { balance: resource.ETHEREAL_SILICA_BALANCE, production: resource.ETHEREAL_SILICA_PRODUCTION };
      case ResourcesIds.Dragonhide:
        return { balance: resource.DRAGONHIDE_BALANCE, production: resource.DRAGONHIDE_PRODUCTION };
      case ResourcesIds.Labor:
        return { balance: resource.LABOR_BALANCE, production: resource.LABOR_PRODUCTION };
      case ResourcesIds.AncientFragment:
        return { balance: resource.EARTHEN_SHARD_BALANCE, production: resource.EARTHEN_SHARD_PRODUCTION };
      case ResourcesIds.Donkey:
        return { balance: resource.DONKEY_BALANCE, production: resource.DONKEY_PRODUCTION };
      case ResourcesIds.Knight:
        return { balance: resource.KNIGHT_T1_BALANCE, production: resource.KNIGHT_T1_PRODUCTION };
      case ResourcesIds.KnightT2:
        return { balance: resource.KNIGHT_T2_BALANCE, production: resource.KNIGHT_T2_PRODUCTION };
      case ResourcesIds.KnightT3:
        return { balance: resource.KNIGHT_T3_BALANCE, production: resource.KNIGHT_T3_PRODUCTION };
      case ResourcesIds.Crossbowman:
        return { balance: resource.CROSSBOWMAN_T1_BALANCE, production: resource.CROSSBOWMAN_T1_PRODUCTION };
      case ResourcesIds.CrossbowmanT2:
        return { balance: resource.CROSSBOWMAN_T2_BALANCE, production: resource.CROSSBOWMAN_T2_PRODUCTION };
      case ResourcesIds.CrossbowmanT3:
        return { balance: resource.CROSSBOWMAN_T3_BALANCE, production: resource.CROSSBOWMAN_T3_PRODUCTION };
      case ResourcesIds.Paladin:
        return { balance: resource.PALADIN_T1_BALANCE, production: resource.PALADIN_T1_PRODUCTION };
      case ResourcesIds.PaladinT2:
        return { balance: resource.PALADIN_T2_BALANCE, production: resource.PALADIN_T2_PRODUCTION };
      case ResourcesIds.PaladinT3:
        return { balance: resource.PALADIN_T3_BALANCE, production: resource.PALADIN_T3_PRODUCTION };
      case ResourcesIds.Wheat:
        return { balance: resource.WHEAT_BALANCE, production: resource.WHEAT_PRODUCTION };
      case ResourcesIds.Fish:
        return { balance: resource.FISH_BALANCE, production: resource.FISH_PRODUCTION };
      case ResourcesIds.Lords:
        return { balance: resource.LORDS_BALANCE, production: resource.LORDS_PRODUCTION };
      case ResourcesIds.Essence:
        return {
          balance: resource.ESSENCE_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.StaminaRelic2:
        return {
          balance: resource.RELIC_E1_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.DamageRelic1:
        return {
          balance: resource.RELIC_E2_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.DamageReductionRelic1:
        return {
          balance: resource.RELIC_E3_BALANCE,
          production: noProduction,
        };
      default:
        return {
          balance: 0n,
          production: {
            building_count: 0,
            production_rate: 0n,
            output_amount_left: 0n,
            last_updated_at: 0,
          },
        };
    }
  }

  static getResourceMapping(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
  ): [keyof typeof resource, ResourcesIds][] {
    return [
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
      ["ESSENCE_BALANCE", ResourcesIds.Essence],
      ["RELIC_E1_BALANCE", ResourcesIds.StaminaRelic2],
      ["RELIC_E2_BALANCE", ResourcesIds.DamageRelic1],
      ["RELIC_E3_BALANCE", ResourcesIds.DamageReductionRelic1],
    ];
  }

  static getResourceBalances(resource: ComponentValue<ClientComponents["Resource"]["schema"]>): Resource[] {
    const resourceMapping = ResourceManager.getResourceMapping(resource);
    return resourceMapping
      .filter(([key]) => (resource[key] as bigint) > 0n)
      .map(([key, resourceId]) => ({
        resourceId,
        amount: Number(resource[key]),
      }));
  }

  static getResourceBalancesWithProduction(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    currentTick: number,
  ): Resource[] {
    const resourceMapping = ResourceManager.getResourceMapping(resource);
    return resourceMapping.map(([_, resourceId]) => {
      const { balance } = ResourceManager.balanceWithProduction(resource, currentTick, resourceId);
      return {
        resourceId,
        amount: balance,
      };
    });
  }

  public static balanceWithProduction(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    currentTick: number,
    resourceId: ResourcesIds,
  ): { balance: number; hasReachedMaxCapacity: boolean } {
    const resourceWeightKg = configManager.getResourceWeightKg(resourceId);
    const { balance, production } = this.balanceAndProduction(resource, resourceId);
    if (!production) return { balance: Number(balance), hasReachedMaxCapacity: false };

    const amountProduced = this._amountProducedStatic(production, currentTick, resourceId);
    const amountProducedLimited = this._limitProductionByStoreCapacityStatic(
      amountProduced,
      resourceWeightKg,
      Number(resource?.weight.capacity || 0),
      Number(resource?.weight.weight || 0),
    );

    return {
      balance: Number(balance + amountProducedLimited),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced,
    };
  }

  public static isRelic(resourceId: ResourcesIds): boolean {
    return resourceId >= 39; // Relics start from ID 39 onwards
  }

  public static isRelicActive({ start_tick, end_tick, usage_left }: RelicEffect, currentTick: number): boolean {
    // Check if the effect is within the active time window
    const isWithinTimeWindow = currentTick >= start_tick && currentTick <= end_tick;

    // Check if there are remaining uses (if applicable)
    const hasUsagesLeft = usage_left > 0;

    return isWithinTimeWindow && hasUsagesLeft;
  }

  public static relicsArmiesTicksLeft(end_tick: number, currentArmiesTick: number): number {
    return end_tick - currentArmiesTick;
  }

  public static relicsTimeLeft(end_tick: number, currentTick: number, secondsPerTick: number): number {
    return (end_tick - currentTick) * secondsPerTick;
  }

  private static _amountProducedStatic(
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

    const isFood = resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
    if (!isFood && totalAmountProduced > production.output_amount_left) {
      totalAmountProduced = production.output_amount_left;
    }

    return totalAmountProduced;
  }

  private static _limitProductionByStoreCapacityStatic(
    amountProduced: bigint,
    resourceWeightKg: number,
    storeCapacityKg: number,
    storeUsedKg: number,
  ): bigint {
    const capacityLeft = storeCapacityKg - storeUsedKg;
    const maxAmountStorable = multiplyByPrecision(capacityLeft / (resourceWeightKg || 1));

    if (amountProduced > maxAmountStorable) {
      return BigInt(maxAmountStorable);
    }
    return amountProduced;
  }
}
