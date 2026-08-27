// import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import { BuildingType, ClientComponents, ID, Resource, ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getBuildingCount, gramToKg, multiplyByPrecision } from "../utils";
import { reportObservedChainTimestamp } from "../utils/timestamp";
import { configManager, gameEntityKey } from "./config-manager";

export interface ResourceProductionData {
  productionPerSecond: number;
  isProducing: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
}

// Rows indexed from preconfirmed blocks can carry a last_updated_at ahead of the
// client's chain-time heartbeat; elapsed production floors at zero, never negative.
// The floor silently discards real accrual, so a row ahead of the clock is also
// reported as chain-time evidence (the clock re-anchors and the next read heals)
// and a large discard — beyond normal block/poll jitter — warns loudly.
const ELAPSED_FLOOR_WARN_THRESHOLD_SECONDS = 30;
const ELAPSED_FLOOR_WARN_INTERVAL_MS = 60_000;
let lastElapsedFloorWarnAtMs = 0;

const elapsedProductionTicks = (lastUpdatedAt: number, currentTick: number): number => {
  const elapsed = currentTick - lastUpdatedAt;
  if (!Number.isFinite(elapsed)) return 0;
  if (elapsed > 0) return Math.floor(elapsed);

  if (elapsed < 0) {
    reportObservedChainTimestamp(lastUpdatedAt);
    if (
      elapsed < -ELAPSED_FLOOR_WARN_THRESHOLD_SECONDS &&
      Date.now() - lastElapsedFloorWarnAtMs > ELAPSED_FLOOR_WARN_INTERVAL_MS
    ) {
      lastElapsedFloorWarnAtMs = Date.now();
      console.warn(
        `[ChainTime] production row is ${Math.round(-elapsed)}s ahead of the client clock — accrual display floored to zero (row last_updated_at=${lastUpdatedAt}, client tick=${currentTick})`,
      );
    }
  }
  return 0;
};

