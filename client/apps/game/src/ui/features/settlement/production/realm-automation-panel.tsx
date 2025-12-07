import {
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  ResourceAutomationPercentages,
  ResourceAutomationSettings,
  isAutomationResourceBlocked,
  useAutomationStore,
} from "@/hooks/store/use-automation-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import Button from "@/ui/design-system/atoms/button";
import { configManager, getBlockTimestamp, ResourceManager } from "@bibliothecadao/eternum";
import {
  buildRealmResourceSnapshot,
  type RealmResourceSnapshot,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import { ResourcesIds } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { REALM_PRESETS, RealmPresetId, calculatePresetAllocations, inferRealmPreset } from "@/utils/automation-presets";

type RealmAutomationPanelProps = {
  realmEntityId: string;
  realmName?: string;
  producedResources: ResourcesIds[];
  entityType?: "realm" | "village";
};

const sliderStep = 1;
const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > MAX_RESOURCE_ALLOCATION_PERCENT) return MAX_RESOURCE_ALLOCATION_PERCENT;
  return Math.round(value);
};
const ARMY_T2_T3_RESOURCES = new Set<ResourcesIds>([
  ResourcesIds.KnightT2,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.PaladinT2,
  ResourcesIds.KnightT3,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.PaladinT3,
]);

const formatPerCycle = (value: number): string => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return "0/c";
  const abs = Math.abs(value);
  const label =
    abs >= 1000
      ? Math.round(abs).toLocaleString()
      : abs >= 100
        ? abs.toFixed(0)
        : abs >= 10
          ? abs.toFixed(1)
          : abs >= 1
            ? abs.toFixed(2)
            : abs.toFixed(3);
  const sign = value > 0 ? "+" : "-";
  return `${sign}${label}/c`;
};

const resolveResourceLabel = (resourceId: number): string => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

const uniqueResources = (resources: ResourcesIds[]): ResourcesIds[] => {
  const list = Array.from(new Set(resources));
  return list.sort((a, b) => {
    if (a === ResourcesIds.Wheat && b !== ResourcesIds.Wheat) return -1;
    if (b === ResourcesIds.Wheat && a !== ResourcesIds.Wheat) return 1;
    return a - b;
  });
};

const gatherImpactedResources = (resourceIds: number[]): number[] => {
  return Array.from(new Set(resourceIds));
};

