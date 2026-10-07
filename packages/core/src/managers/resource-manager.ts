import { productionOutput } from "../utils/production-output";
import { isModeRuleEnabled } from "../utils/mode-rules";
import {
  BuildingType,
  ID,
  ResourcesIds,
  RESOURCE_PRECISION,
  StructureType,
  type Resource,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { divideByPrecision, getBuildingCount, gramToKg } from "../utils";
import { configManager } from "./config-manager";

type Production = Pick<
  NativeRows["ResourceProduction"],
  "building_count" | "production_rate" | "output_amount_left" | "last_settled_tick"
>;
interface ResourceState {
  balance: bigint;
  production: Production;
  /** The armies tick production settles on, in seconds. */
  tickSeconds: number;
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

/** The stores a board realm's castle keeps up to a limit of their own, as the contract's has_castle_limit. */
const hasCastleLimit = (resourceId: ResourcesIds): boolean =>
  resourceId === ResourcesIds.Wheat ||
  resourceId === ResourcesIds.Labor ||
  (resourceId >= ResourcesIds.Knight && resourceId <= ResourcesIds.PaladinT3);

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
          // A realm's level sets its stores' limits.
          if (
            change.model !== "ResourceBalance" &&
            change.model !== "ResourceProduction" &&
            change.model !== "ResourceWeight" &&
            change.model !== "Structure"
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
    return { balance: balance.known.balance, production: adjusted, tickSeconds: this.tickSeconds() };
  }

  private tickSeconds(): number {
    return Number(this.store.require("SliceRules", { game_id: this.gameId }).tick_config.armies_tick_in_seconds);
  }

  private productionForGameClock(production: Production): Production {
    if (production.building_count === 0) return production;
    const rules = this.store.require("SliceRules", { game_id: this.gameId });
    if (!isModeRuleEnabled(rules, "PRODUCTION_START")) return production;
    const game = this.store.require("GameRegistry", { game_id: this.gameId });
    return {
      ...production,
      last_settled_tick: Math.max(
        production.last_settled_tick,
        Math.floor(Number(game.start_main_at) / this.tickSeconds()),
      ),
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
    const amountProduced = ResourceManager._amountProducedStatic(resource, currentTick, resourceId);
    // A store keeps nothing past its own limit, as the contract adds production to it.
    const limit = this.storeLimit(resourceId);
    const room = limit === undefined ? undefined : limit > balance ? limit - balance : 0n;
    const fitting = this._limitProductionByStoreCapacity(amountProduced, resourceId);
    const amountProducedLimited = room === undefined || fitting < room ? fitting : room;
    const kept = balance + amountProducedLimited;
    return {
      balance: Number(kept),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced || (limit !== undefined && kept >= limit),
      amountProduced,
      amountProducedLimited,
    };
  }

  /**
   * A board realm's own limit on its wheat, labor or troops, as the contract's store_limit: its castle stores that many
   * of its level's full deploys. Undefined for every other store, which only the shared weight bounds.
   */
  public storeLimit(resourceId: ResourcesIds): bigint | undefined {
    if (!hasCastleLimit(resourceId)) return undefined;
    const board = this.store.get("BoardRules", { game_id: this.gameId });
    if (!board) return undefined;
    const structure = this.store.get("Structure", { game_id: this.gameId, entity_id: this.entityId });
    if (structure?.base.category !== StructureType.Realm) return undefined;
    const limits = this.store.require("SliceRules", { game_id: this.gameId }).troop_limit_config;
    const cap = [
      limits.settlement_deployment_cap,
      limits.city_deployment_cap,
      limits.kingdom_deployment_cap,
      limits.empire_deployment_cap,
    ][structure.base.level];
    if (cap === undefined) throw new Error(`Unknown castle level ${structure.base.level}`);
    return BigInt(cap) * BigInt(board.castle_store_deploys) * BigInt(RESOURCE_PRECISION);
  }

  /**
   * What the realm's farms grow each hour at the rates running at `currentTick`, in whole units. Nothing produced
   * consumes wheat: only raising and marching armies spend it. Undefined where the entity holds no wheat.
   */
  public wheatPerHour(currentTick: number): number | undefined {
    const wheat = this.current(ResourcesIds.Wheat);
    if (!wheat) return undefined;
    return (
      ResourceManager.calculateResourceProductionData(ResourcesIds.Wheat, wheat, currentTick).productionPerSecond * 3600
    );
  }

  /** Seconds until a producer with a finite budget runs dry, paid out in whole ticks; 0 when it has nothing left. */
  public timeUntilValueReached(timestamp: number, resourceId: ResourcesIds): number {
    const resource = this.current(resourceId);
    if (!resource) return 0;
    const { production } = resource;
    if (production.building_count === 0 || production.production_rate === 0n) return 0;
    if (ResourceManager.neverRunsOut(production, resourceId)) return Number.MAX_SAFE_INTEGER;
    const produced = productionOutput(production, timestamp, resource.tickSeconds, resource.support);
    const remaining = production.output_amount_left > produced ? production.output_amount_left - produced : 0n;
    return secondsUntilPaid(remaining, production.production_rate, timestamp, resource.tickSeconds);
  }

  /** The tick boundary at which a producer with a finite budget pays its last; 0 when it has none. */
  public getProductionEndsAt(resourceId: ResourcesIds): number {
    const resource = this.current(resourceId);
    if (!resource) return 0;
    const { production, tickSeconds } = resource;
    if (production.building_count === 0) return 0;
    const settledAt = production.last_settled_tick * tickSeconds;
    if (production.production_rate === 0n || production.output_amount_left === 0n) return settledAt;
    if (ResourceManager.neverRunsOut(production, resourceId)) return Number.MAX_SAFE_INTEGER;
    return (
      settledAt + secondsUntilPaid(production.output_amount_left, production.production_rate, settledAt, tickSeconds)
    );
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

  private static _amountProducedStatic(resource: ResourceState, timestamp: number, resourceId: ResourcesIds): bigint {
    const { production } = resource;
    if (production.building_count === 0 || production.production_rate === 0n) return 0n;
    const produced = productionOutput(production, timestamp, resource.tickSeconds);
    if (!ResourceManager.isContinuousProductionResource(resourceId) && produced > production.output_amount_left)
      return production.output_amount_left;
    return produced;
  }

  public getActiveProductions(): Array<{
    resourceId: ResourcesIds;
    productionRate: bigint;
    buildingCount: number;
    outputAmountLeft: bigint;
    lastSettledTick: number;
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
          lastSettledTick: production.last_settled_tick,
        },
      ];
    });
  }

  public static calculateResourceProductionData(
    resourceId: ResourcesIds,
    productionInfo: ResourceState,
    timestamp: number,
  ): ResourceProductionData {
    const { production, tickSeconds } = productionInfo;
    const produced = productionOutput(production, timestamp, tickSeconds);
    // One tick's output, as a rate: what the next pulse adds, spread over the tick.
    const productionPerSecond = divideByPrecision(
      Number(productionOutput(production, timestamp + tickSeconds, tickSeconds) - produced) / tickSeconds,
      false,
    );

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

    const remainingOutput = production.output_amount_left > produced ? production.output_amount_left - produced : 0n;
    return {
      productionPerSecond,
      isProducing: isProducing && remainingOutput > 0n,
      outputRemaining: Number(remainingOutput) / RESOURCE_PRECISION,
      timeRemainingSeconds: secondsUntilPaid(remainingOutput, production.production_rate, timestamp, tickSeconds),
    };
  }
}

/**
 * Seconds from `timestamp` to the tick boundary that pays `remaining` at `ratePerSecond`: production lands in whole
 * ticks, so this is always a boundary, never a moment between two.
 */
const secondsUntilPaid = (remaining: bigint, ratePerSecond: bigint, timestamp: number, tickSeconds: number): number => {
  const perTick = ratePerSecond * BigInt(tickSeconds);
  if (remaining <= 0n || perTick <= 0n) return 0;
  const ticks = Number((remaining + perTick - 1n) / perTick);
  return (Math.floor(timestamp / tickSeconds) + ticks) * tickSeconds - timestamp;
};
