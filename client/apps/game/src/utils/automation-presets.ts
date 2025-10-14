import {
  MAX_RESOURCE_ALLOCATION_PERCENT,
  RealmAutomationConfig,
  ResourceAutomationSettings,
  isAutomationResourceBlocked,
} from "@/hooks/store/use-automation-store";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";

export type RealmPresetId = "labor" | "resource" | "idle" | "custom";

export const REALM_PRESETS: { id: RealmPresetId; label: string; description?: string }[] = [
  { id: "labor", label: "Labor", description: "Allocate 10% labor, skip resource burn." },
  { id: "resource", label: "Resource", description: "Distribute resource burn up to 90%." },
  { id: "custom", label: "Custom", description: "Manually tuned mix of labor/resource." },
  { id: "idle", label: "Idle", description: "Pause automation (0%)." },
];

const computeUsageTotals = (
  resources: Record<number, ResourceAutomationSettings>,
  entityType: "realm" | "village",
): Map<number, number> => {
  const totals = new Map<number, number>();

  Object.values(resources).forEach((setting) => {
    const { resourceId, percentages } = setting;
    if (isAutomationResourceBlocked(resourceId, entityType)) return;

    const complexInputs = (configManager.complexSystemResourceInputs[resourceId] ?? []).filter(
      (input) => !isAutomationResourceBlocked(input.resource, entityType, "input"),
    );
    const simpleInputs = (configManager.simpleSystemResourceInputs[resourceId] ?? []).filter(
      (input) => !isAutomationResourceBlocked(input.resource, entityType, "input"),
    );

    if (percentages.resourceToResource > 0) {
      complexInputs.forEach(({ resource }) => {
        totals.set(resource, (totals.get(resource) ?? 0) + percentages.resourceToResource);
      });
    }

    if (percentages.laborToResource > 0) {
      simpleInputs.forEach(({ resource }) => {
        totals.set(resource, (totals.get(resource) ?? 0) + percentages.laborToResource);
      });
    }
  });

  return totals;
};

const adjustContribution = (
  totals: Map<number, number>,
  amount: number,
  inputs: { resource: ResourcesIds }[],
  direction: "add" | "remove",
  entityType: "realm" | "village",
) => {
  if (amount <= 0) return;
  inputs.forEach(({ resource }) => {
    if (isAutomationResourceBlocked(resource, entityType, "input")) return;
    const current = totals.get(resource) ?? 0;
    const next = direction === "add" ? current + amount : Math.max(0, current - amount);
    totals.set(resource, Math.min(MAX_RESOURCE_ALLOCATION_PERCENT, next));
  });
};

const determineComplexShare = (
  complexInputs: { resource: ResourcesIds }[],
  usageTotals: Map<number, number>,
  usageCounts: Map<ResourcesIds, number>,
  presetTarget: number,
  entityType: "realm" | "village",
): number => {
  if (!complexInputs.length || presetTarget <= 0) return 0;

  let share = presetTarget;
  complexInputs.forEach(({ resource }) => {
    if (isAutomationResourceBlocked(resource, entityType, "input")) return;
    const count = usageCounts.get(resource) ?? 1;
    const maxPerResource = Math.floor(MAX_RESOURCE_ALLOCATION_PERCENT / count);
    const headroom = MAX_RESOURCE_ALLOCATION_PERCENT - (usageTotals.get(resource) ?? 0);
    share = Math.max(0, Math.min(share, maxPerResource, headroom));
  });

  return share;
};

const determineLaborShare = (
  simpleInputs: { resource: ResourcesIds }[],
  usageTotals: Map<number, number>,
  presetTarget: number,
  entityType: "realm" | "village",
): number => {
  if (presetTarget <= 0) return 0;
  if (!simpleInputs.length) return presetTarget;

  let share = presetTarget;
  simpleInputs.forEach(({ resource }) => {
    if (isAutomationResourceBlocked(resource, entityType, "input")) return;
    const headroom = MAX_RESOURCE_ALLOCATION_PERCENT - (usageTotals.get(resource) ?? 0);
    share = Math.max(0, Math.min(share, headroom));
  });

  return share;
};