export const RealmAutomationPanel = ({
  realmEntityId,
  realmName,
  producedResources,
  entityType = "realm",
}: RealmAutomationPanelProps) => {
  const {
    setup: { components },
  } = useDojo();
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const setRealmPreset = useAutomationStore((state) => state.setRealmPreset);
  const setRealmPresetConfig = useAutomationStore((state) => state.setRealmPresetConfig);
  const setResourcePercentages = useAutomationStore((state) => state.setResourcePercentages);
  const ensureResourceConfig = useAutomationStore((state) => state.ensureResourceConfig);
  const removeResourceConfig = useAutomationStore((state) => state.removeResourceConfig);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const realmAutomation = useAutomationStore((state) => state.realms[realmEntityId]);

  type Snapshot = {
    presetId: RealmPresetId;
    percentages: Record<number, ResourceAutomationPercentages>;
  };

  const [draftPercentages, setDraftPercentages] = useState<Record<number, ResourceAutomationPercentages>>({});
  const [draftPresetId, setDraftPresetId] = useState<RealmPresetId | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<Snapshot | null>(null);

  const realmResources = useMemo(
    () =>
      uniqueResources(producedResources.filter((resourceId) => !isAutomationResourceBlocked(resourceId, entityType))),
    [entityType, producedResources],
  );

  useEffect(() => {
    if (!hydrated) return;
    const current = useAutomationStore.getState().realms[realmEntityId];
    const needsMetadataUpdate = current && (current.realmName !== realmName || current.entityType !== entityType);

    if (!current || needsMetadataUpdate) {
      upsertRealm(realmEntityId, { realmName, entityType });
    }
  }, [entityType, realmEntityId, realmName, upsertRealm, hydrated]);

  const missingResources = useMemo(() => {
    if (!realmAutomation) return realmResources;
    return realmResources.filter((resourceId) => !realmAutomation.resources?.[resourceId]);
  }, [realmAutomation, realmResources]);

  useEffect(() => {
    if (!hydrated) return;
    if (!missingResources.length) return;
    missingResources.forEach((resourceId) => ensureResourceConfig(realmEntityId, resourceId));
  }, [ensureResourceConfig, missingResources, realmEntityId, hydrated]);

  const realmSnapshot: RealmResourceSnapshot | null = useMemo(() => {
    const numericRealmId = Number(realmEntityId);
    if (!components || !Number.isFinite(numericRealmId) || numericRealmId <= 0) {
      return null;
    }
    const { currentDefaultTick } = getBlockTimestamp();
    return buildRealmResourceSnapshot({
      components,
      realmId: numericRealmId,
      currentTick: currentDefaultTick,
    });
  }, [components, realmEntityId]);

  const createBaselinePercentages = useCallback((resourceId: ResourcesIds): ResourceAutomationPercentages => {
    if (resourceId === ResourcesIds.Donkey) {
      return { resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT, laborToResource: 0 };
    }
    return {
      resourceToResource: DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.resourceToResource,
      laborToResource: DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.laborToResource,
    };
  }, []);

  const resolveDraftPercentages = useCallback(
    (resourceId: ResourcesIds): ResourceAutomationPercentages => {
      const fromDraft = draftPercentages[resourceId];
      if (fromDraft) {
        return fromDraft;
      }

      const fromStore = realmAutomation?.resources?.[resourceId]?.percentages;
      if (fromStore) {
        return { ...fromStore };
      }

      return createBaselinePercentages(resourceId);
    },
    [draftPercentages, realmAutomation, createBaselinePercentages],
  );

  const hasLocalChanges = useMemo(() => {
    if (!lastSavedSnapshot) {
      return false;
    }

    const savedPreset = lastSavedSnapshot.presetId;
    const targetPreset = draftPresetId ?? savedPreset;
    if (targetPreset !== savedPreset) {
      return true;
    }

    const resourceIds = new Set<number>([
      ...Object.keys(lastSavedSnapshot.percentages).map(Number),
      ...Object.keys(draftPercentages).map(Number),
    ]);

    for (const id of resourceIds) {
      const resourceId = Number(id) as ResourcesIds;
      const saved = lastSavedSnapshot.percentages[resourceId] ?? createBaselinePercentages(resourceId);
      const current = draftPercentages[resourceId] ?? createBaselinePercentages(resourceId);
      if (
        saved.resourceToResource !== current.resourceToResource ||
        saved.laborToResource !== current.laborToResource
      ) {
        return true;
      }
    }

    return false;
  }, [draftPercentages, draftPresetId, lastSavedSnapshot, createBaselinePercentages]);

  useEffect(() => {
    if (!hydrated) return;
    if (!realmAutomation) return;
    if (hasLocalChanges) {
      // Avoid clobbering slider edits while automation updates the store in the background.
      return;
    }

    const snapshotPercentages: Record<number, ResourceAutomationPercentages> = {};
    const existingResources = realmAutomation.resources ?? {};

    Object.entries(existingResources).forEach(([key, settings]) => {
      if (!settings) return;
      const resourceId = Number(key) as ResourcesIds;
      snapshotPercentages[resourceId] = { ...settings.percentages };
    });

    realmResources.forEach((resourceId) => {
      if (!snapshotPercentages[resourceId]) {
        snapshotPercentages[resourceId] = createBaselinePercentages(resourceId);
      }
    });

    const snapshot: Snapshot = {
      presetId: realmAutomation.presetId,
      percentages: snapshotPercentages,
    };

    setLastSavedSnapshot(snapshot);
    setDraftPercentages(snapshotPercentages);
    setDraftPresetId(snapshot.presetId);
  }, [realmAutomation, realmResources, createBaselinePercentages, hydrated, hasLocalChanges]);

  const draftAutomation = useMemo(() => {
    if (!realmAutomation) return undefined;

    const resources: Record<number, ResourceAutomationSettings> = {};
    Object.entries(realmAutomation.resources ?? {}).forEach(([key, settings]) => {
      if (!settings) return;
      const resourceId = Number(key) as ResourcesIds;
      resources[resourceId] = {
        ...settings,
        percentages: draftPercentages[resourceId] ?? { ...settings.percentages },
      };
    });

    realmResources.forEach((resourceId) => {
      if (!resources[resourceId]) {
        resources[resourceId] = {
          resourceId,
          autoManaged: true,
          label: undefined,
          updatedAt: realmAutomation.updatedAt,
          percentages: draftPercentages[resourceId] ?? createBaselinePercentages(resourceId),
        };
      }
    });

    return {
      ...realmAutomation,
      resources,
      presetId: draftPresetId ?? realmAutomation.presetId,
    };
  }, [realmAutomation, draftPercentages, draftPresetId, realmResources, createBaselinePercentages]);

  const automationRows = useMemo(() => {
    return realmResources.map((resourceId) => {
      const percentages = resolveDraftPercentages(resourceId);
      const complexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
      const simpleInputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];

      return {
        resourceId,
        percentages,
        complexInputs,
        simpleInputs,
      };
    });
  }, [realmResources, resolveDraftPercentages]);

  const aggregatedUsageMap = useMemo(() => {
    const totals = new Map<number, number>();
    const effectiveEntityType = realmAutomation?.entityType ?? entityType;

    automationRows.forEach((row) => {
      const { resourceId, percentages, complexInputs, simpleInputs } = row;

      if (percentages.resourceToResource > 0) {
        complexInputs.forEach((input) => {
          if (input.resource === ResourcesIds.Wheat) return;
          if (isAutomationResourceBlocked(input.resource, effectiveEntityType, "input")) return;
          totals.set(input.resource, (totals.get(input.resource) ?? 0) + percentages.resourceToResource);
        });
      }

      if (percentages.laborToResource > 0) {
        simpleInputs.forEach((input) => {
          if (input.resource === ResourcesIds.Wheat) return;
          if (isAutomationResourceBlocked(input.resource, effectiveEntityType, "input")) return;
          totals.set(input.resource, (totals.get(input.resource) ?? 0) + percentages.laborToResource);
        });
      }
    });

    return totals;
  }, [automationRows, entityType, realmAutomation]);

  const aggregatedUsageList = useMemo(() => {
    return Array.from(aggregatedUsageMap.entries())
      .filter(([resourceId]) => resourceId !== ResourcesIds.Wheat)
      .map(([resourceId, percent]) => ({ resourceId, percent }))
      .sort((a, b) => a.resourceId - b.resourceId);
  }, [aggregatedUsageMap]);

  const aggregatedUsageRecord = useMemo(() => {
    const record: Record<number, number> = {};
    aggregatedUsageMap.forEach((value, key) => {
      if (key === ResourcesIds.Wheat) return;
      record[key] = value;
    });
    return record;
  }, [aggregatedUsageMap]);

  const aggregatedConsumptionMap = useMemo(() => {
    const totals = new Map<number, number>();

    automationRows.forEach(({ percentages, complexInputs, simpleInputs }) => {
      const resourceRatio = Math.min(1, Math.max(0, percentages.resourceToResource / MAX_RESOURCE_ALLOCATION_PERCENT));
      const laborRatio = Math.min(1, Math.max(0, percentages.laborToResource / MAX_RESOURCE_ALLOCATION_PERCENT));

      if (resourceRatio > 0) {
        complexInputs.forEach((input) => {
          totals.set(input.resource, (totals.get(input.resource) ?? 0) + resourceRatio * input.amount);
        });
      }

      if (laborRatio > 0) {
        simpleInputs.forEach((input) => {
          totals.set(input.resource, (totals.get(input.resource) ?? 0) + laborRatio * input.amount);
        });
      }
    });

    return totals;
  }, [automationRows]);

  const aggregatedProductionMap = useMemo(() => {
    const totals = new Map<number, number>();

    automationRows.forEach(({ resourceId, percentages }) => {
      const resourceRatio = Math.min(1, Math.max(0, percentages.resourceToResource / MAX_RESOURCE_ALLOCATION_PERCENT));
      const laborRatio = Math.min(1, Math.max(0, percentages.laborToResource / MAX_RESOURCE_ALLOCATION_PERCENT));

      if (resourceRatio > 0) {
        const complexOutput = configManager.complexSystemResourceOutput[resourceId]?.amount ?? 0;
        if (complexOutput > 0) {
          totals.set(resourceId, (totals.get(resourceId) ?? 0) + resourceRatio * complexOutput);
        }
      }

      if (laborRatio > 0) {
        const simpleOutput = configManager.simpleSystemResourceOutput[resourceId]?.amount ?? 0;
        if (simpleOutput > 0) {
          totals.set(resourceId, (totals.get(resourceId) ?? 0) + laborRatio * simpleOutput);
        }
      }
    });

    return totals;
  }, [automationRows]);

  const usageDisplayList = useMemo(() => {
    const resourceIds = new Set<number>([
      ...aggregatedUsageMap.keys(),
      ...aggregatedConsumptionMap.keys(),
      ...aggregatedProductionMap.keys(),
    ]);

    return Array.from(resourceIds)
      .map((resourceId) => {
        const producedPerCycle = aggregatedProductionMap.get(resourceId) ?? 0;
        const consumedPerCycle = aggregatedConsumptionMap.get(resourceId) ?? 0;
        return {
          resourceId,
          percent: aggregatedUsageMap.get(resourceId) ?? 0,
          perCycle: producedPerCycle - consumedPerCycle,
        };
      })
      .sort((a, b) => a.resourceId - b.resourceId);
  }, [aggregatedUsageMap, aggregatedConsumptionMap, aggregatedProductionMap]);

  const activePresetId = useMemo(
    () => inferRealmPreset(draftAutomation ?? realmAutomation),
    [draftAutomation, realmAutomation],
  );

  const overallocatedEntries = useMemo(
    () => aggregatedUsageList.filter(({ percent }) => percent > MAX_RESOURCE_ALLOCATION_PERCENT),
    [aggregatedUsageList],
  );
  const isOverallocated = overallocatedEntries.length > 0;
  const overallocatedLabels = useMemo(
    () => overallocatedEntries.map(({ resourceId }) => resolveResourceLabel(resourceId)),
    [overallocatedEntries],
  );

  const handlePresetSelect = useCallback(
    (presetId: RealmPresetId) => {
      if (!draftAutomation) return;

      // Limit preset calculation to resources actually produced in this realm.
      const limitedResources: Record<number, ResourceAutomationSettings> = {};
      realmResources.forEach((resourceId) => {
        const existing = draftAutomation.resources[resourceId];
        if (existing) {
          limitedResources[resourceId] = existing;
        } else {
          limitedResources[resourceId] = {
            resourceId,
            autoManaged: true,
            label: undefined,
            updatedAt: draftAutomation.updatedAt,
            percentages: draftPercentages[resourceId] ?? createBaselinePercentages(resourceId),
          };
        }
      });

      const limitedAutomation: typeof draftAutomation = {
        ...draftAutomation,
        resources: limitedResources,
      };

      const allocations = calculatePresetAllocations(limitedAutomation, presetId);

      if (allocations.size === 0 && presetId !== "idle") {
        setDraftPresetId(presetId);
        return;
      }

      setDraftPercentages((prev) => {
        const updated: Record<number, ResourceAutomationPercentages> = { ...prev };
        realmResources.forEach((resourceId) => {
          if (presetId === "idle") {
            updated[resourceId] = { resourceToResource: 0, laborToResource: 0 };
            return;
          }
          const allocation = allocations.get(resourceId);
          if (allocation) {
            updated[resourceId] = { ...allocation };
          } else {
            updated[resourceId] = { resourceToResource: 0, laborToResource: 0 };
          }
        });

        return updated;
      });

      setDraftPresetId(presetId);
    },
    [draftAutomation, realmResources, realmEntityId, entityType],
  );

  const handleSliderChange = useCallback(
    (resourceId: ResourcesIds, key: "resourceToResource" | "laborToResource", value: number) => {
      setDraftPercentages((prev) => {
        const existing =
          prev[resourceId] ??
          (realmAutomation?.resources?.[resourceId]?.percentages
            ? { ...realmAutomation.resources[resourceId].percentages }
            : createBaselinePercentages(resourceId));
        const next: ResourceAutomationPercentages = {
          resourceToResource: key === "resourceToResource" ? value : existing.resourceToResource,
          laborToResource: key === "laborToResource" ? value : existing.laborToResource,
        };
        return {
          ...prev,
          [resourceId]: next,
        };
      });
      setDraftPresetId("custom");
    },
    [realmAutomation, createBaselinePercentages],
  );

  const handleUndo = useCallback(() => {
    if (!lastSavedSnapshot) return;
    const restored: Record<number, ResourceAutomationPercentages> = {};
    Object.entries(lastSavedSnapshot.percentages).forEach(([key, value]) => {
      restored[Number(key)] = { ...value };
    });
    setDraftPercentages(restored);
    setDraftPresetId(lastSavedSnapshot.presetId);
  }, [lastSavedSnapshot]);

  const handleSave = useCallback(() => {
    if (!realmAutomation || !hasLocalChanges) return;

    const snapshot = lastSavedSnapshot ?? {
      presetId: realmAutomation.presetId,
      percentages: Object.entries(realmAutomation.resources ?? {}).reduce(
        (acc, [key, settings]) => {
          if (!settings) return acc;
          acc[Number(key)] = { ...settings.percentages };
          return acc;
        },
        {} as Record<number, ResourceAutomationPercentages>,
      ),
    };

    const resourceIds = new Set<number>([
      ...Object.keys(snapshot.percentages).map(Number),
      ...Object.keys(draftPercentages).map(Number),
    ]);

    if (draftPresetId && draftPresetId !== "custom") {
      // For preset saves, only persist percentages for resources actually produced in this realm.
      const normalizedPercentages: Record<number, ResourceAutomationPercentages> = {};
      realmResources.forEach((resourceId) => {
        const source =
          draftPercentages[resourceId] ?? snapshot.percentages[resourceId] ?? createBaselinePercentages(resourceId);
        normalizedPercentages[resourceId] = {
          resourceToResource: source.resourceToResource,
          laborToResource: source.laborToResource,
        };
      });

      setRealmPresetConfig(realmEntityId, draftPresetId, normalizedPercentages);
      setLastSavedSnapshot({
        presetId: draftPresetId,
        percentages: normalizedPercentages,
      });
      setDraftPercentages(normalizedPercentages);
      setDraftPresetId(draftPresetId);
      return;
    }

    const allResources = new Set<number>([
      ...resourceIds,
      ...realmResources.map((resourceId) => Number(resourceId)),
      ...Object.keys(realmAutomation.resources ?? {}).map(Number),
    ]);

    const normalizedPercentages: Record<number, ResourceAutomationPercentages> = {};
    allResources.forEach((id) => {
      const resourceId = Number(id) as ResourcesIds;
      const source =
        draftPercentages[resourceId] ?? snapshot.percentages[resourceId] ?? createBaselinePercentages(resourceId);
      normalizedPercentages[resourceId] = {
        resourceToResource: source.resourceToResource,
        laborToResource: source.laborToResource,
      };
    });

    resourceIds.forEach((id) => {
      const resourceId = Number(id) as ResourcesIds;
      const next = draftPercentages[resourceId] ?? createBaselinePercentages(resourceId);
      const prevSnapshot = snapshot.percentages[resourceId] ?? createBaselinePercentages(resourceId);
      if (
        next.resourceToResource !== prevSnapshot.resourceToResource ||
        next.laborToResource !== prevSnapshot.laborToResource
      ) {
        setResourcePercentages(realmEntityId, resourceId, next);
      }
    });

    setLastSavedSnapshot({
      presetId: "custom",
      percentages: normalizedPercentages,
    });
    setDraftPercentages(normalizedPercentages);
    setDraftPresetId("custom");
  }, [
    realmAutomation,
    hasLocalChanges,
    lastSavedSnapshot,
    draftPercentages,
    draftPresetId,
    createBaselinePercentages,
    setRealmPresetConfig,
    realmEntityId,
    setResourcePercentages,
    realmResources,
  ]);

  if (!automationRows.length) {
    return (
      <div className="panel-wood p-4 rounded-lg text-sm text-gold/70">
        This realm has no active production buildings yet. Create production structures to configure automation.
      </div>
    );
  }

  return (
    <div className="panel-wood p-4 rounded-lg space-y-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gold">Production Automation</h4>
            <p className="text-xs text-gold/60">Adjust sliders or apply a preset, then save to commit your changes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={hasLocalChanges ? "gold" : "outline"}
              size="xs"
              onClick={handleSave}
              disabled={!hasLocalChanges || isOverallocated}
              isPulsing={hasLocalChanges && !isOverallocated}
              title={isOverallocated ? "Resolve over-allocation before saving changes." : undefined}
            >
              Save Changes
            </Button>
            <Button variant="outline" size="xs" onClick={handleUndo} disabled={!hasLocalChanges}>
              Undo
            </Button>
          </div>
        </div>
        {isOverallocated && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger/80">
            Resolve over-allocation for {overallocatedLabels.join(", ")} before saving.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {REALM_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={clsx(
                  "px-3 py-1 rounded border text-xs transition-colors",
                  isActive
                    ? "border-gold text-gold bg-gold/10"
                    : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold",
                )}
                title={preset.description}
                onClick={() => handlePresetSelect(preset.id)}
              >
                {preset.label}
              </button>
            );
          })}
          {REALM_PRESETS.filter((preset) => preset.id === "custom").map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled
                className={clsx(
                  "px-3 py-1 rounded border text-xs transition-colors cursor-not-allowed",
                  isActive ? "border-gold text-gold bg-gold/10" : "border-gold/15 text-gold/40",
                )}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {hasLocalChanges && (
          <span className="text-[11px] text-warning">Unsaved changes pending. Save to apply automation updates.</span>
        )}
      </header>

      <section className="space-y-2">
        <h5 className="text-sm font-semibold text-gold">Resource Usage</h5>
        {usageDisplayList.length === 0 ? (
          <p className="text-xs text-gold/60">No resources allocated yet.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {usageDisplayList.map(({ resourceId, percent, perCycle }) => {
              const label = resolveResourceLabel(resourceId);
              const isOverBudget = percent > MAX_RESOURCE_ALLOCATION_PERCENT;
              const perCycleLabel = formatPerCycle(perCycle);
              return (
                <li
                  key={`usage-${resourceId}`}
                  className={clsx(
                    "flex items-center gap-2 rounded border px-3 py-2 text-xs",
                    isOverBudget ? "border-danger/60 text-danger" : "border-gold/20 text-gold/80",
                  )}
                >
                  <ResourceIcon resource={ResourcesIds[resourceId as ResourcesIds]} size="xs" />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span>{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gold/50">{perCycleLabel}</span>
                      <span className="text-gold/40">•</span>
                      <span className="font-semibold text-gold">{Math.round(percent)}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-4 gap-3">
        {automationRows.map(({ resourceId, percentages, complexInputs, simpleInputs }) => {
          const label = resolveResourceLabel(resourceId);
          const complexImpacted = gatherImpactedResources(complexInputs.map((input) => input.resource));
          const simpleImpacted = gatherImpactedResources(simpleInputs.map((input) => input.resource));
          const resourceUsage = aggregatedUsageRecord[resourceId] ?? 0;
          const resourceOverBudget = resourceUsage > MAX_RESOURCE_ALLOCATION_PERCENT;

          const renderSlider = (
            sliderLabel: string,
            value: number,
            onChange: (next: number) => void,
            impactedResources: number[],
          ) => {
            const impactedTotals = impactedResources.map((id) => aggregatedUsageRecord[id] ?? 0);
            const overBudgetResources = impactedResources.filter(
              (id) => (aggregatedUsageRecord[id] ?? 0) > MAX_RESOURCE_ALLOCATION_PERCENT,
            );
            const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
              const next = clampPercent(Number(event.target.value));
              onChange(next);
            };

            return (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gold/80">
                  <span>{sliderLabel}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={MAX_RESOURCE_ALLOCATION_PERCENT}
                      step={sliderStep}
                      value={value}
                      onChange={handleInputChange}
                      className="w-16 rounded border border-gold/30 bg-black/40 px-2 py-1 text-right text-xs text-gold focus:border-gold/60 focus:outline-none"
                    />
                    <span className="font-semibold text-gold">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_RESOURCE_ALLOCATION_PERCENT}
                  step={sliderStep}
                  value={value}
                  onChange={(event) => onChange(Number(event.target.value))}
                  className="w-full accent-gold/80 bg-dark-wood"
                />
                {impactedResources.length > 0 && (
                  <div className="space-y-1 text-xxs text-gold/60">
                    <span className="font-semibold uppercase tracking-wide text-gold/50">Inputs</span>
                    <div className="grid grid-cols-4 gap-1">
                      {impactedResources.map((impacted) => (
                        <div
                          key={`impact-${resourceId}-${impacted}`}
                          className="flex items-center justify-center rounded border border-gold/20 bg-black/10 p-2"
                          title={resolveResourceLabel(impacted)}
                        >
                          <ResourceIcon resource={ResourcesIds[impacted as ResourcesIds]} size="sm" />
                        </div>
                      ))}
                    </div>
                    {impactedTotals.length > 0 && (
                      <span className="block text-right text-[10px] text-gold/50">
                        Peak usage {Math.round(Math.max(...impactedTotals))}%
                      </span>
                    )}
                  </div>
                )}
                {overBudgetResources.length > 0 && (
                  <div className="text-[10px] text-danger/80">
                    Over budget for {overBudgetResources.map((res) => resolveResourceLabel(res)).join(", ")}
                  </div>
                )}
              </div>
            );
          };

          const isDonkeyResource = resourceId === ResourcesIds.Donkey;
          const laborDisabled = isDonkeyResource || ARMY_T2_T3_RESOURCES.has(resourceId as ResourcesIds);

          return (
            <div
              key={`automation-row-${resourceId}`}
              className={clsx(
                "rounded border border-gold/20 bg-black/20 p-3 space-y-3",
                resourceOverBudget && "border-danger/60",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={ResourcesIds[resourceId as ResourcesIds]} size="sm" />
                  <div>
                    <div className="text-sm font-semibold text-gold">{label}</div>
                    {resourceOverBudget && (
                      <div className="text-[11px] text-danger/80">{Math.round(resourceUsage)}% allocated</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {renderSlider(
                  "Resource",
                  percentages.resourceToResource,
                  (next) => handleSliderChange(resourceId, "resourceToResource", next),
                  complexImpacted,
                )}
                {!laborDisabled &&
                  renderSlider(
                    "Labor",
                    percentages.laborToResource,
                    (next) => handleSliderChange(resourceId, "laborToResource", next),
                    simpleImpacted,
                  )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
