import {
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  isAutomationResourceBlocked,
  type RealmAutomationConfig,
  type RealmEntityType,
  type ResourceAutomationPercentages,
} from "@/hooks/store/use-automation-store";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";

const SMART_T1_RESOURCES: ResourcesIds[] = [ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Coal];
const SMART_T2_RESOURCES: ResourcesIds[] = [ResourcesIds.Gold, ResourcesIds.ColdIron, ResourcesIds.Ironwood];
const SMART_T3_RESOURCES: ResourcesIds[] = [ResourcesIds.Adamantine, ResourcesIds.Mithral, ResourcesIds.Dragonhide];

const SMART_ARMY_T1: ResourcesIds[] = [ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin];
const SMART_ARMY_T2: ResourcesIds[] = [ResourcesIds.KnightT2, ResourcesIds.CrossbowmanT2, ResourcesIds.PaladinT2];
const SMART_ARMY_T3: ResourcesIds[] = [ResourcesIds.KnightT3, ResourcesIds.CrossbowmanT3, ResourcesIds.PaladinT3];

export type RealmPresetId = "smart" | "idle" | "custom";

export const REALM_PRESETS: { id: RealmPresetId; label: string; description?: string }[] = [
  {
    id: "smart",
    label: "Smart",
    description: "Auto-allocate production; uses labor only when tier-1 is incomplete.",
  },
  { id: "custom", label: "Custom", description: "Manually tuned mix of labor/resource." },
  { id: "idle", label: "Idle", description: "Pause automation (0%)." },
];

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > MAX_RESOURCE_ALLOCATION_PERCENT) return MAX_RESOURCE_ALLOCATION_PERCENT;
  return Math.round(value);
};

type SplitMode = "resource" | "labor";

const buildSequentialWeights = (count: number, baseWeights: number[]): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [baseWeights[0] ?? 0];
  if (count === 2) return [baseWeights[1] ?? baseWeights[0] ?? 0, baseWeights[1] ?? baseWeights[0] ?? 0];
  // For 3 or more, keep the last weight for every entry to flatten allocation.
  const fallback = baseWeights[2] ?? baseWeights[baseWeights.length - 1] ?? 0;
  return Array.from({ length: count }, () => fallback);
};

const assignTierSplit = (
  target: Map<number, { resourceToResource: number; laborToResource: number }>,
  resourcesInTier: ResourcesIds[],
  weights: number[],
  mode: SplitMode = "resource",
) => {
  resourcesInTier.forEach((resourceId, index) => {
    const weight = clampPercent(weights[index] ?? 0);
    const existing = target.get(resourceId) ?? { resourceToResource: 0, laborToResource: 0 };
    target.set(resourceId, {
      resourceToResource: mode === "resource" ? weight : existing.resourceToResource,
      laborToResource: mode === "labor" ? weight : existing.laborToResource,
    });
  });
};

const buildSmartPresetAllocations = (
  resources: ResourcesIds[],
): Map<number, { resourceToResource: number; laborToResource: number }> => {
  const allocations = new Map<number, { resourceToResource: number; laborToResource: number }>();
  const presentSet = new Set(resources);

  const presentT1 = SMART_T1_RESOURCES.filter((resourceId) => presentSet.has(resourceId));
  const presentT2 = SMART_T2_RESOURCES.filter((resourceId) => presentSet.has(resourceId));
  const presentT3 = SMART_T3_RESOURCES.filter((resourceId) => presentSet.has(resourceId));

  const presentArmyT1 = SMART_ARMY_T1.filter((resourceId) => presentSet.has(resourceId));
  const presentArmyT2 = SMART_ARMY_T2.filter((resourceId) => presentSet.has(resourceId));
  const presentArmyT3 = SMART_ARMY_T3.filter((resourceId) => presentSet.has(resourceId));

  const hasArmy = presentArmyT1.length > 0 || presentArmyT2.length > 0 || presentArmyT3.length > 0;
  const hasHigherResources = presentT2.length > 0 || presentT3.length > 0 || hasArmy;
  const t1Complete = SMART_T1_RESOURCES.every((resourceId) => presentSet.has(resourceId));

  if (presentT1.length > 0) {
    if (!t1Complete) {
      // Incomplete tier-1 set: 5% on each available T1 (labor slider only).
      assignTierSplit(
        allocations,
        presentT1,
        presentT1.map(() => 5),
        "labor",
      );
    } else if (!hasHigherResources) {
      // Complete T1 only: 30% each on resource slider.
      assignTierSplit(allocations, SMART_T1_RESOURCES, [30, 30, 30], "resource");
    } else {
      // Complete T1 with army and/or higher tiers: 20% wood, 20% coal, 30% copper on resource slider.
      const orderedT1 = [ResourcesIds.Wood, ResourcesIds.Coal, ResourcesIds.Copper];
      assignTierSplit(
        allocations,
        orderedT1.filter((id) => presentSet.has(id)),
        [20, 20, 30],
        "resource",
      );
    }
  }

  if (t1Complete && presentT2.length > 0) {
    const weights = buildSequentialWeights(presentT2.length, [10, 5, 3]);
    assignTierSplit(
      allocations,
      SMART_T2_RESOURCES.filter((id) => presentSet.has(id)),
      weights,
      "resource",
    );
  }

  if (t1Complete && presentT3.length > 0) {
    const weights = buildSequentialWeights(presentT3.length, [10, 5, 3]);
    assignTierSplit(
      allocations,
      SMART_T3_RESOURCES.filter((id) => presentSet.has(id)),
      weights,
      "resource",
    );
  }

  // Army allocations (resource slider)
  if (presentArmyT3.length > 0) {
    assignTierSplit(allocations, presentArmyT3, buildSequentialWeights(presentArmyT3.length, [50, 25, 15]), "resource");
    if (presentArmyT2.length > 0) {
      assignTierSplit(
        allocations,
        presentArmyT2,
        buildSequentialWeights(presentArmyT2.length, [30, 15, 10]),
        "resource",
      );
    }
    if (presentArmyT1.length > 0) {
      assignTierSplit(allocations, presentArmyT1, buildSequentialWeights(presentArmyT1.length, [10, 5, 3]), "resource");
    }
  } else if (presentArmyT2.length > 0) {
    assignTierSplit(allocations, presentArmyT2, buildSequentialWeights(presentArmyT2.length, [30, 15, 10]), "resource");
    if (presentArmyT1.length > 0) {
      assignTierSplit(allocations, presentArmyT1, buildSequentialWeights(presentArmyT1.length, [10, 5, 3]), "resource");
    }
  } else if (presentArmyT1.length > 0) {
    assignTierSplit(allocations, presentArmyT1, buildSequentialWeights(presentArmyT1.length, [30, 20, 10]), "resource");
  }

  // Ensure every resource has an entry, defaulting to zero.
  resources.forEach((resourceId) => {
    if (!allocations.has(resourceId)) {
      allocations.set(resourceId, { resourceToResource: 0, laborToResource: 0 });
    }
  });

  return allocations;
};

