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
import { ResourcesIds } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { REALM_PRESETS, RealmPresetId, calculatePresetAllocations, inferRealmPreset } from "@/utils/automation-presets";

type RealmAutomationPanelProps = {
  realmEntityId: string;
  realmName?: string;
  producedResources: ResourcesIds[];
  entityType?: "realm" | "village";
};

const sliderStep = 5;

const formatSignedPerSecond = (value: number): string => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return "0/s";
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
  return `${sign}${label}/s`;
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
  const setResourcePercentages = useAutomationStore((state) => state.setResourcePercentages);
  const ensureResourceConfig = useAutomationStore((state) => state.ensureResourceConfig);
  const removeResourceConfig = useAutomationStore((state) => state.removeResourceConfig);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const realmAutomation = useAutomationStore((state) => state.realms[realmEntityId]);

  type Snapshot = {
    presetId: RealmPresetId | null;
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

  const extraResources = useMemo(() => {
    if (!realmAutomation) return [];
    const effectiveEntityType = realmAutomation.entityType ?? entityType;
    return Object.keys(realmAutomation.resources ?? {})
      .map((key) => Number(key) as ResourcesIds)
      .filter(
        (resourceId) =>
          !isAutomationResourceBlocked(resourceId, effectiveEntityType) && !realmResources.includes(resourceId),
      );
  }, [realmAutomation, realmResources, entityType]);

  useEffect(() => {
    if (!hydrated) return;
    if (!extraResources.length) return;
    extraResources.forEach((resourceId) => removeResourceConfig(realmEntityId, resourceId));
  }, [extraResources, realmEntityId, removeResourceConfig, hydrated]);

  const createBaselinePercentages = useCallback(
    (resourceId: ResourcesIds): ResourceAutomationPercentages => {
      if (resourceId === ResourcesIds.Donkey) {
        return { resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT, laborToResource: 0 };
      }
      return {
        resourceToResource: DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.resourceToResource,
        laborToResource: DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.laborToResource,
      };
    },
    [],
  );

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

    const targetPreset = draftPresetId ?? null;
    const savedPreset = lastSavedSnapshot.presetId ?? null;
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
    if (!realmAutomation) return;

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
      presetId: realmAutomation.presetId ?? null,
      percentages: snapshotPercentages,
    };

    setLastSavedSnapshot(snapshot);

    if (!hasLocalChanges) {
      setDraftPercentages(snapshotPercentages);
      setDraftPresetId(snapshot.presetId);
    }
  }, [realmAutomation, realmResources, createBaselinePercentages, hasLocalChanges]);

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
      presetId: draftPresetId ?? realmAutomation.presetId ?? null,
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

  const activePresetId = useMemo(
    () => inferRealmPreset(draftAutomation ?? realmAutomation),
    [draftAutomation, realmAutomation],
  );

  const netUsagePerSecondRecord = useMemo(() => {
    const record: Record<number, number> = {};
    const numericRealmId = Number(realmEntityId);
    if (!components || !Number.isFinite(numericRealmId) || numericRealmId <= 0) {
      return record;
    }

    const manager = new ResourceManager(components, numericRealmId);
    const resourceComponent = manager.getResource();
    if (!resourceComponent) {
      return record;
    }

    const { currentDefaultTick } = getBlockTimestamp();

    const relevantResourceIds = new Set<ResourcesIds>();
    realmResources.forEach((id) => relevantResourceIds.add(id));
    aggregatedUsageList.forEach((item) => relevantResourceIds.add(item.resourceId as ResourcesIds));
    Object.keys(realmAutomation?.resources ?? {}).forEach((key) => {
      relevantResourceIds.add(Number(key) as ResourcesIds);
    });

    const perSecondOutputs = new Map<number, number>();
    const perSecondConsumptionTotals = new Map<number, number>();

    const addOutput = (resourceId: number, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      perSecondOutputs.set(resourceId, (perSecondOutputs.get(resourceId) ?? 0) + amount);
    };

    const addConsumption = (resourceId: number, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      perSecondConsumptionTotals.set(resourceId, (perSecondConsumptionTotals.get(resourceId) ?? 0) + amount);
    };

    automationRows.forEach(({ resourceId, percentages, complexInputs, simpleInputs }) => {
      const typedResourceId = resourceId as ResourcesIds;
      let baseOutputPerSecond = 0;
      try {
        const productionInfo = ResourceManager.balanceAndProduction(resourceComponent, typedResourceId);
        const productionData = ResourceManager.calculateResourceProductionData(
          typedResourceId,
          productionInfo,
          currentDefaultTick || 0,
        );
        if (Number.isFinite(productionData.productionPerSecond)) {
          baseOutputPerSecond = productionData.productionPerSecond;
        }
      } catch (_error) {
        baseOutputPerSecond = 0;
      }

      if (baseOutputPerSecond <= 0) {
        return;
      }

      const resourceRatio = Math.min(
        1,
        Math.max(0, percentages.resourceToResource / MAX_RESOURCE_ALLOCATION_PERCENT),
      );
      const laborRatio = Math.min(1, Math.max(0, percentages.laborToResource / MAX_RESOURCE_ALLOCATION_PERCENT));
      const outputRatio = Math.min(1, resourceRatio + laborRatio);
      const producedPerSecond = baseOutputPerSecond * outputRatio;

      if (producedPerSecond > 0) {
        addOutput(resourceId, producedPerSecond);
      }

      if (resourceRatio > 0 && complexInputs.length > 0) {
        const complexOutput = configManager.complexSystemResourceOutput[resourceId]?.amount ?? 0;
        if (complexOutput > 0) {
          const ratio = (baseOutputPerSecond / complexOutput) * resourceRatio;
          complexInputs.forEach((input) => addConsumption(input.resource, ratio * input.amount));
        }
      }

      if (laborRatio > 0 && simpleInputs.length > 0) {
        const simpleOutput = configManager.simpleSystemResourceOutput[resourceId]?.amount ?? 0;
        if (simpleOutput > 0) {
          const ratio = (baseOutputPerSecond / simpleOutput) * laborRatio;
          simpleInputs.forEach((input) => addConsumption(input.resource, ratio * input.amount));
        }

        const laborOutput = configManager.laborOutputPerResource[resourceId]?.amount ?? 0;
        if (laborOutput > 0) {
          const laborPerSecond = (baseOutputPerSecond / laborOutput) * laborRatio;
          addConsumption(ResourcesIds.Labor, laborPerSecond);
        }
      }
    });

    const finalResourceIds = new Set<number>([
      ...perSecondOutputs.keys(),
      ...perSecondConsumptionTotals.keys(),
      ...Array.from(relevantResourceIds),
      ...aggregatedUsageList.map((item) => item.resourceId),
    ]);

    finalResourceIds.forEach((resourceId) => {
      const produced = perSecondOutputs.get(resourceId) ?? 0;
      const consumed = perSecondConsumptionTotals.get(resourceId) ?? 0;
      record[resourceId] = produced - consumed;
    });

    return record;
  }, [automationRows, components, realmEntityId, realmAutomation?.resources, realmResources, aggregatedUsageList]);

  const handlePresetSelect = useCallback(
    (presetId: RealmPresetId) => {
      if (!draftAutomation) return;

      const allocations = calculatePresetAllocations(draftAutomation, presetId);
      setDraftPresetId(presetId);

      if (allocations.size === 0 && presetId !== "idle") {
        return;
      }

      setDraftPercentages((prev) => {
        const resourceKeys = new Set<number>([
          ...Object.keys(prev).map(Number),
          ...Object.keys(draftAutomation.resources ?? {}).map(Number),
          ...realmResources.map((resourceId) => Number(resourceId)),
        ]);

        const updated: Record<number, ResourceAutomationPercentages> = {};
        resourceKeys.forEach((key) => {
          const resourceId = Number(key) as ResourcesIds;
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
    },
    [draftAutomation, realmResources],
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
      setDraftPresetId(null);
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
    setDraftPresetId(lastSavedSnapshot.presetId ?? null);
  }, [lastSavedSnapshot]);

  const handleSave = useCallback(() => {
    if (!realmAutomation || !hasLocalChanges) return;

    const snapshot = lastSavedSnapshot ?? {
      presetId: realmAutomation.presetId ?? null,
      percentages: Object.entries(realmAutomation.resources ?? {}).reduce(
        (acc, [key, settings]) => {
          if (!settings) return acc;
          acc[Number(key)] = { ...settings.percentages };
          return acc;
        },
        {} as Record<number, ResourceAutomationPercentages>,
      ),
    };

    const targetPreset = draftPresetId ?? null;
    const savedPreset = snapshot.presetId ?? null;
    if (targetPreset !== savedPreset) {
      setRealmPreset(realmEntityId, targetPreset);
    }

    const resourceIds = new Set<number>([
      ...Object.keys(snapshot.percentages).map(Number),
      ...Object.keys(draftPercentages).map(Number),
    ]);

    const allResources = new Set<number>([
      ...resourceIds,
      ...realmResources.map((resourceId) => Number(resourceId)),
      ...Object.keys(realmAutomation.resources ?? {}).map(Number),
    ]);

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

    const normalizedPercentages: Record<number, ResourceAutomationPercentages> = {};
    allResources.forEach((id) => {
      const resourceId = Number(id) as ResourcesIds;
      const source =
        draftPercentages[resourceId] ??
        snapshot.percentages[resourceId] ??
        createBaselinePercentages(resourceId);
      normalizedPercentages[resourceId] = {
        resourceToResource: source.resourceToResource,
        laborToResource: source.laborToResource,
      };
    });

    setLastSavedSnapshot({
      presetId: targetPreset,
      percentages: normalizedPercentages,
    });
    setDraftPercentages(normalizedPercentages);
    setDraftPresetId(targetPreset);
  }, [
    realmAutomation,
    hasLocalChanges,
    lastSavedSnapshot,
    draftPresetId,
    draftPercentages,
    createBaselinePercentages,
    setRealmPreset,
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
              disabled={!hasLocalChanges}
              isPulsing={hasLocalChanges}
            >
              Save Changes
            </Button>
            <Button variant="outline" size="xs" onClick={handleUndo} disabled={!hasLocalChanges}>
              Undo
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {REALM_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={clsx(
                "px-3 py-1 rounded border text-xs transition-colors",
                activePresetId === preset.id
                  ? "border-gold text-gold bg-gold/10"
                  : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold",
              )}
              title={preset.description}
              onClick={() => handlePresetSelect(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {hasLocalChanges && (
          <span className="text-[11px] text-warning">Unsaved changes pending. Save to apply automation updates.</span>
        )}
      </header>

      <section className="space-y-2">
        <h5 className="text-sm font-semibold text-gold">Resource Usage</h5>
        {aggregatedUsageList.length === 0 ? (
          <p className="text-xs text-gold/60">No resources allocated yet.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {aggregatedUsageList.map(({ resourceId, percent }) => {
              const label = resolveResourceLabel(resourceId);
              const isOverBudget = percent > MAX_RESOURCE_ALLOCATION_PERCENT;
              const netPerSecond = netUsagePerSecondRecord[resourceId] ?? 0;
              const netLabel = formatSignedPerSecond(netPerSecond);
              const netClass =
                netPerSecond < 0 ? "text-danger/80" : netPerSecond > 0 ? "text-gold/70" : "text-gold/40";
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
                      <span className={netClass}>{netLabel}</span>
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

            return (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gold/80">
                  <span>{sliderLabel}</span>
                  <span className="font-semibold text-gold">{value}%</span>
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
                {!isDonkeyResource &&
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
