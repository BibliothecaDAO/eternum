import {
  AUTOMATION_INPUT_BUDGET_PERCENT,
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  RealmAutomationConfig,
  RealmAutomationExecutionSummary,
  type ResourceAutomationPercentages,
  isAutomationResourceBlocked,
} from "@/hooks/store/use-automation-store";
import { calculatePresetAllocations } from "@/utils/automation-presets";
import { verboseLog } from "@/utils/dev-mode";
import { configManager, divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";

export const PROCESS_INTERVAL_MS = 60 * 1000;

interface RealmResourceSnapshotEntry {
  resourceId: ResourcesIds;
  balanceHuman: number;
  hasActiveProduction: boolean;
  productionPerSecond: number;
}

export type RealmResourceSnapshot = Map<ResourcesIds, RealmResourceSnapshotEntry>;

const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((value) => typeof value === "number") as ResourcesIds[];

interface ResourceCycleCall {
  resourceId: ResourcesIds;
  cycles: number;
}

export interface RealmProductionCallset {
  resourceToResource: ResourceCycleCall[];
  laborToResource: ResourceCycleCall[];
}

export interface RealmProductionPlan {
  realmId: number;
  realmKey: string;
  realmName?: string;
  callset: RealmProductionCallset;
  consumptionByResource: Record<number, number>;
  outputsByResource: Record<number, number>;
  resourceExecutions: RealmAutomationExecutionSummary["resourceToResource"];
  laborExecutions: RealmAutomationExecutionSummary["laborToResource"];
  skipped: RealmAutomationExecutionSummary["skipped"];
  evaluatedResourceIds: ResourcesIds[];
}

interface BuildRealmProductionPlanArgs {
  realmConfig: RealmAutomationConfig;
  snapshot: RealmResourceSnapshot;
}

type AutomationSkipEntry = RealmAutomationExecutionSummary["skipped"][number];

const ZERO_PLAN: RealmProductionPlan = {
  realmId: 0,
  realmKey: "",
  callset: { resourceToResource: [], laborToResource: [] },
  consumptionByResource: {},
  outputsByResource: {},
  resourceExecutions: [],
  laborExecutions: [],
  skipped: [],
  evaluatedResourceIds: [],
};

const addToRecord = (record: Record<number, number>, resourceId: ResourcesIds, delta: number) => {
  if (!Number.isFinite(delta) || delta <= 0) return;
  record[resourceId] = (record[resourceId] ?? 0) + delta;
};

const ensurePositiveNumber = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value > MAX_RESOURCE_ALLOCATION_PERCENT) return MAX_RESOURCE_ALLOCATION_PERCENT;
  return Math.round(value);
};

const DEFAULT_PLAN_CALLSET: RealmProductionCallset = {
  resourceToResource: [],
  laborToResource: [],
};

const TROOP_PLANNING_ORDER = new Map<ResourcesIds, number>([
  [ResourcesIds.Knight, 1],
  [ResourcesIds.Crossbowman, 2],
  [ResourcesIds.Paladin, 3],
  [ResourcesIds.KnightT2, 4],
  [ResourcesIds.CrossbowmanT2, 5],
  [ResourcesIds.PaladinT2, 6],
  [ResourcesIds.KnightT3, 7],
  [ResourcesIds.CrossbowmanT3, 8],
  [ResourcesIds.PaladinT3, 9],
]);

const isTroopResource = (resourceId: ResourcesIds): boolean => TROOP_PLANNING_ORDER.has(resourceId);

const compareAutomationResources = (left: ResourcesIds, right: ResourcesIds): number => {
  const leftTroopOrder = TROOP_PLANNING_ORDER.get(left);
  const rightTroopOrder = TROOP_PLANNING_ORDER.get(right);

  if (leftTroopOrder !== undefined && rightTroopOrder !== undefined) {
    return leftTroopOrder - rightTroopOrder;
  }

  return left - right;
};

const isResourceActiveInSnapshot = (snapshot: RealmResourceSnapshot, resourceId: ResourcesIds): boolean =>
  snapshot.get(resourceId)?.hasActiveProduction === true;