export const calculatePresetAllocations = (
  resourceIds: ResourcesIds[],
  presetId: RealmPresetId,
  entityType: RealmEntityType = "realm",
): Map<number, ResourceAutomationPercentages> => {
  const allocations = new Map<number, ResourceAutomationPercentages>();

  const scopedIds = Array.from(new Set(resourceIds)).filter(
    (resourceId) => !isAutomationResourceBlocked(resourceId, entityType),
  );

  if (!scopedIds.length) {
    return allocations;
  }

  if (presetId === "idle") {
    scopedIds.forEach((resourceId) => {
      allocations.set(resourceId, { resourceToResource: 0, laborToResource: 0 });
    });
    return allocations;
  }

  if (presetId === "smart") {
    const smartAllocations = buildSmartPresetAllocations(scopedIds);
    scopedIds.forEach((resourceId) => {
      const next = smartAllocations.get(resourceId) ?? { resourceToResource: 0, laborToResource: 0 };
      allocations.set(resourceId, {
        resourceToResource: next.resourceToResource,
        laborToResource: resourceId === ResourcesIds.Donkey ? 0 : next.laborToResource,
      });
    });
    return allocations;
  }

  // Custom allocations are resolved from stored percentages elsewhere.
  return allocations;
};

export const getAutomationOverallocation = (
  percentagesByResource: Record<number, ResourceAutomationPercentages> | undefined,
  entityType: RealmEntityType = "realm",
): { resourceOver: boolean; laborOver: boolean } => {
  if (!percentagesByResource) {
    return { resourceOver: false, laborOver: false };
  }

  const resourceTotals = new Map<number, number>();
  const laborTotals = new Map<number, number>();

  Object.entries(percentagesByResource).forEach(([key, percentages]) => {
    const resourceId = Number(key) as ResourcesIds;
    if (isAutomationResourceBlocked(resourceId, entityType)) {
      return;
    }
    const rawComplexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
    const complexInputs = rawComplexInputs.filter(
      (input: { resource: ResourcesIds }) =>
        !isAutomationResourceBlocked(input.resource, entityType, "input") && input.resource !== ResourcesIds.Wheat,
    );

    const rawSimpleInputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];
    const simpleInputs = rawSimpleInputs.filter(
      (input: { resource: ResourcesIds }) =>
        !isAutomationResourceBlocked(input.resource, entityType, "input") && input.resource !== ResourcesIds.Wheat,
    );

    if ((percentages?.resourceToResource ?? 0) > 0) {
      complexInputs.forEach(({ resource }: { resource: ResourcesIds }) => {
        resourceTotals.set(resource, (resourceTotals.get(resource) ?? 0) + (percentages?.resourceToResource ?? 0));
      });
    }

    if ((percentages?.laborToResource ?? 0) > 0) {
      simpleInputs.forEach(({ resource }: { resource: ResourcesIds }) => {
        laborTotals.set(resource, (laborTotals.get(resource) ?? 0) + (percentages?.laborToResource ?? 0));
      });
    }
  });

  let resourceOver = false;
  let laborOver = false;

  resourceTotals.forEach((value) => {
    if (value > MAX_RESOURCE_ALLOCATION_PERCENT) {
      resourceOver = true;
    }
  });

  laborTotals.forEach((value) => {
    if (value > MAX_RESOURCE_ALLOCATION_PERCENT) {
      laborOver = true;
    }
  });

  return { resourceOver, laborOver };
};

export const inferRealmPreset = (automation?: RealmAutomationConfig): RealmPresetId => {
  // Default to smart when nothing has been configured yet.
  if (!automation) return "smart";
  if (automation.presetId) {
    return automation.presetId as RealmPresetId;
  }

  return "smart";
};
