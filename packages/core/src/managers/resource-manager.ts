import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { BuildingType, ID, ResourcesIds, RESOURCE_PRECISION, type Resource } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { divideByPrecision, getBuildingCount, gramToKg, multiplyByPrecision } from "../utils";
import { configManager } from "./config-manager";

type Production = Pick<
  NativeRows["ResourceProduction"],
  "building_count" | "production_rate" | "output_amount_left" | "last_updated_at"
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

// A scheduled production start is not a chain-clock observation.
/**
 * u128::MAX, the value the world writes for a budget that never runs out: a producer's output (FR8's unfunded board
 * buildings) or a store's capacity. It is a sentinel, not an amount, and is never formatted as a number or duration.
 */
const UNLIMITED_U128 = (1n << 128n) - 1n;

const elapsedProductionTicks = (lastUpdatedAt: number, currentTick: number): number => {
  if (!Number.isFinite(lastUpdatedAt) || !Number.isFinite(currentTick)) throw new Error("Invalid production clock");
  return Math.max(0, Math.floor(currentTick - lastUpdatedAt));
};

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
        changes.some((change) => {
          if (change.model === "GameRegistry") return (change.current ?? change.previous)?.game_id === this.gameId;
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
    const production = this.productionForGameClock(this.store.get("ResourceProduction", keys));
    return {
      balance: this.store.get("ResourceBalance", keys)?.balance ?? 0n,
      production: production ?? {
        building_count: 0,
        production_rate: 0n,
        output_amount_left: 0n,
        last_updated_at: 0,
      },
    };
  }

  private productionForGameClock(production: Production | undefined): Production | undefined {
    if (!production || production.building_count === 0) return production;
    const rules = this.store.require("SliceRules", { game_id: this.gameId });
    if ((rules.mode_rules & nativeRuleConstants.PRODUCTION_START) === 0) return production;
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

  public balances(currentTick?: number): Resource[] {
    if (!this.hasResources()) return [];
    return Array.from({ length: 58 }, (_, index) => {
      const resourceId = (index + 1) as ResourcesIds;
      return {
        resourceId,
        amount:
          currentTick === undefined
            ? Number(this.balance(resourceId))
            : this.balanceWithProduction(currentTick, resourceId).balance,
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
      ResourceManager.isContinuousProductionResource(resourceId) || production.output_amount_left === UNLIMITED_U128
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

  public balanceWithProduction(
    currentTick: number,
    resourceId: ResourcesIds,
  ): { balance: number; hasReachedMaxCapacity: boolean; amountProduced: bigint; amountProducedLimited: bigint } {
    const resource = this.current(resourceId);
    if (!resource) return { balance: 0, hasReachedMaxCapacity: false, amountProduced: 0n, amountProducedLimited: 0n };
    const { balance, production } = resource;
    if (!production)
      return { balance: Number(balance), hasReachedMaxCapacity: false, amountProduced: 0n, amountProducedLimited: 0n };
    const training = this.projectTraining(currentTick, resourceId);
    if (training) return training;
    const amountProduced = ResourceManager._amountProducedStatic(production, currentTick, resourceId);
    const amountProducedLimited = this._limitProductionByStoreCapacity(amountProduced, resourceId);
    return {
      balance: Number(balance + amountProducedLimited),
      hasReachedMaxCapacity: amountProducedLimited < amountProduced,
      amountProduced,
      amountProducedLimited,
    };
  }

  /** Whether barracks here train troops from wheat, which they take before anything else can spend it. */
  public trainsFromWheat(): boolean {
    return this.trainers().length > 0;
  }

  /** The troop productions that train from wheat without end: a barracks with no output cap. */
  private trainers() {
    // An entity without a resource store has no barracks to train from.
    if (!this.hasResources()) return [];
    return Array.from({ length: 9 }, (_, index) => (26 + index) as ResourcesIds)
      .map((id) => ({ id, state: this.current(id)! }))
      .filter(
        ({ state }) => state.production.building_count > 0 && state.production.output_amount_left === UNLIMITED_U128,
      );
  }

  private projectTraining(currentTick: number, resourceId: ResourcesIds) {
    if (resourceId !== 35 && (resourceId < 26 || resourceId > 34)) return;
    const trainers = this.trainers().filter(({ state }) => state.production.last_updated_at < currentTick);
    if (!trainers.length) return;
    const wheat = this.current(ResourcesIds.Wheat)!;
    const farmOutput = ResourceManager._amountProducedStatic(wheat.production, currentTick, ResourcesIds.Wheat);
    let available = wheat.balance + farmOutput;
    const outputs = trainers.map(({ id, state }) => {
      const recipe = this.store.require("ProductionRecipe", { game_id: this.gameId, resource_type: id });
      const input = recipe.simple_inputs[0];
      if (
        recipe.simple_output === 0n ||
        recipe.simple_inputs.length !== 1 ||
        input.resource_type !== 35 ||
        input.amount === 0n
      )
        throw new Error("Unlimited training requires a wheat recipe");
      const expected = ResourceManager._amountProducedStatic(state.production, currentTick, id);
      const funded = (available * recipe.simple_output) / input.amount;
      const trained = expected < funded ? expected : funded;
      available -= (trained * input.amount + recipe.simple_output - 1n) / recipe.simple_output;
      return { id, state, trained };
    });
    const weight = this.weight()!;
    const wheatWeight = this.store.require("ResourceRule", { game_id: this.gameId, resource_type: 35 }).unit_weight;
    let used = weight.weight - wheat.balance * wheatWeight;
    const storeOutput = (amount: bigint, unitWeight: bigint) => {
      const remaining =
        weight.capacity === UNLIMITED_U128 ? UNLIMITED_U128 : weight.capacity > used ? weight.capacity - used : 0n;
      const stored = amount * unitWeight > remaining ? remaining / unitWeight : amount;
      if (weight.capacity !== UNLIMITED_U128) used += stored * unitWeight;
      return stored;
    };
    const storedWheat = storeOutput(available, wheatWeight);
    if (resourceId === 35)
      return {
        balance: Number(storedWheat),
        amountProduced: available - wheat.balance,
        amountProducedLimited: storedWheat - wheat.balance,
        hasReachedMaxCapacity: storedWheat < available,
      };
    for (const { id, state, trained } of outputs) {
      const unitWeight = this.store.require("ResourceRule", { game_id: this.gameId, resource_type: id }).unit_weight;
      const stored = storeOutput(trained, unitWeight);
      if (id === resourceId)
        return {
          balance: Number(state.balance + stored),
          amountProduced: trained,
          amountProducedLimited: stored,
          hasReachedMaxCapacity: stored < trained,
        };
    }
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

  public getStoreCapacityKg(): { capacityKg: number; capacityUsedKg: number; quantity: number } {
    const weight = this.weight();
    const structureBuildings = this.store.get("StructureBuildings", { game_id: this.gameId, entity_id: this.entityId });
    const packBuildingCounts = [
      structureBuildings?.packed_counts_1 || 0n,
      structureBuildings?.packed_counts_2 || 0n,
      structureBuildings?.packed_counts_3 || 0n,
    ];
    const quantity = structureBuildings ? getBuildingCount(BuildingType.Storehouse, packBuildingCounts) || 0 : 0;

    return {
      capacityKg: gramToKg(divideByPrecision(Number(weight?.capacity || 0))),
      capacityUsedKg: gramToKg(Math.max(0, divideByPrecision(Number(weight?.weight || 0)))),
      quantity,
    };
  }

  public balance(resourceId: ResourcesIds): bigint {
    return this.current(resourceId)?.balance ?? 0n;
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
    if (resourceWeightKg === 0) return amountProduced;
    const capacityLeft = Math.max(0, storeCapacityKg - storeUsedKg);
    const maxAmountStorable = Math.floor(multiplyByPrecision(capacityLeft / resourceWeightKg));

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
    if (!this.hasResources()) return [];
    return [...this.store.inGame("ResourceProduction", this.gameId)].flatMap((row) => {
      if (row.entity_id !== this.entityId) return [];
      const resourceId = row.resource_type as ResourcesIds;
      const production = this.current(resourceId)!.production;
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
    const productionPerSecond = divideByPrecision(Number(productionInfo.production.production_rate || 0), false);

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

    const ticksSinceLastUpdate = elapsedProductionTicks(production.last_updated_at, currentTick);
    const totalAmountProduced = BigInt(ticksSinceLastUpdate) * production.production_rate;
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