// s2 changed production_rate to u64 (schema: number); internal math stays bigint.
// Absent members (partial RECS rows, test fixtures) normalize to zero production.
const normalizeProduction = (
  production:
    | {
        building_count: number;
        production_rate: number | bigint;
        output_amount_left: bigint;
        last_updated_at: number;
      }
    | undefined,
) =>
  production
    ? { ...production, production_rate: BigInt(production.production_rate ?? 0) }
    : { building_count: 0, production_rate: 0n, output_amount_left: 0n, last_updated_at: 0 };

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
    return getComponentValue(this.components.Resource, gameEntityKey([BigInt(this.entityId)]));
  }

  private static isContinuousProductionResource(resourceId: ResourcesIds): boolean {
    return (
      resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish || resourceId === ResourcesIds.Research
    );
  }

  public isFood(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  public isActive(resourceId: ResourcesIds): boolean {
    const resource = this._getResource();
    if (!resource) return false;
    return ResourceManager.isActiveStatic(resource, resourceId);
  }

  public static isActiveStatic(
    resource: ComponentValue<ClientComponents["Resource"]["schema"]>,
    resourceId: ResourcesIds,
  ): boolean {
    if (!resource) return false;
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
    if (!production) return false;

    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);
    if (isContinuousProductionResource) {
      if (resourceId === ResourcesIds.Research) {
        return production.building_count > 0 && production.production_rate !== 0n;
      }
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
    const amountProduced = ResourceManager._amountProducedStatic(production, currentTick, resourceId);
    const amountProducedLimited = this._limitProductionByStoreCapacity(amountProduced, resourceId);
    return {
      balance: Number(balance + amountProducedLimited),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced,
      amountProduced,
      amountProducedLimited,
    };
  }

  public timeUntilValueReached(currentTick: number, resourceId: ResourcesIds): number {
    const resource = this._getResource();
    if (!resource) return 0;
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
    if (!production || production.building_count === 0) return 0;

    // Get production details
    const lastUpdatedTick = production.last_updated_at;
    const productionRate = production.production_rate;
    const outputAmountLeft = production.output_amount_left;
    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);

    if (productionRate === 0n) return 0;
    if (isContinuousProductionResource) return Number.MAX_SAFE_INTEGER;
    if (outputAmountLeft === 0n) return 0;

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

    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);
    if (production.production_rate === 0n) return production.last_updated_at;
    if (isContinuousProductionResource) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (production.output_amount_left === 0n) return production.last_updated_at;

    // Calculate when production will end based on remaining output and rate
    const remainingTicks = Number(production.output_amount_left) / Number(production.production_rate);
    return production.last_updated_at + Math.ceil(remainingTicks);
  }

  public getStoreCapacityKg(): { capacityKg: number; capacityUsedKg: number; quantity: number } {
    const resource = this._getResource()!;
    const structureBuildings = getComponentValue(
      this.components.StructureBuildings,
      gameEntityKey([BigInt(this.entityId || 0)]),
    );
    const packBuildingCounts = [
      structureBuildings?.packed_counts_1 || 0n,
      structureBuildings?.packed_counts_2 || 0n,
      structureBuildings?.packed_counts_3 || 0n,
    ];
    const quantity = structureBuildings ? getBuildingCount(BuildingType.Storehouse, packBuildingCounts) || 0 : 0;

    return {
      capacityKg: gramToKg(divideByPrecision(Number(resource?.weight.capacity || 0))),
      capacityUsedKg: gramToKg(Math.max(0, divideByPrecision(Number(resource?.weight.weight || 0)))),
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
    return ResourceManager._limitProductionByStoreCapacityStatic(
      amountProduced,
      configManager.getResourceWeightKg(resourceId) || 0,
      capacityKg,
      capacityUsedKg,
    );
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
        return { balance: resource.STONE_BALANCE, production: normalizeProduction(resource.STONE_PRODUCTION) };
      case ResourcesIds.Coal:
        return { balance: resource.COAL_BALANCE, production: normalizeProduction(resource.COAL_PRODUCTION) };
      case ResourcesIds.Wood:
        return { balance: resource.WOOD_BALANCE, production: normalizeProduction(resource.WOOD_PRODUCTION) };
      case ResourcesIds.Copper:
        return { balance: resource.COPPER_BALANCE, production: normalizeProduction(resource.COPPER_PRODUCTION) };
      case ResourcesIds.Ironwood:
        return { balance: resource.IRONWOOD_BALANCE, production: normalizeProduction(resource.IRONWOOD_PRODUCTION) };
      case ResourcesIds.Obsidian:
        return { balance: resource.OBSIDIAN_BALANCE, production: normalizeProduction(resource.OBSIDIAN_PRODUCTION) };
      case ResourcesIds.Gold:
        return { balance: resource.GOLD_BALANCE, production: normalizeProduction(resource.GOLD_PRODUCTION) };
      case ResourcesIds.Silver:
        return { balance: resource.SILVER_BALANCE, production: normalizeProduction(resource.SILVER_PRODUCTION) };
      case ResourcesIds.Mithral:
        return { balance: resource.MITHRAL_BALANCE, production: normalizeProduction(resource.MITHRAL_PRODUCTION) };
      case ResourcesIds.AlchemicalSilver:
        return {
          balance: resource.ALCHEMICAL_SILVER_BALANCE,
          production: normalizeProduction(resource.ALCHEMICAL_SILVER_PRODUCTION),
        };
      case ResourcesIds.ColdIron:
        return { balance: resource.COLD_IRON_BALANCE, production: normalizeProduction(resource.COLD_IRON_PRODUCTION) };
      case ResourcesIds.DeepCrystal:
        return {
          balance: resource.DEEP_CRYSTAL_BALANCE,
          production: normalizeProduction(resource.DEEP_CRYSTAL_PRODUCTION),
        };
      case ResourcesIds.Ruby:
        return { balance: resource.RUBY_BALANCE, production: normalizeProduction(resource.RUBY_PRODUCTION) };
      case ResourcesIds.Diamonds:
        return { balance: resource.DIAMONDS_BALANCE, production: normalizeProduction(resource.DIAMONDS_PRODUCTION) };
      case ResourcesIds.Hartwood:
        return { balance: resource.HARTWOOD_BALANCE, production: normalizeProduction(resource.HARTWOOD_PRODUCTION) };
      case ResourcesIds.Ignium:
        return { balance: resource.IGNIUM_BALANCE, production: normalizeProduction(resource.IGNIUM_PRODUCTION) };
      case ResourcesIds.TwilightQuartz:
        return {
          balance: resource.TWILIGHT_QUARTZ_BALANCE,
          production: normalizeProduction(resource.TWILIGHT_QUARTZ_PRODUCTION),
        };
      case ResourcesIds.TrueIce:
        return { balance: resource.TRUE_ICE_BALANCE, production: normalizeProduction(resource.TRUE_ICE_PRODUCTION) };
      case ResourcesIds.Adamantine:
        return {
          balance: resource.ADAMANTINE_BALANCE,
          production: normalizeProduction(resource.ADAMANTINE_PRODUCTION),
        };
      case ResourcesIds.Sapphire:
        return { balance: resource.SAPPHIRE_BALANCE, production: normalizeProduction(resource.SAPPHIRE_PRODUCTION) };
      case ResourcesIds.EtherealSilica:
        return {
          balance: resource.ETHEREAL_SILICA_BALANCE,
          production: normalizeProduction(resource.ETHEREAL_SILICA_PRODUCTION),
        };
      case ResourcesIds.Dragonhide:
        return {
          balance: resource.DRAGONHIDE_BALANCE,
          production: normalizeProduction(resource.DRAGONHIDE_PRODUCTION),
        };
      case ResourcesIds.Labor:
        return { balance: resource.LABOR_BALANCE, production: normalizeProduction(resource.LABOR_PRODUCTION) };
      case ResourcesIds.AncientFragment:
        return {
          balance: resource.EARTHEN_SHARD_BALANCE,
          production: normalizeProduction(resource.EARTHEN_SHARD_PRODUCTION),
        };
      case ResourcesIds.Donkey:
        return { balance: resource.DONKEY_BALANCE, production: normalizeProduction(resource.DONKEY_PRODUCTION) };
      case ResourcesIds.Knight:
        return { balance: resource.KNIGHT_T1_BALANCE, production: normalizeProduction(resource.KNIGHT_T1_PRODUCTION) };
      case ResourcesIds.KnightT2:
        return { balance: resource.KNIGHT_T2_BALANCE, production: normalizeProduction(resource.KNIGHT_T2_PRODUCTION) };
      case ResourcesIds.KnightT3:
        return { balance: resource.KNIGHT_T3_BALANCE, production: normalizeProduction(resource.KNIGHT_T3_PRODUCTION) };
      case ResourcesIds.Crossbowman:
        return {
          balance: resource.CROSSBOWMAN_T1_BALANCE,
          production: normalizeProduction(resource.CROSSBOWMAN_T1_PRODUCTION),
        };
      case ResourcesIds.CrossbowmanT2:
        return {
          balance: resource.CROSSBOWMAN_T2_BALANCE,
          production: normalizeProduction(resource.CROSSBOWMAN_T2_PRODUCTION),
        };
      case ResourcesIds.CrossbowmanT3:
        return {
          balance: resource.CROSSBOWMAN_T3_BALANCE,
          production: normalizeProduction(resource.CROSSBOWMAN_T3_PRODUCTION),
        };
      case ResourcesIds.Paladin:
        return {
          balance: resource.PALADIN_T1_BALANCE,
          production: normalizeProduction(resource.PALADIN_T1_PRODUCTION),
        };
      case ResourcesIds.PaladinT2:
        return {
          balance: resource.PALADIN_T2_BALANCE,
          production: normalizeProduction(resource.PALADIN_T2_PRODUCTION),
        };
      case ResourcesIds.PaladinT3:
        return {
          balance: resource.PALADIN_T3_BALANCE,
          production: normalizeProduction(resource.PALADIN_T3_PRODUCTION),
        };
      case ResourcesIds.Wheat:
        return { balance: resource.WHEAT_BALANCE, production: normalizeProduction(resource.WHEAT_PRODUCTION) };
      case ResourcesIds.Fish:
        return { balance: resource.FISH_BALANCE, production: normalizeProduction(resource.FISH_PRODUCTION) };
      case ResourcesIds.Lords:
        return { balance: resource.LORDS_BALANCE, production: normalizeProduction(resource.LORDS_PRODUCTION) };
      case ResourcesIds.Essence:
        return { balance: resource.ESSENCE_BALANCE, production: normalizeProduction(resource.ESSENCE_PRODUCTION) };
      case ResourcesIds.Research:
        return {
          balance: ((resource as Record<string, unknown>).RESEARCH_BALANCE as bigint | undefined) ?? 0n,
          production: normalizeProduction(
            ((resource as Record<string, unknown>).RESEARCH_PRODUCTION as
              | {
                  building_count: number;
                  production_rate: number | bigint;
                  output_amount_left: bigint;
                  last_updated_at: number;
                }
              | undefined) ?? noProduction,
          ),
        };
      case ResourcesIds.StaminaRelic1:
        return {
          balance: resource.RELIC_E1_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.StaminaRelic2:
        return {
          balance: resource.RELIC_E2_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.DamageRelic1:
        return {
          balance: resource.RELIC_E3_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.DamageRelic2:
        return {
          balance: resource.RELIC_E4_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.DamageReductionRelic1:
        return {
          balance: resource.RELIC_E5_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.DamageReductionRelic2:
        return {
          balance: resource.RELIC_E6_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.ExplorationRelic1:
        return {
          balance: resource.RELIC_E7_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.ExplorationRelic2:
        return {
          balance: resource.RELIC_E8_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.ExplorationRewardRelic1:
        return {
          balance: resource.RELIC_E9_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.ExplorationRewardRelic2:
        return {
          balance: resource.RELIC_E10_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.StructureDamageReductionRelic1:
        return {
          balance: resource.RELIC_E11_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.StructureDamageReductionRelic2:
        return {
          balance: resource.RELIC_E12_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.ProductionRelic1:
        return {
          balance: resource.RELIC_E13_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.ProductionRelic2:
        return {
          balance: resource.RELIC_E14_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.LaborProductionRelic1:
        return {
          balance: resource.RELIC_E15_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.LaborProductionRelic2:
        return {
          balance: resource.RELIC_E16_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.TroopProductionRelic1:
        return {
          balance: resource.RELIC_E17_BALANCE,
          production: noProduction,
        };
      case ResourcesIds.TroopProductionRelic2:
        return {
          balance: resource.RELIC_E18_BALANCE,
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
      ["RESEARCH_BALANCE" as keyof typeof resource, ResourcesIds.Research],
      ["RELIC_E1_BALANCE", ResourcesIds.StaminaRelic1],
      ["RELIC_E2_BALANCE", ResourcesIds.StaminaRelic2],
      ["RELIC_E3_BALANCE", ResourcesIds.DamageRelic1],
      ["RELIC_E4_BALANCE", ResourcesIds.DamageRelic2],
      ["RELIC_E5_BALANCE", ResourcesIds.DamageReductionRelic1],
      ["RELIC_E6_BALANCE", ResourcesIds.DamageReductionRelic2],
      ["RELIC_E7_BALANCE", ResourcesIds.ExplorationRelic1],
      ["RELIC_E8_BALANCE", ResourcesIds.ExplorationRelic2],
      ["RELIC_E9_BALANCE", ResourcesIds.ExplorationRewardRelic1],
      ["RELIC_E10_BALANCE", ResourcesIds.ExplorationRewardRelic2],
      ["RELIC_E11_BALANCE", ResourcesIds.StructureDamageReductionRelic1],
      ["RELIC_E12_BALANCE", ResourcesIds.StructureDamageReductionRelic2],
      ["RELIC_E13_BALANCE", ResourcesIds.ProductionRelic1],
      ["RELIC_E14_BALANCE", ResourcesIds.ProductionRelic2],
      ["RELIC_E15_BALANCE", ResourcesIds.LaborProductionRelic1],
      ["RELIC_E16_BALANCE", ResourcesIds.LaborProductionRelic2],
      ["RELIC_E17_BALANCE", ResourcesIds.TroopProductionRelic1],
      ["RELIC_E18_BALANCE", ResourcesIds.TroopProductionRelic2],
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
      gramToKg(divideByPrecision(Number(resource?.weight.capacity || 0))),
      gramToKg(divideByPrecision(Number(resource?.weight.weight || 0))),
    );

    return {
      balance: Number(balance + amountProducedLimited),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced,
    };
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

    const ticksSinceLastUpdate = elapsedProductionTicks(production.last_updated_at, currentTick);
    let totalAmountProduced = BigInt(ticksSinceLastUpdate) * production.production_rate;

    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);
    if (!isContinuousProductionResource && totalAmountProduced > production.output_amount_left) {
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
    const capacityLeft = Math.max(0, storeCapacityKg - storeUsedKg);
    const maxAmountStorable = multiplyByPrecision(capacityLeft / (resourceWeightKg || 1));

    if (amountProduced > maxAmountStorable) {
      return BigInt(maxAmountStorable);
    }
    return amountProduced;
  }

  public getActiveProductions(): Array<{
    resourceId: ResourcesIds;
    productionRate: bigint;
    buildingCount: number;
    outputAmountLeft: bigint;
    lastUpdatedAt: number;
  }> {
    const resource = this._getResource();
    if (!resource) return [];

    return ResourceManager.getActiveProductions(resource);
  }

  /**
   * Static version of getActiveProductions for use without instantiating ResourceManager
   */
  public static getActiveProductions(resource: ComponentValue<ClientComponents["Resource"]["schema"]>): Array<{
    resourceId: ResourcesIds;
    productionRate: bigint;
    buildingCount: number;
    outputAmountLeft: bigint;
    lastUpdatedAt: number;
  }> {
    if (!resource) return [];

    const activeProductions: Array<{
      resourceId: ResourcesIds;
      productionRate: bigint;
      buildingCount: number;
      outputAmountLeft: bigint;
      lastUpdatedAt: number;
    }> = [];

    // Define production fields and their corresponding resource IDs
    const productionFields: Array<[keyof typeof resource, ResourcesIds]> = [
      ["STONE_PRODUCTION", ResourcesIds.Stone],
      ["COAL_PRODUCTION", ResourcesIds.Coal],
      ["WOOD_PRODUCTION", ResourcesIds.Wood],
      ["COPPER_PRODUCTION", ResourcesIds.Copper],
      ["IRONWOOD_PRODUCTION", ResourcesIds.Ironwood],
      ["OBSIDIAN_PRODUCTION", ResourcesIds.Obsidian],
      ["GOLD_PRODUCTION", ResourcesIds.Gold],
      ["SILVER_PRODUCTION", ResourcesIds.Silver],
      ["MITHRAL_PRODUCTION", ResourcesIds.Mithral],
      ["ALCHEMICAL_SILVER_PRODUCTION", ResourcesIds.AlchemicalSilver],
      ["COLD_IRON_PRODUCTION", ResourcesIds.ColdIron],
      ["DEEP_CRYSTAL_PRODUCTION", ResourcesIds.DeepCrystal],
      ["RUBY_PRODUCTION", ResourcesIds.Ruby],
      ["DIAMONDS_PRODUCTION", ResourcesIds.Diamonds],
      ["HARTWOOD_PRODUCTION", ResourcesIds.Hartwood],
      ["IGNIUM_PRODUCTION", ResourcesIds.Ignium],
      ["TWILIGHT_QUARTZ_PRODUCTION", ResourcesIds.TwilightQuartz],
      ["TRUE_ICE_PRODUCTION", ResourcesIds.TrueIce],
      ["ADAMANTINE_PRODUCTION", ResourcesIds.Adamantine],
      ["SAPPHIRE_PRODUCTION", ResourcesIds.Sapphire],
      ["ETHEREAL_SILICA_PRODUCTION", ResourcesIds.EtherealSilica],
      ["DRAGONHIDE_PRODUCTION", ResourcesIds.Dragonhide],
      ["LABOR_PRODUCTION", ResourcesIds.Labor],
      ["EARTHEN_SHARD_PRODUCTION", ResourcesIds.AncientFragment],
      ["DONKEY_PRODUCTION", ResourcesIds.Donkey],
      ["KNIGHT_T1_PRODUCTION", ResourcesIds.Knight],
      ["KNIGHT_T2_PRODUCTION", ResourcesIds.KnightT2],
      ["KNIGHT_T3_PRODUCTION", ResourcesIds.KnightT3],
      ["CROSSBOWMAN_T1_PRODUCTION", ResourcesIds.Crossbowman],
      ["CROSSBOWMAN_T2_PRODUCTION", ResourcesIds.CrossbowmanT2],
      ["CROSSBOWMAN_T3_PRODUCTION", ResourcesIds.CrossbowmanT3],
      ["PALADIN_T1_PRODUCTION", ResourcesIds.Paladin],
      ["PALADIN_T2_PRODUCTION", ResourcesIds.PaladinT2],
      ["PALADIN_T3_PRODUCTION", ResourcesIds.PaladinT3],
      ["WHEAT_PRODUCTION", ResourcesIds.Wheat],
      ["FISH_PRODUCTION", ResourcesIds.Fish],
      ["LORDS_PRODUCTION", ResourcesIds.Lords],
      ["ESSENCE_PRODUCTION", ResourcesIds.Essence],
      ["RESEARCH_PRODUCTION" as keyof typeof resource, ResourcesIds.Research],
    ];

    // Check each production field directly
    for (const [fieldName, resourceId] of productionFields) {
      const production = resource[fieldName] as unknown as {
        building_count: number;
        production_rate: number | bigint;
        output_amount_left: bigint;
        last_updated_at: number;
      };

      // Check if production is active
      if (ResourceManager.isActiveStatic(resource, resourceId)) {
        activeProductions.push({
          resourceId,
          productionRate: BigInt(production.production_rate),
          buildingCount: production.building_count,
          outputAmountLeft: production.output_amount_left,
          lastUpdatedAt: production.last_updated_at,
        });
      }
    }

    return activeProductions;
  }

  public static calculateResourceProductionData(
    resourceId: ResourcesIds,
    productionInfo: ReturnType<typeof ResourceManager.balanceAndProduction>,
    currentTick: number,
  ): ResourceProductionData {
    const productionPerSecond = divideByPrecision(Number(productionInfo.production.production_rate || 0), false);

    const ticksSinceLastUpdate = elapsedProductionTicks(productionInfo.production.last_updated_at, currentTick);
    const totalAmountProduced = BigInt(ticksSinceLastUpdate) * productionInfo.production.production_rate;
    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);
    const remainingOutput = isContinuousProductionResource
      ? productionInfo.production.output_amount_left
      : productionInfo.production.output_amount_left - totalAmountProduced;

    const isProducing =
      productionInfo.production.building_count > 0 &&
      productionInfo.production.production_rate !== 0n &&
      (isContinuousProductionResource || remainingOutput > 0n);

    const outputRemainingNumber = Number(remainingOutput) / RESOURCE_PRECISION;
    const timeRemainingSeconds = productionPerSecond > 0 ? outputRemainingNumber / productionPerSecond : 0;

    return {
      productionPerSecond,
      isProducing,
      outputRemaining: outputRemainingNumber,
      timeRemainingSeconds,
    };
  }
}
