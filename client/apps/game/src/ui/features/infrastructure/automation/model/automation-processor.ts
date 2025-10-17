import {
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  RealmAutomationConfig,
  RealmAutomationExecutionSummary,
  isAutomationResourceBlocked,
} from "@/hooks/store/use-automation-store";
import { configManager, divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";

export const PROCESS_INTERVAL_MS = 60 * 1000;

const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((value) => typeof value === "number") as ResourcesIds[];

export interface ResourceCycleCall {
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

export interface BuildRealmProductionPlanArgs {
  realmConfig: RealmAutomationConfig;
  components: ClientComponents | null | undefined;
  currentTick?: number;
}

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

const DEFAULT_PLAN_CALLSET: RealmProductionCallset = {
  resourceToResource: [],
  laborToResource: [],
};

export const buildRealmProductionPlan = ({
  realmConfig,
  components,
  currentTick,
}: BuildRealmProductionPlanArgs): RealmProductionPlan => {
  if (!realmConfig) {
    return { ...ZERO_PLAN };
  }

  const realmIdNumber = Number(realmConfig.realmId);
  if (!Number.isFinite(realmIdNumber) || realmIdNumber <= 0) {
    return { ...ZERO_PLAN };
  }

  const entityType = realmConfig.entityType ?? "realm";

  if (!components) {
    return {
      ...ZERO_PLAN,
      realmId: realmIdNumber,
      realmKey: realmConfig.realmId,
      realmName: realmConfig.realmName,
      evaluatedResourceIds: [],
    };
  }

  const resourceManager = new ResourceManager(components, realmIdNumber);

  const configuredResourceIds = Object.keys(realmConfig.resources).map((key) => Number(key) as ResourcesIds);
  const resourceIdsToProcess = new Set<ResourcesIds>(configuredResourceIds);

  const resourceComponent = resourceManager.getResource();
  if (resourceComponent) {
    for (const resourceId of ALL_RESOURCE_IDS) {
      const production = ResourceManager.balanceAndProduction(resourceComponent, resourceId).production;
      if (production && production.building_count > 0) {
        resourceIdsToProcess.add(resourceId);
      }
    }
  }

  if (resourceIdsToProcess.size === 0) {
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

  const resourceDefinitions = Array.from(resourceIdsToProcess)
    .filter((resourceId) => !isAutomationResourceBlocked(resourceId, entityType))
    .sort((a, b) => a - b)
    .map((resourceId) => {
      const config = realmConfig.resources[resourceId];
      const percentages = config?.percentages
        ? { ...config.percentages }
        : { ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES };
      return { resourceId, config, percentages };
    });

  const resourcesToTrack = new Set<ResourcesIds>();
  for (const definition of resourceDefinitions) {
    const {
      resourceId,
      percentages: { resourceToResource, laborToResource },
    } = definition;

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
    try {
      if (typeof currentTick === "number" && Number.isFinite(currentTick)) {
        const { balance } = resourceManager.balanceWithProduction(currentTick, resourceId);
        const human = divideByPrecision(Number(balance));
        return human;
      }
    } catch (error) {
      console.log("[Automation] balanceWithProduction fallback", {
        realmId: realmConfig.realmId,
        resourceId,
        error,
      });
    }
    const fallbackRaw = resourceManager.balance(resourceId);
    return divideByPrecision(Number(fallbackRaw));
  };

  resourcesToTrack.forEach((resourceId) => {
    const balanceHuman = computeHumanBalance(resourceId);
    totalAvailable.set(resourceId, balanceHuman);
    const maxConsumable = Math.floor((balanceHuman * MAX_RESOURCE_ALLOCATION_PERCENT) / 100);
    availableBudget.set(resourceId, Math.max(0, maxConsumable));
  });

  const planCallset: RealmProductionCallset = {
    resourceToResource: [],
    laborToResource: [],
  };
  const resourceExecutions: RealmAutomationExecutionSummary["resourceToResource"] = [];
  const laborExecutions: RealmAutomationExecutionSummary["laborToResource"] = [];
  const skipped: RealmAutomationExecutionSummary["skipped"] = [];

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
    } = definition;

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

          const desired = Math.floor((total * resourceToResource) / 100);
          if (desired <= 0) {
            maxCycles = 0;
            break;
          }
          const permitted = Math.min(desired, budget);
          const cyclesForInput = Math.floor(permitted / input.amount);
          maxCycles = Math.min(maxCycles, cyclesForInput);
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
        console.log("[Automation] Missing labor recipe configuration", {
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

          const desired = Math.floor((total * laborToResource) / 100);
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
          console.log("[Automation] Labor recipe insufficient inputs", {
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
              console.log("[Automation] Labor recipe reserve failure", {
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
): RealmAutomationExecutionSummary => ({
  executedAt,
  resourceToResource: plan.resourceExecutions,
  laborToResource: plan.laborExecutions,
  consumptionByResource: plan.consumptionByResource,
  outputsByResource: plan.outputsByResource,
  skipped: plan.skipped,
});