export const calculatePresetAllocations = (
  automation: RealmAutomationConfig | undefined,
  presetId: RealmPresetId,
): Map<number, { resourceToResource: number; laborToResource: number }> => {
  const allocations = new Map<number, { resourceToResource: number; laborToResource: number }>();

  if (!automation) {
    return allocations;
  }

  const entityType = automation.entityType ?? "realm";

  const resources = Object.values(automation.resources ?? {}).filter(
    (setting) => !isAutomationResourceBlocked(setting.resourceId, entityType),
  );

  if (!resources.length) {
    return allocations;
  }

  if (presetId === "idle") {
    resources.forEach((setting) => {
      allocations.set(setting.resourceId, { resourceToResource: 0, laborToResource: 0 });
    });
    return allocations;
  }

  const usageTotals = computeUsageTotals(automation.resources ?? {}, entityType);
  const complexUsageCounts = new Map<ResourcesIds, number>();

  resources.forEach((setting) => {
    const rawComplexInputs = configManager.complexSystemResourceInputs[setting.resourceId] ?? [];
    rawComplexInputs
      .filter((input) => !isAutomationResourceBlocked(input.resource, entityType, "input"))
      .forEach(({ resource }) => {
        complexUsageCounts.set(resource, (complexUsageCounts.get(resource) ?? 0) + 1);
      });
  });

  resources.forEach((setting) => {
    const { resourceId, percentages } = setting;
    const rawComplexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
    const complexInputs = rawComplexInputs.filter((input) => !isAutomationResourceBlocked(input.resource, entityType, "input"));
    const rawSimpleInputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];
    const simpleInputs = rawSimpleInputs.filter((input) => !isAutomationResourceBlocked(input.resource, entityType, "input"));

    if (percentages.resourceToResource > 0) {
      adjustContribution(usageTotals, percentages.resourceToResource, complexInputs, "remove", entityType);
    }
    if (percentages.laborToResource > 0) {
      adjustContribution(usageTotals, percentages.laborToResource, simpleInputs, "remove", entityType);
    }
  });

  resources.forEach((setting) => {
    const { resourceId } = setting;
    const rawComplexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
    const complexInputs = rawComplexInputs.filter((input) => !isAutomationResourceBlocked(input.resource, entityType, "input"));
    const rawSimpleInputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];
    const simpleInputs = rawSimpleInputs.filter((input) => !isAutomationResourceBlocked(input.resource, entityType, "input"));

    const hasComplex = rawComplexInputs.length > 0;
    const hasSimple = rawSimpleInputs.length > 0;

    let targetResourceToResource = 0;
    let targetLaborToResource = 0;

    switch (presetId) {
      case "labor":
        targetLaborToResource = hasSimple ? 10 : 0;
        break;
      case "resource":
        targetResourceToResource = hasComplex ? 90 : 0;
        break;
      case "custom":
        targetLaborToResource = hasSimple ? 5 : 0;
        targetResourceToResource = hasComplex ? 90 : 0;
        break;
      default:
        break;
    }

    if (targetResourceToResource > 0 && hasComplex) {
      targetResourceToResource = determineComplexShare(
        complexInputs,
        usageTotals,
        complexUsageCounts,
        targetResourceToResource,
        entityType,
      );
    }

    if (targetLaborToResource > 0 && hasSimple) {
      targetLaborToResource = determineLaborShare(simpleInputs, usageTotals, targetLaborToResource, entityType);
    }

    adjustContribution(usageTotals, targetResourceToResource, complexInputs, "add", entityType);
    adjustContribution(usageTotals, targetLaborToResource, simpleInputs, "add", entityType);

    allocations.set(resourceId, {
      resourceToResource: targetResourceToResource,
      laborToResource: targetLaborToResource,
    });
  });

  return allocations;
};

export const inferRealmPreset = (automation?: RealmAutomationConfig): RealmPresetId => {
  // If no automation context yet, default to labor since
  // the processor uses a 10% labor baseline for unconfigured resources.
  if (!automation) return "labor";
  if (automation.presetId && automation.presetId !== "custom") {
    return automation.presetId as RealmPresetId;
  }

  const entityType = automation.entityType ?? "realm";
  const resources = Object.values(automation.resources ?? {}).filter(
    (setting) => !isAutomationResourceBlocked(setting.resourceId, entityType),
  );

  if (!resources.length) {
    return "labor";
  }

  const hasResourceShare = resources.some((setting) => (setting.percentages.resourceToResource ?? 0) > 0);
  const hasLaborShare = resources.some((setting) => (setting.percentages.laborToResource ?? 0) > 0);

  if (!hasResourceShare && !hasLaborShare) return "labor";
  if (!hasResourceShare && hasLaborShare) return "labor";
  if (hasResourceShare && !hasLaborShare) return "resource";
  // Any mix of labor + resource is considered custom
  if (hasResourceShare && hasLaborShare) return "custom";

  return "custom";
};