type AutomationEntityType = RealmAutomationConfig["entityType"];

const warnedDependencyCycles = new Set<string>();

const buildResourceDependencyOrder = (
  resourceIds: ResourcesIds[],
  entityType: AutomationEntityType,
): ResourcesIds[] => {
  if (!resourceIds.length) return [];

  const idSet = new Set<ResourcesIds>(resourceIds);
  const dependsOn = new Map<ResourcesIds, Set<ResourcesIds>>();
  const dependents = new Map<ResourcesIds, Set<ResourcesIds>>();

  for (const resourceId of resourceIds) {
    dependsOn.set(resourceId, new Set());
    dependents.set(resourceId, new Set());
  }

  const addEdge = (dependent: ResourcesIds, input: ResourcesIds) => {
    if (dependent === input) return;
    if (!idSet.has(input)) return;
    dependsOn.get(dependent)!.add(input);
    dependents.get(input)!.add(dependent);
  };

  const collectInputs = (resourceId: ResourcesIds): ResourcesIds[] => {
    const complexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
    const laborConfig = configManager.getLaborConfig?.(resourceId);
    const laborInputs = laborConfig?.inputResources ?? [];
    const aggregated: ResourcesIds[] = [];
    for (const input of complexInputs) {
      if (!isAutomationResourceBlocked(input.resource, entityType, "input")) {
        aggregated.push(input.resource);
      }
    }
    for (const input of laborInputs) {
      if (!isAutomationResourceBlocked(input.resource, entityType, "input")) {
        aggregated.push(input.resource);
      }
    }
    return aggregated;
  };

  for (const resourceId of resourceIds) {
    for (const input of collectInputs(resourceId)) {
      addEdge(resourceId, input);
    }
  }

  const insertSorted = (bucket: ResourcesIds[], value: ResourcesIds) => {
    const idx = bucket.findIndex((other) => compareAutomationResources(value, other) < 0);
    if (idx === -1) bucket.push(value);
    else bucket.splice(idx, 0, value);
  };

  const ready: ResourcesIds[] = [];
  for (const [resourceId, deps] of dependsOn) {
    if (deps.size === 0) insertSorted(ready, resourceId);
  }

  const order: ResourcesIds[] = [];
  while (ready.length) {
    const current = ready.shift()!;
    order.push(current);
    const downstream = Array.from(dependents.get(current) ?? []).sort(compareAutomationResources);
    for (const dependent of downstream) {
      const deps = dependsOn.get(dependent)!;
      deps.delete(current);
      if (deps.size === 0) insertSorted(ready, dependent);
    }
  }

  if (order.length !== resourceIds.length) {
    const missing = resourceIds.filter((id) => !order.includes(id));
    // The cycle is a property of the production config, so it re-detects on
    // every evaluation — warn once per distinct cycle, not once per tick
    // (one session logged the identical line 111 times).
    const cycleSignature = [...missing].sort((a, b) => a - b).join(",");
    if (!warnedDependencyCycles.has(cycleSignature)) {
      warnedDependencyCycles.add(cycleSignature);
      console.warn("[Automation] Resource dependency cycle detected; falling back to numeric order", { missing });
    }
    return [...resourceIds].sort(compareAutomationResources);
  }

  return order;
};

const buildResourceIdsToEvaluate = (
  producedResourceIds: ResourcesIds[],
  configuredCustomIds: ResourcesIds[],
): ResourcesIds[] => Array.from(new Set<ResourcesIds>([...producedResourceIds, ...configuredCustomIds]));

const canFundOneCycle = (
  recipeInputs: Array<{ resource: ResourcesIds; amount: number }>,
  getTotal: (resourceId: ResourcesIds) => number,
  getBudget: (resourceId: ResourcesIds) => number,
): boolean => {
  const requiredInputs = recipeInputs.filter((input) => input.amount > 0);
  if (!requiredInputs.length) return false;

  return requiredInputs.every((input) => getTotal(input.resource) > 0 && getBudget(input.resource) >= input.amount);
};

