import {
  MAX_RESOURCE_ALLOCATION_PERCENT,
  isAutomationResourceBlocked,
  type RealmAutomationConfig,
  type ResourceAutomationPercentages,
} from "./types";
import { configManager } from "../index";
import { ResourcesIds } from "@bibliothecadao/types";

const SMART_T1_RESOURCES: ResourcesIds[] = [ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Coal];
const SMART_T2_RESOURCES: ResourcesIds[] = [ResourcesIds.Gold, ResourcesIds.ColdIron, ResourcesIds.Ironwood];
const SMART_T3_RESOURCES: ResourcesIds[] = [ResourcesIds.Adamantine, ResourcesIds.Mithral, ResourcesIds.Dragonhide];
const SMART_MARKET_DONKEY_RESOURCE_PERCENT = 5;

const SMART_ARMY_T1: ResourcesIds[] = [ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin];
const SMART_ARMY_T2: ResourcesIds[] = [ResourcesIds.KnightT2, ResourcesIds.CrossbowmanT2, ResourcesIds.PaladinT2];
const SMART_ARMY_T3: ResourcesIds[] = [ResourcesIds.KnightT3, ResourcesIds.CrossbowmanT3, ResourcesIds.PaladinT3];

export type RealmPresetId = "smart" | "idle" | "custom";

/**
 * The automation presets, the one place their words live: every surface that offers them (the realm card, the
 * Production window) names and explains them from here. Idle reads as Off, since an idle realm's automation is off.
 */
export const REALM_PRESETS: { id: RealmPresetId; label: string; description: string }[] = [
  { id: "smart", label: "Smart", description: "Production runs itself across buildings." },
  { id: "custom", label: "Custom", description: "Production follows the shares you set." },
  { id: "idle", label: "Off", description: "Nothing is produced automatically." },
];

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > MAX_RESOURCE_ALLOCATION_PERCENT) return MAX_RESOURCE_ALLOCATION_PERCENT;
  return Math.round(value);
};

export const resolveProductionPercentages = (
  percentages: ResourceAutomationPercentages,
): ResourceAutomationPercentages => ({
  resourceToResource: clampPercent(percentages.resourceToResource),
});

const buildSequentialWeights = (count: number, baseWeights: number[]): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [baseWeights[0] ?? 0];
  if (count === 2) return [baseWeights[1] ?? baseWeights[0] ?? 0, baseWeights[1] ?? baseWeights[0] ?? 0];
  // For 3 or more, keep the last weight for every entry to flatten allocation.
  const fallback = baseWeights[2] ?? baseWeights[baseWeights.length - 1] ?? 0;
  return Array.from({ length: count }, () => fallback);
};

const assignTierSplit = (
  target: Map<number, ResourceAutomationPercentages>,
  resourcesInTier: ResourcesIds[],
  weights: number[],
) => {
  resourcesInTier.forEach((resourceId, index) => {
    const weight = clampPercent(weights[index] ?? 0);
    target.set(resourceId, {
      resourceToResource: weight,
    });
  });
};

const assignMarketDonkeyAllocation = (
  target: Map<number, ResourceAutomationPercentages>,
  presentSet: Set<ResourcesIds>,
) => {
  if (!presentSet.has(ResourcesIds.Donkey)) return;

  target.set(ResourcesIds.Donkey, {
    resourceToResource: SMART_MARKET_DONKEY_RESOURCE_PERCENT,
  });
};

