import { absoluteEpoch } from "../utils/expeditions";
import { productionOutput, type ProductionSupport } from "../utils/production-output";
import { isModeRuleEnabled } from "../utils/mode-rules";
import { BuildingType, ID, ResourcesIds, RESOURCE_PRECISION, type Resource } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { divideByPrecision, getBuildingCount, gramToKg } from "../utils";
import { configManager } from "./config-manager";

type Production = Pick<
  NativeRows["ResourceProduction"],
  "building_count" | "production_rate" | "output_amount_left" | "last_updated_at"
>;
interface ResourceState {
  balance: bigint;
  production: Production;
  support: ProductionSupport | null;
}

export interface ResourceProductionData {
  productionPerSecond: number;
  isProducing: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
}

/**
 * u128::MAX, the value the world writes for a budget that never runs out: a producer's output (FR8's unfunded board
 * buildings) or a store's capacity. It is a sentinel, not an amount, and is never formatted as a number or duration.
 */
const UNLIMITED_U128 = (1n << 128n) - 1n;
/** The contract's is_unlimited: the marker, or one settlements wore below it before they stopped wearing it. */
const isUnlimitedOutput = (outputAmountLeft: bigint) => outputAmountLeft >= UNLIMITED_U128 - (1n << 64n);

export class ResourceManager {
  entityId: ID;

  constructor(
    private readonly store: NativeFactStore,
    entityId: ID,
    private readonly gameId = configManager.getActiveGameId(),
  ) {
    this.entityId = entityId;
  }

  public subscribe(onChange: () => void): () => void {
    return this.store.subscribe((changes) => {
      if (
        changes.length === 0 ||
        changes.some((change) => {
          if (change.model === "GameRegistry") return (change.current ?? change.previous)?.game_id === this.gameId;
          if (change.model === "RealmSupport") {
            const row = change.current ?? change.previous;
            return row?.game_id === this.gameId && row.structure_id === this.entityId;
          }
          if (
            change.model !== "ResourceBalance" &&
            change.model !== "ResourceProduction" &&
            change.model !== "ResourceWeight"
          )
            return false;
          const row = change.current ?? change.previous;
          return row?.game_id === this.gameId && row.entity_id === this.entityId;
        })
      )
        onChange();
    });
  }

  public hasResources(): boolean {
    return this.weight() !== undefined;
  }

  /** Sparse balances and production are zero only while the entity's resource owner exists. */
  public current(resourceId: ResourcesIds): ResourceState | undefined {
    if (!Number.isInteger(resourceId) || resourceId < 1 || resourceId > 58)
      throw new Error(`Invalid resource ${resourceId}`);
    if (!this.hasResources()) return undefined;
    const keys = { game_id: this.gameId, entity_id: this.entityId, resource_type: resourceId };
    const production = this.store.requireOrAbsent("ResourceProduction", keys);
    const balance = this.store.requireOrAbsent("ResourceBalance", keys);
    if (!production.known || !balance.known) return undefined;
    const adjusted = this.productionForGameClock(production.known);
    const support = this.productionSupport(adjusted);
    if (support === undefined) return undefined;
    return { balance: balance.known.balance, production: adjusted, support };
  }

  private productionSupport(production: Production): ProductionSupport | null | undefined {
    if (production.building_count === 0 || production.production_rate === 0n) return null;
    const rules = this.store.require("SliceRules", { game_id: this.gameId });
    if (rules.epoch_seconds === 0) return null;
    const clock = { epochSeconds: rules.epoch_seconds };
    const support = this.store.requireOrAbsent("RealmSupport", {
      game_id: this.gameId,
      structure_id: this.entityId,
      epoch: BigInt(absoluteEpoch(clock, production.last_updated_at)),
    });
    return support.known ? { ...clock, level: support.known.level } : undefined;
  }

  private productionForGameClock(production: Production): Production {
    if (production.building_count === 0) return production;
    const rules = this.store.require("SliceRules", { game_id: this.gameId });
    if (!isModeRuleEnabled(rules, "PRODUCTION_START")) return production;
    const game = this.store.require("GameRegistry", { game_id: this.gameId });
    return {
      ...production,
      last_updated_at: Math.max(production.last_updated_at, Number(game.start_main_at)),
      production_rate: game.ready ? production.production_rate : 0n,
    };
  }

  private weight() {
    return this.store.get("ResourceWeight", { game_id: this.gameId, entity_id: this.entityId });
  }

