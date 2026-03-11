const RESOURCE_PRECISION = 1_000_000_000;

export interface ComputeBalanceParams {
  rawBalance: number;
  productionRate: number;
  lastUpdatedAt: number;
  currentTick: number;
  isFood: boolean;
  outputAmountLeft: number;
  buildingCount: number;
  storageCapacityKg: number;
  storageUsedKg: number;
  resourceWeightKg: number;
  precision?: number;
}

export interface ComputeBalanceResult {
  balance: number;
  atMaxCapacity: boolean;
  amountProduced: number;
}

export function computeBalance(params: ComputeBalanceParams): ComputeBalanceResult {
  const precision = params.precision ?? RESOURCE_PRECISION;
  const ticksElapsed = Math.max(0, params.currentTick - params.lastUpdatedAt);

  const rawBase = Math.floor(params.rawBalance / precision);

  if (params.productionRate === 0 || params.buildingCount === 0) {
    return { balance: rawBase, atMaxCapacity: false, amountProduced: 0 };
  }

  let produced = Math.floor((ticksElapsed * params.productionRate) / precision);

  // Non-food production is capped at outputAmountLeft
  if (!params.isFood) {
    const maxOutput = Math.floor(params.outputAmountLeft / precision);
    produced = Math.min(produced, maxOutput);
  }

  let totalBalance = rawBase + produced;

  // Apply storage capacity constraint
  const freeStorageKg = Math.max(0, params.storageCapacityKg - params.storageUsedKg);
  const maxUnitsFromStorage =
    params.resourceWeightKg > 0 ? Math.floor(freeStorageKg / params.resourceWeightKg) : Infinity;

  const atMaxCapacity = totalBalance >= maxUnitsFromStorage;

  if (atMaxCapacity) {
    totalBalance = maxUnitsFromStorage;
    produced = Math.max(0, totalBalance - rawBase);
  }

  return {
    balance: totalBalance,
    atMaxCapacity,
    amountProduced: produced,
  };
}

export interface ComputeDepletionTimeParams {
  outputAmountLeft: number;
  productionRate: number;
  lastUpdatedAt: number;
  currentTick: number;
  tickIntervalSeconds: number;
  isFood: boolean;
  precision?: number;
}

export interface ComputeDepletionTimeResult {
  timeRemainingSeconds: number;
  depletesAt: number | null;
}

export function computeDepletionTime(params: ComputeDepletionTimeParams): ComputeDepletionTimeResult {
  const precision = params.precision ?? RESOURCE_PRECISION;

  if (params.isFood || params.productionRate === 0) {
    return { timeRemainingSeconds: Infinity, depletesAt: null };
  }

  const ticksElapsed = Math.max(0, params.currentTick - params.lastUpdatedAt);
  const totalOutput = Math.floor(params.outputAmountLeft / precision);
  const alreadyProduced = Math.floor((ticksElapsed * params.productionRate) / precision);
  const remaining = Math.max(0, totalOutput - alreadyProduced);

  if (remaining === 0) {
    const depletionTick = params.lastUpdatedAt + ticksElapsed;
    return {
      timeRemainingSeconds: 0,
      depletesAt: depletionTick * params.tickIntervalSeconds,
    };
  }

  const ratePerTick = params.productionRate / precision;
  const ticksUntilDepleted = Math.ceil(remaining / ratePerTick);
  const timeRemainingSeconds = ticksUntilDepleted * params.tickIntervalSeconds;

  const depletionTick = params.currentTick + ticksUntilDepleted;
  const depletesAt = depletionTick * params.tickIntervalSeconds;

  return { timeRemainingSeconds, depletesAt };
}