const buildSmartPresetAllocations = (
  resources: ResourcesIds[],
): Map<number, ResourceAutomationPercentages> => {
  const allocations = new Map<number, ResourceAutomationPercentages>();
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
      // Start each available tier-1 building at 5%. Blitz uses resource recipes only.
      assignTierSplit(
        allocations,
        presentT1,
        presentT1.map(() => 5),
      );
    } else if (!hasHigherResources) {
      // Complete T1 only: 30% each on resource slider.
      assignTierSplit(allocations, SMART_T1_RESOURCES, [30, 30, 30]);
    } else {
      // Complete T1 with army and/or higher tiers: 20% wood, 20% coal, 30% copper on resource slider.
      const orderedT1 = [ResourcesIds.Wood, ResourcesIds.Coal, ResourcesIds.Copper];
      assignTierSplit(
        allocations,
        orderedT1.filter((id) => presentSet.has(id)),
        [20, 20, 30],

      );
    }
  }

  if (t1Complete && presentT2.length > 0) {
    const weights = buildSequentialWeights(presentT2.length, [10, 5, 3]);
    assignTierSplit(
      allocations,
      SMART_T2_RESOURCES.filter((id) => presentSet.has(id)),
      weights,

    );
  }

  if (t1Complete && presentT3.length > 0) {
    const weights = buildSequentialWeights(presentT3.length, [10, 5, 3]);
    assignTierSplit(
      allocations,
      SMART_T3_RESOURCES.filter((id) => presentSet.has(id)),
      weights,

    );
  }

  // Army allocations (resource slider)
  if (presentArmyT3.length > 0) {
    assignTierSplit(allocations, presentArmyT3, buildSequentialWeights(presentArmyT3.length, [50, 25, 15]));
    if (presentArmyT2.length > 0) {
      assignTierSplit(
        allocations,
        presentArmyT2,
        buildSequentialWeights(presentArmyT2.length, [30, 15, 10]),

      );
    }
    if (presentArmyT1.length > 0) {
      assignTierSplit(allocations, presentArmyT1, buildSequentialWeights(presentArmyT1.length, [10, 5, 3]));
    }
  } else if (presentArmyT2.length > 0) {
    assignTierSplit(allocations, presentArmyT2, buildSequentialWeights(presentArmyT2.length, [30, 15, 10]));
    if (presentArmyT1.length > 0) {
      assignTierSplit(allocations, presentArmyT1, buildSequentialWeights(presentArmyT1.length, [10, 5, 3]));
    }
  } else if (presentArmyT1.length > 0) {
    assignTierSplit(allocations, presentArmyT1, buildSequentialWeights(presentArmyT1.length, [30, 20, 10]));
  }

  assignMarketDonkeyAllocation(allocations, presentSet);

  // Ensure every resource has an entry, defaulting to zero.
  resources.forEach((resourceId) => {
    if (!allocations.has(resourceId)) {
      allocations.set(resourceId, { resourceToResource: 0 });
    }
  });

  return allocations;
};

export const calculatePresetAllocations = (
  resourceIds: ResourcesIds[],
  presetId: RealmPresetId,
): Map<number, ResourceAutomationPercentages> => {
  const allocations = new Map<number, ResourceAutomationPercentages>();

  const scopedIds = Array.from(new Set(resourceIds)).filter((resourceId) => !isAutomationResourceBlocked(resourceId));

  if (!scopedIds.length) {
    return allocations;
  }

  if (presetId === "idle") {
    scopedIds.forEach((resourceId) => {
      allocations.set(resourceId, { resourceToResource: 0 });
    });
    return allocations;
  }

  if (presetId === "smart") {
    const smartAllocations = buildSmartPresetAllocations(scopedIds);
    scopedIds.forEach((resourceId) => {
      const next = smartAllocations.get(resourceId) ?? { resourceToResource: 0 };
      allocations.set(resourceId, resolveProductionPercentages(next));
    });
    return allocations;
  }

  // Custom allocations are resolved from stored percentages elsewhere.
  return allocations;
};

export const getAutomationOverallocation = (
  percentagesByResource: Record<number, ResourceAutomationPercentages> | undefined,
): { resourceOver: boolean } => {
  if (!percentagesByResource) {
    return { resourceOver: false };
  }

  const resourceTotals = new Map<number, number>();

  Object.entries(percentagesByResource).forEach(([key, stored]) => {
    const resourceId = Number(key) as ResourcesIds;
    // Stored settings persist across games; a resource this game cannot produce allocates nothing.
    if (isAutomationResourceBlocked(resourceId) || !configManager.producibleResources().includes(resourceId)) {
      return;
    }
    const percentages = stored;
    const rawComplexInputs = configManager.requireRecipeInputs(resourceId, false);
    const complexInputs = rawComplexInputs.filter(
      (input: { resource: ResourcesIds }) => input.resource !== ResourcesIds.Wheat,
    );


    if ((percentages?.resourceToResource ?? 0) > 0) {
      complexInputs.forEach(({ resource }: { resource: ResourcesIds }) => {
        resourceTotals.set(resource, (resourceTotals.get(resource) ?? 0) + (percentages?.resourceToResource ?? 0));
      });
    }


  });

  let resourceOver = false;

  resourceTotals.forEach((value) => {
    if (value > MAX_RESOURCE_ALLOCATION_PERCENT) {
      resourceOver = true;
    }
  });


  return { resourceOver };
};

export const inferRealmPreset = (automation?: RealmAutomationConfig): RealmPresetId => {
  // Default to smart when nothing has been configured yet.
  if (!automation) return "smart";
  if (automation.presetId) {
    return automation.presetId as RealmPresetId;
  }

  return "smart";
};