  /** Every held resource; undefined when this client holds no resource owner for the entity (unknown, not empty). */
  public balances(currentTick?: number): Resource[] | undefined {
    if (!this.hasResources()) return undefined;
    return Array.from({ length: 58 }, (_, index) => {
      const resourceId = (index + 1) as ResourcesIds;
      return {
        resourceId,
        amount:
          currentTick === undefined
            ? Number(this.balance(resourceId)!)
            : this.balanceWithProduction(currentTick, resourceId)!.balance,
      };
    }).filter(({ amount }) => amount > 0);
  }

  private static isContinuousProductionResource(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  public isFood(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  public isActive(resourceId: ResourcesIds): boolean {
    return ResourceManager.hasActiveProduction(this.current(resourceId)?.production, resourceId);
  }

  /** Production that never runs out: continuous food, or a producer written with the unlimited output sentinel. */
  private static neverRunsOut(production: Production, resourceId: ResourcesIds): boolean {
    return (
      ResourceManager.isContinuousProductionResource(resourceId) || isUnlimitedOutput(production.output_amount_left)
    );
  }

  private static hasActiveProduction(production: Production | undefined, resourceId: ResourcesIds) {
    if (!production) return false;

    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);
    if (isContinuousProductionResource) {
      return production.production_rate !== 0n;
    }
    return production.building_count > 0 && production.production_rate !== 0n && production.output_amount_left !== 0n;
  }

  /** The balance with production to `currentTick`; undefined when this client holds no resource owner for the entity. */
  public balanceWithProduction(
    currentTick: number,
    resourceId: ResourcesIds,
  ):
    | { balance: number; hasReachedMaxCapacity: boolean; amountProduced: bigint; amountProducedLimited: bigint }
    | undefined {
    const resource = this.current(resourceId);
    if (!resource) return undefined;
    const { balance, production } = resource;
    if (!production)
      return { balance: Number(balance), hasReachedMaxCapacity: false, amountProduced: 0n, amountProducedLimited: 0n };
    const amountProduced = ResourceManager._amountProducedStatic(production, currentTick, resourceId, resource.support);
    const amountProducedLimited = this._limitProductionByStoreCapacity(amountProduced, resourceId);
    return {
      balance: Number(balance + amountProducedLimited),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced,
      amountProduced,
      amountProducedLimited,
    };
  }

  /**
   * What the realm's farms grow each hour at the rates running at `currentTick`, in whole units. Rates come from the one
   * production integral, so a day's Support boost counts until its midnight. Nothing produced consumes wheat: only
   * raising and marching armies spend it. Undefined where the entity holds no wheat.
   */
  public wheatPerHour(currentTick: number): number | undefined {
    const wheat = this.current(ResourcesIds.Wheat);
    if (!wheat) return undefined;
    return (
      ResourceManager.calculateResourceProductionData(ResourcesIds.Wheat, wheat, currentTick).productionPerSecond * 3600
    );
  }

  public timeUntilValueReached(currentTick: number, resourceId: ResourcesIds): number {
    const resource = this.current(resourceId);
    if (!resource) return 0;
    const { production } = resource;
    if (!production || production.building_count === 0) return 0;

    // Get production details
    const lastUpdatedTick = production.last_updated_at;
    const productionRate = production.production_rate;
    const outputAmountLeft = production.output_amount_left;

    if (productionRate === 0n) return 0;
    if (ResourceManager.neverRunsOut(production, resourceId)) return Number.MAX_SAFE_INTEGER;
    if (outputAmountLeft === 0n) return 0;

    // Calculate ticks since last update
    const ticksSinceLastUpdate = currentTick - lastUpdatedTick;

    // Calculate remaining ticks based on output amount left and production rate
    const remainingTicks = Number(outputAmountLeft) / Number(productionRate);

    // Return remaining ticks, accounting for ticks that have already passed
    return Math.max(0, remainingTicks - ticksSinceLastUpdate);
  }

  public getProductionEndsAt(resourceId: ResourcesIds): number {
    const resource = this.current(resourceId);
    if (!resource) return 0;
    const { production } = resource;
    if (!production || production.building_count === 0) return 0;

    if (production.production_rate === 0n) return production.last_updated_at;
    if (ResourceManager.neverRunsOut(production, resourceId)) return Number.MAX_SAFE_INTEGER;
    if (production.output_amount_left === 0n) return production.last_updated_at;

    // Calculate when production will end based on remaining output and rate
    const remainingTicks = Number(production.output_amount_left) / Number(production.production_rate);
    return production.last_updated_at + Math.ceil(remainingTicks);
  }

  /** The store's capacity and use; undefined when this client holds no resource owner for the entity. */
  public getStoreCapacityKg(): { capacityKg: number; capacityUsedKg: number; quantity: number } | undefined {
    const weight = this.weight();
    if (!weight) return undefined;
    const structureBuildings = this.store.get("StructureBuildings", { game_id: this.gameId, entity_id: this.entityId });
    const packBuildingCounts = [
      structureBuildings?.packed_counts_1 || 0n,
      structureBuildings?.packed_counts_2 || 0n,
      structureBuildings?.packed_counts_3 || 0n,
    ];
    const quantity = structureBuildings ? getBuildingCount(BuildingType.Storehouse, packBuildingCounts) || 0 : 0;

    return {
      capacityKg: gramToKg(divideByPrecision(Number(weight.capacity))),
      capacityUsedKg: gramToKg(Math.max(0, divideByPrecision(Number(weight.weight)))),
      quantity,
    };
  }

  /** The stored balance; undefined when this client holds no resource owner for the entity (unknown, never zero). */
  public balance(resourceId: ResourcesIds): bigint | undefined {
    return this.current(resourceId)?.balance;
  }

  /**
   * What of `amountProduced` the store keeps, as the contract's settlement adds it: whole units into the room left, the
   * rest lost. Only reached for an entity whose resource owner is held, so its weight is known.
   */
  private _limitProductionByStoreCapacity(amountProduced: bigint, resourceId: ResourcesIds): bigint {
    const { capacity, weight } = this.weight()!;
    if (capacity === UNLIMITED_U128) return amountProduced;
    const unitWeight = this.store.require("ResourceRule", {
      game_id: this.gameId,
      resource_type: resourceId,
    }).unit_weight;
    if (unitWeight === 0n) return amountProduced;
    const room = capacity > weight ? capacity - weight : 0n;
    return amountProduced * unitWeight > room ? room / unitWeight : amountProduced;
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
    support: ProductionSupport | null,
  ): bigint {
    if (!production || production.building_count === 0) return 0n;
    if (production.production_rate === 0n) return 0n;

    let totalAmountProduced = productionOutput(production, currentTick, support);

    const isContinuousProductionResource = ResourceManager.isContinuousProductionResource(resourceId);
    if (!isContinuousProductionResource && totalAmountProduced > production.output_amount_left) {
      totalAmountProduced = production.output_amount_left;
    }

    return totalAmountProduced;
  }

  public getActiveProductions(): Array<{
    resourceId: ResourcesIds;
    productionRate: bigint;
    buildingCount: number;
    outputAmountLeft: bigint;
    lastUpdatedAt: number;
  }> {
    if (!this.hasResources()) return [];
    return [...this.store.inGame("ResourceProduction", this.gameId)].flatMap((row) => {
      if (row.entity_id !== this.entityId) return [];
      const resourceId = row.resource_type as ResourcesIds;
      const production = this.productionForGameClock(row);
      if (!ResourceManager.hasActiveProduction(production, resourceId)) return [];
      return [
        {
          resourceId,
          productionRate: production.production_rate,
          buildingCount: production.building_count,
          outputAmountLeft: production.output_amount_left,
          lastUpdatedAt: production.last_updated_at,
        },
      ];
    });
  }

  public static calculateResourceProductionData(
    resourceId: ResourcesIds,
    productionInfo: ResourceState,
    currentTick: number,
  ): ResourceProductionData {
    const productionPerSecond = divideByPrecision(
      Number(
        productionOutput(productionInfo.production, currentTick + 1, productionInfo.support) -
          productionOutput(productionInfo.production, currentTick, productionInfo.support),
      ),
      false,
    );

    const { production } = productionInfo;
    const isProducing = production.building_count > 0 && production.production_rate !== 0n;
    // Production that never runs out has no remaining output or time: both are infinite, never the sentinel's value.
    if (ResourceManager.neverRunsOut(production, resourceId)) {
      return {
        productionPerSecond,
        isProducing,
        outputRemaining: Number.POSITIVE_INFINITY,
        timeRemainingSeconds: Number.POSITIVE_INFINITY,
      };
    }

    const totalAmountProduced = productionOutput(production, currentTick, productionInfo.support);
    const remainingOutput =
      production.output_amount_left > totalAmountProduced ? production.output_amount_left - totalAmountProduced : 0n;
    const outputRemainingNumber = Number(remainingOutput) / RESOURCE_PRECISION;
    const timeRemainingSeconds = productionPerSecond > 0 ? outputRemainingNumber / productionPerSecond : 0;

    return {
      productionPerSecond,
      isProducing: isProducing && remainingOutput > 0n,
      outputRemaining: outputRemainingNumber,
      timeRemainingSeconds,
    };
  }
}
