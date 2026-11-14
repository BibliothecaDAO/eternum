import { currentResourceWeight } from "../utils/deep";
import { researchPicks } from "../utils/realm-research";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";
import { BANE_MODELS, readBaneEffects } from "../client/views/banes";
import { SCOPE_INPUT_MODELS } from "../sync/model-manifest";
import { nativeBaneConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
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

export const RESOURCE_PRODUCTION_MODELS = [
  ...SCOPE_INPUT_MODELS, ...BANE_MODELS,
  "ResourceBalance", "ResourceProduction", "ResourceWeight", "ResourceRule", "RealmKnowledge",
  "StructureBuildings", "ProductionBonus", "BoardRules", "SliceRules", "GameRegistry",
] as const;

type Production = Pick<
  NativeRows["ResourceProduction"],
  "building_count" | "production_rate" | "output_amount_left" | "last_settled_at" | "remainder"
>;
interface ResourceState {
  balance: bigint;
  production: Production;
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
      const relevant = changes.some((change) => {
        if (!RESOURCE_PRODUCTION_MODELS.some((model) => model === change.model)) return false;
        const row = change.current ?? change.previous;
        if (!row || !("game_id" in row) || row.game_id !== this.gameId) return false;
        if ("entity_id" in row) return row.entity_id === BigInt(this.entityId);
        if ("structure_id" in row) return row.structure_id === BigInt(this.entityId);
        if ("home" in row) return row.home === BigInt(this.entityId);
        return true;
      });
      if (changes.length === 0 || relevant) onChange();
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
    return { balance: balance.known.balance, production: adjusted };
  }

  private productionForGameClock(production: Production): Production {
    if (production.building_count === 0) return production;
    const rules = this.store.require("SliceRules", { game_id: this.gameId });
    if (!isModeRuleEnabled(rules, "PRODUCTION_START")) return production;
    const game = this.store.require("GameRegistry", { game_id: this.gameId });
    return {
      ...production,
      last_settled_at: Math.max(production.last_settled_at, Number(game.start_main_at)),
    };
  }

  private weight() {
    const row = this.store.get("ResourceWeight", { game_id: this.gameId, entity_id: this.entityId });
    return row && currentResourceWeight(this.store, row);
  }

  /**
   * Every held resource; undefined when unknown, which is not empty: this client holds no resource owner for the
   * entity, or one resource's state is not known (while the acting account's scope is being selected, a resource
   * with no row is unknown, not zero). A resource the store says is absent is simply not held.
   */
  public balances(currentTick?: number): Resource[] | undefined {
    const held: Resource[] = [];
    for (let resourceId = 1; resourceId <= 58; resourceId++) {
      const balance =
        currentTick === undefined
          ? this.balance(resourceId)
          : this.balanceWithProduction(currentTick, resourceId)?.balance;
      if (balance === undefined) return undefined;
      if (balance > 0) held.push({ resourceId, amount: Number(balance) });
    }
    return held;
  }

  private static isContinuousProductionResource(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  public isFood(resourceId: ResourcesIds): boolean {
    return resourceId === ResourcesIds.Wheat || resourceId === ResourcesIds.Fish;
  }

  /**
   * Whether the resource is being produced at `timestamp`: a building at a rate, with output left once what it made
   * since its last settlement is counted. A finished batch is no longer production, whether or not a later transaction
   * has settled its row.
   */
  public isProducingAt(resourceId: ResourcesIds, timestamp: number): boolean {
    return this.productionData(resourceId, timestamp)?.isProducing === true;
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
    const settled = this.productionAt(resourceId, production, currentTick);
    if (!settled) return undefined;
    const amountProduced = ResourceManager.neverRunsOut(production, resourceId)
      ? settled.amount
      : settled.amount < production.output_amount_left ? settled.amount : production.output_amount_left;
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
   * A board realm's base wheat/labor capacity before Granary and Storeroom research. Undefined in a game without a realm board.
   */
  public static castleStoreLimit(store: NativeFactStore, gameId: number, level: number): bigint | undefined {
    const board = store.get("BoardRules", { game_id: gameId });
    if (!board) return undefined;
    const cap = [
      board.settlement_resource_cap,
      board.city_resource_cap,
      board.kingdom_resource_cap,
      board.empire_resource_cap,
    ][level];
    if (cap === undefined) throw new Error(`Unknown castle level ${level}`);
    return BigInt(cap) * BigInt(RESOURCE_PRECISION);
  }

  /**
   * A board realm's resource limit: troops use deployment capacity; Granary and Storeroom increase the separate
   * wheat/labor base. Undefined for every other
   * store, which only the shared weight bounds.
   */
  public storeLimit(resourceId: ResourcesIds): bigint | undefined {
    if (!hasCastleLimit(resourceId)) return undefined;
    const board = this.store.get("BoardRules", { game_id: this.gameId });
    if (!board) return undefined;
    const structure = this.store.get("Structure", { game_id: this.gameId, entity_id: this.entityId });
    if (structure?.base.category !== StructureType.Realm) return undefined;
    const base = ResourceManager.castleStoreLimit(this.store, this.gameId, structure.base.level)!;
    const row =
      resourceId === ResourcesIds.Wheat
        ? research.ROW_FARM
        : resourceId === ResourcesIds.Labor
          ? research.ROW_WORKSHOP
          : undefined;
    if (row === undefined) {
      const limits = this.store.require("SliceRules", { game_id: this.gameId }).troop_limit_config;
      const cap = [
        limits.settlement_deployment_cap,
        limits.city_deployment_cap,
        limits.kingdom_deployment_cap,
        limits.empire_deployment_cap,
      ][structure.base.level];
      if (cap === undefined) throw new Error(`Unknown castle level ${structure.base.level}`);
      return BigInt(cap) * BigInt(board.troop_store_deploys) * BigInt(RESOURCE_PRECISION);
    }
    const learned = this.store.require("RealmKnowledge", { game_id: this.gameId, structure_id: this.entityId }).learned;
    const stores = researchPicks(learned, row, research.CHOICE_STORE);
    return (base * BigInt(10_000 + stores * board.storage_step_bps)) / 10_000n;
  }

  /**
   * What the realm's farms grow each hour at the rates running at `currentTick`, in whole units. Nothing produced
   * consumes wheat: only raising and marching armies spend it. Undefined where the entity holds no wheat.
   */
  public wheatPerHour(currentTick: number): number | undefined {
    const production = this.productionData(ResourcesIds.Wheat, currentTick);
    return production && production.productionPerSecond * 3600;
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
   * rest lost. Only reached for an entity whose resource owner is held, so its weight is known. Nothing produced asks
   * for no weight rule: a game need not rule on a resource it never makes.
   */
  private _limitProductionByStoreCapacity(amountProduced: bigint, resourceId: ResourcesIds): bigint {
    if (amountProduced === 0n) return 0n;
    const { capacity, weight } = this.store.require("ResourceWeight", {
      game_id: this.gameId,
      entity_id: this.entityId,
    });
    if (capacity === UNLIMITED_U128) return amountProduced;
    const unitWeight = this.store.require("ResourceRule", {
      game_id: this.gameId,
      resource_type: resourceId,
    }).unit_weight;
    if (unitWeight === 0n) return amountProduced;
    const room = capacity > weight ? capacity - weight : 0n;
    return amountProduced * unitWeight > room ? room / unitWeight : amountProduced;
  }

  private productionAt(resourceId: ResourcesIds, production: Production, timestamp: number) {
    if (production.building_count === 0 || !ResourceManager.hasActiveProduction(production, resourceId))
      return { amount: 0n, remainder: production.remainder, rateNumerator: 0n };
    const effects = readBaneEffects(
      this.store, this.gameId, this.entityId, Math.min(production.last_settled_at, timestamp), timestamp + 1,
    );
    if (!effects.known) return undefined;
    const { windows, productionPercent } = effects.known;
    const output = productionOutput(production, timestamp, windows, productionPercent);
    const ash = windows.some((window) =>
      window.kind === nativeBaneConstants.ASH_FALL && window.start <= timestamp && timestamp < window.end,
    );
    return { ...output, rateNumerator: production.production_rate * BigInt(ash ? productionPercent : 100) };
  }

  public getActiveProductions(): Array<{
    resourceId: ResourcesIds;
    productionRate: bigint;
    buildingCount: number;
    outputAmountLeft: bigint;
    lastSettledAt: number;
  }> {
    if (!this.hasResources()) return [];
    return [...this.store.inGame("ResourceProduction", this.gameId)].flatMap((row) => {
      if (row.entity_id !== BigInt(this.entityId)) return [];
      const resourceId = row.resource_type as ResourcesIds;
      const production = this.productionForGameClock(row);
      if (!ResourceManager.hasActiveProduction(production, resourceId)) return [];
      return [
        {
          resourceId,
          productionRate: production.production_rate,
          buildingCount: production.building_count,
          outputAmountLeft: production.output_amount_left,
          lastSettledAt: production.last_settled_at,
        },
      ];
    });
  }

  /** Current output and rate from the same recorded intervals as balance settlement. */
  public productionData(resourceId: ResourcesIds, timestamp: number): ResourceProductionData | undefined {
    const resource = this.current(resourceId);
    if (!resource) return undefined;
    const { production } = resource;
    const settled = this.productionAt(resourceId, production, timestamp);
    if (!settled) return undefined;
    const productionPerSecond = Number(settled.rateNumerator) / (100 * RESOURCE_PRECISION);
    const isProducing = production.building_count > 0 && settled.rateNumerator !== 0n;
    if (ResourceManager.neverRunsOut(production, resourceId)) {
      return {
        productionPerSecond, isProducing,
        outputRemaining: Number.POSITIVE_INFINITY, timeRemainingSeconds: Number.POSITIVE_INFINITY,
      };
    }
    const remaining = production.output_amount_left > settled.amount ? production.output_amount_left - settled.amount : 0n;
    return {
      productionPerSecond, isProducing: isProducing && remaining > 0n,
      outputRemaining: Number(remaining) / RESOURCE_PRECISION,
      timeRemainingSeconds: secondsUntilPaid(remaining, settled.rateNumerator, settled.remainder),
    };
  }
}

/** Estimate at the current rate; a future bane or quorum can change it. */
const secondsUntilPaid = (remaining: bigint, rateNumerator: bigint, remainder: number): number => {
  if (remaining <= 0n || rateNumerator <= 0n) return 0;
  const unpaid = remaining * 100n - BigInt(remainder);
  return Number((unpaid + rateNumerator - 1n) / rateNumerator);
};