const shouldUseSmartMinimumTroopCycle = ({
  presetId,
  resourceId,
  resourceToResource,
  recipeInputs,
  getTotal,
  getBudget,
}: {
  presetId: string;
  resourceId: ResourcesIds;
  resourceToResource: number;
  recipeInputs: Array<{ resource: ResourcesIds; amount: number }>;
  getTotal: (resourceId: ResourcesIds) => number;
  getBudget: (resourceId: ResourcesIds) => number;
}): boolean => {
  if (presetId !== "smart") return false;
  if (!isTroopResource(resourceId)) return false;
  if (resourceToResource <= 0) return false;
  return canFundOneCycle(recipeInputs, getTotal, getBudget);
};

const resolveResourceLabel = (resourceId: ResourcesIds): string => {
  const label = ResourcesIds[resourceId];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

export const buildAutomationSkipMessage = (skip: AutomationSkipEntry): string => {
  const resource = resolveResourceLabel(skip.resourceId);

  switch (skip.reason) {
    case "No active production building":
      return `${resource} has no active production building`;
    case "Insufficient complex recipe inputs":
      return `${resource} waiting for recipe inputs`;
    case "Missing complex recipe configuration":
      return `${resource} missing resource recipe`;
    case "Resource budget exhausted for complex recipe":
      return `${resource} resource budget exhausted`;
    case "Missing labor recipe configuration":
      return `${resource} missing labor recipe`;
    case "Insufficient labor recipe inputs":
      return `${resource} waiting for labor inputs`;
    case "Resource budget exhausted for labor recipe":
      return `${resource} labor budget exhausted`;
    default:
      return `${resource}: ${skip.reason}`;
  }
};

export const buildAutomationPlanSkipMessage = (plan: RealmProductionPlan): string => {
  const firstSkip = plan.skipped[0];
  if (!firstSkip) return "No executable calls";

  const suffix = plan.skipped.length > 1 ? ` (+${plan.skipped.length - 1} more)` : "";
  return `${buildAutomationSkipMessage(firstSkip)}${suffix}`;
};

interface BuildRealmResourceSnapshotArgs {
  components: ClientComponents | null | undefined;
  realmId: number;
  currentTick?: number;
}

export const buildRealmResourceSnapshot = ({
  components,
  realmId,
  currentTick,
}: BuildRealmResourceSnapshotArgs): RealmResourceSnapshot => {
  const snapshot: RealmResourceSnapshot = new Map();

  if (!components) return snapshot;
  if (!Number.isFinite(realmId) || realmId <= 0) return snapshot;
  if (typeof currentTick !== "number" || !Number.isFinite(currentTick)) return snapshot;

  const manager = new ResourceManager(components, realmId);
  const resourceComponent = manager.getResource();
  if (!resourceComponent) return snapshot;

  for (const resourceId of ALL_RESOURCE_IDS) {
    try {
      const balanceAndProduction = ResourceManager.balanceAndProduction(resourceComponent, resourceId);
      const { production } = balanceAndProduction;
      const { balance: projectedBalance } = ResourceManager.balanceWithProduction(
        resourceComponent,
        currentTick,
        resourceId,
      );
      const balanceHuman = divideByPrecision(Number(projectedBalance));
      const hasActiveProduction = Boolean(production && production.building_count > 0);
      const productionData = ResourceManager.calculateResourceProductionData(
        resourceId,
        balanceAndProduction,
        currentTick,
      );
      const productionPerSecond = Number.isFinite(productionData.productionPerSecond)
        ? productionData.productionPerSecond
        : 0;

      snapshot.set(resourceId, {
        resourceId,
        balanceHuman,
        hasActiveProduction,
        productionPerSecond,
      });
    } catch {
      // ignore per-resource errors to avoid failing the whole snapshot
    }
  }

  return snapshot;
};

export const buildRealmProductionPlan = ({
  realmConfig,
  snapshot,
}: BuildRealmProductionPlanArgs): RealmProductionPlan => {
  if (!realmConfig) {
    return { ...ZERO_PLAN };
  }

  const realmIdNumber = Number(realmConfig.realmId);
  if (!Number.isFinite(realmIdNumber) || realmIdNumber <= 0) {
    return { ...ZERO_PLAN };
  }

  const entityType = realmConfig.entityType ?? "realm";

  const producedResourceIds: ResourcesIds[] = [];
  snapshot.forEach((entry) => {
    if (entry.hasActiveProduction) {
      producedResourceIds.push(entry.resourceId);
    }
  });

  const presetId = realmConfig.presetId ?? "smart";
  const configuredCustomIds =
    presetId === "custom"
      ? Object.keys(realmConfig.customPercentages ?? {}).map((key) => Number(key) as ResourcesIds)
      : [];
  const resourceIdsToEvaluate = buildResourceIdsToEvaluate(producedResourceIds, configuredCustomIds);

  if (resourceIdsToEvaluate.length === 0) {
    return {
      realmId: realmIdNumber,
      realmKey: realmConfig.realmId,
      realmName: realmConfig.realmName,
      callset: { ...DEFAULT_PLAN_CALLSET },
      consumptionByResource: {},
      outputsByResource: {},
      resourceExecutions: [],
      laborExecutions: [],
      skipped: [],
      evaluatedResourceIds: [],
    };
  }

  const smartDefaults = calculatePresetAllocations(resourceIdsToEvaluate, "smart", entityType);
  const presetAllocations =
    presetId === "smart" || presetId === "idle"
      ? calculatePresetAllocations(resourceIdsToEvaluate, presetId, entityType)
      : new Map<number, ResourceAutomationPercentages>();

  const baselinePercentages = (resourceId: ResourcesIds): ResourceAutomationPercentages => {
    if (resourceId === ResourcesIds.Donkey) {
      return { resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT, laborToResource: 0 };
    }
    return { ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES };
  };

  const filteredResourceIds = resourceIdsToEvaluate.filter(
    (resourceId) => !isAutomationResourceBlocked(resourceId, entityType),
  );
  const orderedResourceIds = buildResourceDependencyOrder(filteredResourceIds, entityType);
  const resourceDefinitions = orderedResourceIds.map((resourceId) => {
    const customPercentages = realmConfig.customPercentages?.[resourceId];
    const presetPercentages = presetAllocations.get(resourceId);
    const smartPercentages = smartDefaults.get(resourceId) ?? baselinePercentages(resourceId);
    const hasActiveProduction = isResourceActiveInSnapshot(snapshot, resourceId);

    const source =
      presetId === "custom"
        ? (customPercentages ?? smartPercentages)
        : (presetPercentages ?? { resourceToResource: 0, laborToResource: 0 });

    const percentages: ResourceAutomationPercentages = {
      resourceToResource: clampPercent(source.resourceToResource),
      laborToResource: resourceId === ResourcesIds.Donkey ? 0 : clampPercent(source.laborToResource ?? 0),
    };

    return { resourceId, percentages, hasActiveProduction };
  });

  const skipped: RealmAutomationExecutionSummary["skipped"] = [];
  const resourcesToTrack = new Set<ResourcesIds>();
  for (const definition of resourceDefinitions) {
    const {
      resourceId,
      percentages: { resourceToResource, laborToResource },
      hasActiveProduction,
    } = definition;

    if (!hasActiveProduction) {
      skipped.push({
        resourceId,
        reason: "No active production building",
      });
      continue;
    }

    const hasActivity = ensurePositiveNumber(resourceToResource) || ensurePositiveNumber(laborToResource);

    if (!hasActivity) {
      continue;
    }

    resourcesToTrack.add(resourceId);

    if (resourceToResource > 0) {
      const inputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
      inputs.forEach((input) => {
        if (!isAutomationResourceBlocked(input.resource, entityType, "input")) {
          resourcesToTrack.add(input.resource);
        }
      });
    }

    if (laborToResource > 0) {
      const inputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];
      inputs.forEach((input) => {
        if (!isAutomationResourceBlocked(input.resource, entityType, "input")) {
          resourcesToTrack.add(input.resource);
        }
      });
    }
  }

  const totalAvailable = new Map<ResourcesIds, number>();
  const availableBudget = new Map<ResourcesIds, number>();
  const consumptionByResource: Record<number, number> = {};
  const outputsByResource: Record<number, number> = {};

  const computeHumanBalance = (resourceId: ResourcesIds): number => {
    const entry = snapshot.get(resourceId);
    return entry?.balanceHuman ?? 0;
  };

  resourcesToTrack.forEach((resourceId) => {
    const balanceHuman = computeHumanBalance(resourceId);
    totalAvailable.set(resourceId, balanceHuman);
    const maxConsumable = Math.floor((balanceHuman * AUTOMATION_INPUT_BUDGET_PERCENT) / 100);
    availableBudget.set(resourceId, Math.max(0, maxConsumable));
  });

  // Pre-allocate shared-input budget proportionally. Without this, consumers processed
  // first drain the 90% cap and later consumers (especially troops under the cycle-fallback
  // numeric ordering) get crumbs. Each input's scale factor caps every consumer's
  // requested share so total reservations fit within the budget.
  const totalDemandByInput = new Map<ResourcesIds, number>();
  const addDemand = (inputId: ResourcesIds, percent: number) => {
    if (!(percent > 0)) return;
    totalDemandByInput.set(inputId, (totalDemandByInput.get(inputId) ?? 0) + percent);
  };
  for (const definition of resourceDefinitions) {
    if (!definition.hasActiveProduction) continue;
    const { resourceId, percentages } = definition;
    if (percentages.resourceToResource > 0) {
      const inputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
      for (const input of inputs) {
        if (input.amount <= 0) continue;
        if (isAutomationResourceBlocked(input.resource, entityType, "input")) continue;
        addDemand(input.resource, percentages.resourceToResource);
      }
    }
    if (percentages.laborToResource > 0) {
      const laborConfig = configManager.getLaborConfig?.(resourceId);
      const inputs = laborConfig?.inputResources ?? [];
      for (const input of inputs) {
        if (input.amount <= 0) continue;
        if (isAutomationResourceBlocked(input.resource, entityType, "input")) continue;
        addDemand(input.resource, percentages.laborToResource);
      }
    }
  }
  const scaleFactorByInput = new Map<ResourcesIds, number>();
  totalDemandByInput.forEach((demand, inputId) => {
    const scale = demand > AUTOMATION_INPUT_BUDGET_PERCENT ? AUTOMATION_INPUT_BUDGET_PERCENT / demand : 1;
    scaleFactorByInput.set(inputId, scale);
  });
  const getInputShareScale = (inputId: ResourcesIds) => scaleFactorByInput.get(inputId) ?? 1;

  const planCallset: RealmProductionCallset = {
    resourceToResource: [],
    laborToResource: [],
  };
  const resourceExecutions: RealmAutomationExecutionSummary["resourceToResource"] = [];
  const laborExecutions: RealmAutomationExecutionSummary["laborToResource"] = [];

  const reserveAmount = (resourceId: ResourcesIds, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const currentBudget = availableBudget.get(resourceId) ?? 0;
    const nextBudget = currentBudget - amount;
    if (nextBudget < 0) {
      return false;
    }
    availableBudget.set(resourceId, nextBudget);
    addToRecord(consumptionByResource, resourceId, amount);
    return true;
  };

  const getTotal = (resourceId: ResourcesIds) => totalAvailable.get(resourceId) ?? 0;
  const getBudget = (resourceId: ResourcesIds) => availableBudget.get(resourceId) ?? 0;

  for (const definition of resourceDefinitions) {
    const {
      resourceId,
      percentages: { resourceToResource, laborToResource },
      hasActiveProduction,
    } = definition;

    if (!hasActiveProduction) {
      continue;
    }

    const hasConfig = ensurePositiveNumber(resourceToResource) || ensurePositiveNumber(laborToResource);
    if (!hasConfig) {
      continue;
    }

    // Resource -> Resource (complex recipe)
    if (resourceToResource > 0) {
      const recipeInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
      const outputPerCycle = configManager.complexSystemResourceOutput[resourceId]?.amount ?? 0;

      if (!recipeInputs.length || outputPerCycle <= 0) {
        skipped.push({
          resourceId,
          reason: "Missing complex recipe configuration",
        });
      } else {
        let maxCycles = Number.POSITIVE_INFINITY;

        for (const input of recipeInputs) {
          if (input.amount <= 0) {
            continue;
          }
          const total = getTotal(input.resource);
          const budget = getBudget(input.resource);
          if (total <= 0 || budget <= 0) {
            maxCycles = 0;
            break;
          }

          const desired = Math.floor((total * resourceToResource * getInputShareScale(input.resource)) / 100);
          if (desired <= 0) {
            maxCycles = 0;
            break;
          }
          const permitted = Math.min(desired, budget);
          const cyclesForInput = Math.floor(permitted / input.amount);
          maxCycles = Math.min(maxCycles, cyclesForInput);
        }

        if (
          (!Number.isFinite(maxCycles) || maxCycles <= 0) &&
          shouldUseSmartMinimumTroopCycle({
            presetId,
            resourceId,
            resourceToResource,
            recipeInputs,
            getTotal,
            getBudget,
          })
        ) {
          maxCycles = 1;
        }

        if (!Number.isFinite(maxCycles) || maxCycles <= 0) {
          skipped.push({
            resourceId,
            reason: "Insufficient complex recipe inputs",
          });
        } else {
          const inputsConsumed = recipeInputs.map(({ resource, amount }) => ({
            resourceId: resource,
            amount: amount * maxCycles,
          }));

          let allocationSucceeded = true;
          for (const entry of inputsConsumed) {
            if (!reserveAmount(entry.resourceId, entry.amount)) {
              allocationSucceeded = false;
              break;
            }
          }

          if (!allocationSucceeded) {
            skipped.push({
              resourceId,
              reason: "Resource budget exhausted for complex recipe",
            });
          } else {
            const produced = outputPerCycle * maxCycles;
            addToRecord(outputsByResource, resourceId, produced);
            planCallset.resourceToResource.push({ resourceId, cycles: maxCycles });
            resourceExecutions.push({
              resourceId,
              cycles: maxCycles,
              produced,
              inputs: inputsConsumed,
              method: "resource-to-resource",
            });
          }
        }
      }
    }

    // Labor -> Resource (simple recipe)
    if (laborToResource > 0) {
      const laborConfig = configManager.getLaborConfig(resourceId);
      const inputResources = laborConfig?.inputResources ?? [];
      const outputPerCycle = laborConfig?.resourceOutputPerInputResources ?? 0;

      if (!laborConfig || !inputResources.length || outputPerCycle <= 0) {
        verboseLog("[Automation] Missing labor recipe configuration", {
          realmId: realmConfig.realmId,
          realmName: realmConfig.realmName,
          entityType,
          resourceId,
          hasLaborConfig: Boolean(laborConfig),
          inputResourceCount: inputResources.length,
          outputPerCycle,
        });
        skipped.push({
          resourceId,
          reason: "Missing labor recipe configuration",
        });
      } else {
        let maxCycles = Number.POSITIVE_INFINITY;
        const laborDebug: Array<{
          inputResource: ResourcesIds;
          totalAvailable: number;
          budget: number;
          desired: number;
          permitted: number;
          amountPerCycle: number;
          cyclesForInput: number;
        }> = [];

        for (const input of inputResources) {
          if (input.amount <= 0) {
            laborDebug.push({
              inputResource: input.resource,
              totalAvailable: getTotal(input.resource),
              budget: getBudget(input.resource),
              desired: 0,
              permitted: 0,
              amountPerCycle: input.amount,
              cyclesForInput: 0,
            });
            continue;
          }
          const total = getTotal(input.resource);
          const budget = getBudget(input.resource);
          if (total <= 0 || budget <= 0) {
            maxCycles = 0;
            break;
          }

          const desired = Math.floor((total * laborToResource * getInputShareScale(input.resource)) / 100);
          if (desired <= 0) {
            laborDebug.push({
              inputResource: input.resource,
              totalAvailable: total,
              budget,
              desired,
              permitted: 0,
              amountPerCycle: input.amount,
              cyclesForInput: 0,
            });
            maxCycles = 0;
            break;
          }
          const permitted = Math.min(desired, budget);
          const cyclesForInput = Math.floor(permitted / input.amount);
          laborDebug.push({
            inputResource: input.resource,
            totalAvailable: total,
            budget,
            desired,
            permitted,
            amountPerCycle: input.amount,
            cyclesForInput,
          });
          maxCycles = Math.min(maxCycles, cyclesForInput);
        }

        if (!Number.isFinite(maxCycles) || maxCycles <= 0) {
          verboseLog("[Automation] Labor recipe insufficient inputs", {
            realmId: realmConfig.realmId,
            realmName: realmConfig.realmName,
            entityType,
            resourceId,
            laborToResourceTargetPercent: laborToResource,
            evaluatedLaborInputs: laborDebug,
            laborConfigInputCount: inputResources.length,
            laborConfigRaw: inputResources,
            availableBudgets: Array.from(availableBudget.entries()),
            totalAvailableResources: Array.from(totalAvailable.entries()),
          });
          skipped.push({
            resourceId,
            reason: "Insufficient labor recipe inputs",
          });
        } else {
          const inputsConsumed = inputResources.map(({ resource, amount }) => ({
            resourceId: resource,
            amount: amount * maxCycles,
          }));

          let allocationSucceeded = true;
          for (const entry of inputsConsumed) {
            if (!reserveAmount(entry.resourceId, entry.amount)) {
              allocationSucceeded = false;
              verboseLog("[Automation] Labor recipe reserve failure", {
                realmId: realmConfig.realmId,
                realmName: realmConfig.realmName,
                entityType,
                resourceId,
                attemptedInput: entry,
                remainingBudget: availableBudget.get(entry.resourceId),
                maxCycles,
                inputsConsumed,
              });
              break;
            }
          }

          if (!allocationSucceeded) {
            skipped.push({
              resourceId,
              reason: "Resource budget exhausted for labor recipe",
            });
          } else {
            const produced = outputPerCycle * maxCycles;
            addToRecord(outputsByResource, resourceId, produced);
            planCallset.laborToResource.push({ resourceId, cycles: maxCycles });
            laborExecutions.push({
              resourceId,
              cycles: maxCycles,
              produced,
              inputs: inputsConsumed,
              method: "labor-to-resource",
            });
          }
        }
      }
    }

    // Resource -> Labor
    // Resource -> Labor removed
  }

  return {
    realmId: realmIdNumber,
    realmKey: realmConfig.realmId,
    realmName: realmConfig.realmName,
    callset: planCallset,
    consumptionByResource,
    outputsByResource,
    resourceExecutions,
    laborExecutions,
    skipped,
    evaluatedResourceIds: resourceDefinitions.map((definition) => definition.resourceId),
  };
};

export const planHasExecutableCalls = (plan: RealmProductionPlan): boolean => {
  if (!plan) return false;
  const { callset } = plan;
  return Boolean(callset.resourceToResource.length || callset.laborToResource.length);
};

export const buildExecutionSummary = (
  plan: RealmProductionPlan,
  executedAt: number,
): RealmAutomationExecutionSummary => {
  const skippedByResource: Record<number, string> = {};
  plan.skipped.forEach((entry) => {
    // If the same resource skipped for multiple reasons (e.g. both the complex and labor
    // recipes failed), keep the first reason since that's the primary signal the player
    // cares about on the sidebar.
    if (skippedByResource[entry.resourceId] === undefined) {
      skippedByResource[entry.resourceId] = entry.reason;
    }
  });

  return {
    executedAt,
    resourceToResource: plan.resourceExecutions,
    laborToResource: plan.laborExecutions,
    consumptionByResource: plan.consumptionByResource,
    outputsByResource: plan.outputsByResource,
    skipped: plan.skipped,
    skippedByResource,
  };
};
