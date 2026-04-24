import { ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "./config-manager";

/**
 * Automation percentage values for a single produced resource. The percentages are raw
 * slider values (0..maxAllocationPercent), not ratios.
 */
export interface ResourceAutomationPercentagesInput {
  resourceToResource: number;
  laborToResource: number;
}

export interface AggregateConsumptionOptions {
  /**
   * The upper bound for a single percentage slider. Percentages are divided by this
   * value to produce a ratio that scales the per-cycle recipe input amount. Defaults to
   * the client-side constant `MAX_RESOURCE_ALLOCATION_PERCENT` (90).
   */
  maxAllocationPercent?: number;
  /**
   * Seconds elapsed in one automation cycle. Per-cycle consumption is divided by this
   * value to produce per-second output. Defaults to the client-side cycle length of 60
   * seconds (`PROCESS_INTERVAL_MS`).
   */
  cycleSeconds?: number;
  /**
   * Optional override for the complex/simple recipe lookups. Useful for tests; defaults
   * to the live `configManager` singleton.
   */
  recipes?: {
    complexSystemResourceInputs: Record<number, Array<{ resource: ResourcesIds; amount: number }>>;
    simpleSystemResourceInputs: Record<number, Array<{ resource: ResourcesIds; amount: number }>>;
  };
}

const DEFAULT_MAX_ALLOCATION_PERCENT = 90;
const DEFAULT_CYCLE_SECONDS = 60;

const clampRatio = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

/**
 * Pure helper that aggregates per-second resource consumption across a set of
 * automated produced resources.
 *
 * The math mirrors the in-UI aggregation used inside `realm-automation-panel.tsx`:
 *
 *   perCycle = (percent / maxAllocationPercent) * recipeInput.amount
 *   perSecond = perCycle / cycleSeconds
 *
 * Callers provide the set of produced resource IDs to consider and their automation
 * percentages. Recipe inputs are resolved from `configManager` unless overridden via
 * `options.recipes`.
 */
export const aggregateConsumptionPerSecond = (
  producedResourceIds: Iterable<ResourcesIds | number>,
  percentagesByResource: Record<number, ResourceAutomationPercentagesInput | undefined>,
  options?: AggregateConsumptionOptions,
): Map<number, number> => {
  const maxAllocationPercent = options?.maxAllocationPercent ?? DEFAULT_MAX_ALLOCATION_PERCENT;
  const cycleSeconds = options?.cycleSeconds ?? DEFAULT_CYCLE_SECONDS;
  const complexInputsBySource =
    options?.recipes?.complexSystemResourceInputs ?? configManager.complexSystemResourceInputs;
  const simpleInputsBySource = options?.recipes?.simpleSystemResourceInputs ?? configManager.simpleSystemResourceInputs;

  const totals = new Map<number, number>();

  if (maxAllocationPercent <= 0 || cycleSeconds <= 0) {
    return totals;
  }

  const accumulate = (resourceId: number, amountPerCycle: number) => {
    if (!Number.isFinite(amountPerCycle) || amountPerCycle <= 0) return;
    const perSecond = amountPerCycle / cycleSeconds;
    totals.set(resourceId, (totals.get(resourceId) ?? 0) + perSecond);
  };

  for (const rawResourceId of producedResourceIds) {
    const resourceId = Number(rawResourceId) as ResourcesIds;
    const percentages = percentagesByResource[resourceId];
    if (!percentages) continue;

    const resourceRatio = clampRatio(percentages.resourceToResource / maxAllocationPercent);
    const laborRatio = clampRatio(percentages.laborToResource / maxAllocationPercent);

    if (resourceRatio > 0) {
      const inputs = complexInputsBySource[resourceId] ?? [];
      for (const input of inputs) {
        accumulate(input.resource, resourceRatio * input.amount);
      }
    }

    if (laborRatio > 0) {
      const inputs = simpleInputsBySource[resourceId] ?? [];
      for (const input of inputs) {
        accumulate(input.resource, laborRatio * input.amount);
      }
    }
  }

  return totals;
};
