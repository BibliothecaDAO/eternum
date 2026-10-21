import {
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  type ResourceAutomationPercentages,
  isAutomationResourceBlocked,
  useAutomationStore,
} from "@/hooks/store/use-automation-store";
import { PROCESS_INTERVAL_MS } from "@bibliothecadao/eternum/automation";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { aggregateConsumptionPerSecond, configManager } from "@bibliothecadao/eternum";
import { ResourcesIds, formatFigure, formatPercent } from "@bibliothecadao/types";
import {
  HudButton,
  HudEmpty,
  HudField,
  HudNotice,
  HudPanel,
  HudRow,
  HudSlider,
} from "@/ui/design-system/kit/hud-elements";
import { NOTHING_TO_AUTOMATE } from "@/ui/design-system/kit/words";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  resolveProductionPercentages,
  REALM_PRESETS,
  RealmPresetId,
  calculatePresetAllocations,
  inferRealmPreset,
} from "@bibliothecadao/eternum/automation";

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

const formatPerCycle = (value: number): string =>
  !Number.isFinite(value) || Math.abs(value) < 0.0001 ? "0/c" : `${formatFigure(value, { signed: true })}/c`;

const resolveResourceLabel = (resourceId: number): string => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

const uniqueResources = (resources: ResourcesIds[]): ResourcesIds[] => {
  const list = Array.from(new Set(resources));
  return list.toSorted((a, b) => {
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
  const laborEnabled = configManager.isCommandEnabled("BurnLaborForResourceProduction");
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const setRealmPreset = useAutomationStore((state) => state.setRealmPreset);
  const setResourcePercentages = useAutomationStore((state) => state.setResourcePercentages);
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
    () => uniqueResources(producedResources.filter((resourceId) => !isAutomationResourceBlocked(resourceId))),
    [producedResources],
  );

  const savedPresetId = useMemo(() => inferRealmPreset(realmAutomation), [realmAutomation]);
  const activePresetId = draftPresetId ?? savedPresetId;

  const smartPresetAllocations = useMemo(() => calculatePresetAllocations(realmResources, "smart"), [realmResources]);

  const presetAllocations = useMemo(() => {
    if (activePresetId === "custom") {
      return new Map<number, ResourceAutomationPercentages>();
    }
    return calculatePresetAllocations(realmResources, activePresetId);
  }, [activePresetId, realmResources]);

  useEffect(() => {
    if (!hydrated) return;
    const current = useAutomationStore.getState().realms[realmEntityId];
    const needsMetadataUpdate = current && (current.realmName !== realmName || current.entityType !== entityType);

    if (!current || needsMetadataUpdate) {
      upsertRealm(realmEntityId, { realmName, entityType });
    }
  }, [entityType, realmEntityId, realmName, upsertRealm, hydrated]);

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
        return resolveProductionPercentages(fromDraft, resourceId);
      }
      if (activePresetId === "custom") {
        const stored = realmAutomation?.customPercentages?.[resourceId];
        if (stored) {
          return resolveProductionPercentages(stored, resourceId);
        }
        const smartDefault = smartPresetAllocations.get(resourceId);
        if (smartDefault) {
          return { ...smartDefault };
        }
        return resolveProductionPercentages(createBaselinePercentages(resourceId), resourceId);
      }

      const allocation = presetAllocations.get(resourceId);
      if (allocation) {
        return { ...allocation };
      }

      return resolveProductionPercentages(createBaselinePercentages(resourceId), resourceId);
    },
    [
      draftPercentages,
      activePresetId,
      realmAutomation,
      presetAllocations,
      smartPresetAllocations,
      createBaselinePercentages,
    ],
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
    const presetId = inferRealmPreset(realmAutomation);

    if (presetId === "custom") {
      const smartDefaults = calculatePresetAllocations(realmResources, "smart");
      realmResources.forEach((resourceId) => {
        snapshotPercentages[resourceId] =
          realmAutomation.customPercentages?.[resourceId] ??
          smartDefaults.get(resourceId) ??
          createBaselinePercentages(resourceId);
      });
    } else {
      const allocations = calculatePresetAllocations(realmResources, presetId);
      realmResources.forEach((resourceId) => {
        snapshotPercentages[resourceId] = allocations.get(resourceId) ?? createBaselinePercentages(resourceId);
      });
    }

    const snapshot: Snapshot = {
      presetId,
      percentages: snapshotPercentages,
    };

    setLastSavedSnapshot(snapshot);
    setDraftPercentages(snapshotPercentages);
    setDraftPresetId(presetId);
  }, [realmAutomation, realmResources, createBaselinePercentages, hydrated, hasLocalChanges]);

  const automationRows = useMemo(() => {
    // A resource whose recipe this game does not define cannot be automated, so it has no row.
    return realmResources.flatMap((resourceId) => {
      const complexInputs = configManager.getRecipeInputs(resourceId, false);
      const simpleInputs = configManager.getRecipeInputs(resourceId, true);
      if (!complexInputs || !simpleInputs) return [];
      return [{ resourceId, percentages: resolveDraftPercentages(resourceId), complexInputs, simpleInputs }];
    });
  }, [realmResources, resolveDraftPercentages]);

  const aggregatedUsageMap = useMemo(() => {
    const totals = new Map<number, number>();
    automationRows.forEach((row) => {
      const { percentages, complexInputs, simpleInputs } = row;

      if (percentages.resourceToResource > 0) {
        complexInputs.forEach((input) => {
          if (input.resource === ResourcesIds.Wheat) return;
          totals.set(input.resource, (totals.get(input.resource) ?? 0) + percentages.resourceToResource);
        });
      }

      if (percentages.laborToResource > 0) {
        simpleInputs.forEach((input) => {
          if (input.resource === ResourcesIds.Wheat) return;
          totals.set(input.resource, (totals.get(input.resource) ?? 0) + percentages.laborToResource);
        });
      }
    });

    return totals;
  }, [automationRows]);

  const aggregatedUsageList = useMemo(() => {
    return Array.from(aggregatedUsageMap.entries())
      .filter(([resourceId]) => resourceId !== ResourcesIds.Wheat)
      .map(([resourceId, percent]) => ({ resourceId, percent }))
      .toSorted((a, b) => a.resourceId - b.resourceId);
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
    const percentagesByResource: Record<number, ResourceAutomationPercentages> = {};
    automationRows.forEach(({ resourceId, percentages }) => {
      percentagesByResource[resourceId] = percentages;
    });
    const cycleSeconds = PROCESS_INTERVAL_MS / 1000;
    const perSecond = aggregateConsumptionPerSecond(
      automationRows.map((row) => row.resourceId),
      percentagesByResource,
      {
        maxAllocationPercent: MAX_RESOURCE_ALLOCATION_PERCENT,
        cycleSeconds,
      },
    );
    const perCycle = new Map<number, number>();
    perSecond.forEach((value, key) => {
      perCycle.set(key, value * cycleSeconds);
    });
    return perCycle;
  }, [automationRows]);

  const aggregatedProductionMap = useMemo(() => {
    const totals = new Map<number, number>();

    automationRows.forEach(({ resourceId, percentages }) => {
      const resourceRatio = Math.min(1, Math.max(0, percentages.resourceToResource / MAX_RESOURCE_ALLOCATION_PERCENT));
      const laborRatio = Math.min(1, Math.max(0, percentages.laborToResource / MAX_RESOURCE_ALLOCATION_PERCENT));

      if (resourceRatio > 0) {
        const complexOutput = configManager.getRecipeOutput(resourceId, false)!;
        if (complexOutput > 0) {
          totals.set(resourceId, (totals.get(resourceId) ?? 0) + resourceRatio * complexOutput);
        }
      }

      if (laborRatio > 0) {
        const simpleOutput = configManager.getRecipeOutput(resourceId, true)!;
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
      .toSorted((a, b) => a.resourceId - b.resourceId);
  }, [aggregatedUsageMap, aggregatedConsumptionMap, aggregatedProductionMap]);

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
      if (presetId === "custom") {
        setDraftPresetId("custom");
        return;
      }

      const allocations = calculatePresetAllocations(realmResources, presetId);

      setDraftPercentages((prev) => {
        const updated: Record<number, ResourceAutomationPercentages> = { ...prev };
        realmResources.forEach((resourceId) => {
          const allocation = allocations.get(resourceId) ?? { resourceToResource: 0, laborToResource: 0 };
          updated[resourceId] = { ...allocation };
        });

        return updated;
      });

      setDraftPresetId(presetId);
    },
    [realmResources],
  );

  const handleSliderChange = useCallback(
    (resourceId: ResourcesIds, key: "resourceToResource" | "laborToResource", value: number) => {
      setDraftPercentages((prev) => {
        const existing = prev[resourceId] ?? resolveDraftPercentages(resourceId);
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
    [resolveDraftPercentages],
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

    const savedPreset = lastSavedSnapshot?.presetId ?? inferRealmPreset(realmAutomation);
    const targetPreset = draftPresetId ?? savedPreset;

    const buildPercentagesForPreset = (presetId: RealmPresetId) => {
      const next: Record<number, ResourceAutomationPercentages> = {};
      if (presetId === "custom") {
        const smartDefaults = calculatePresetAllocations(realmResources, "smart");
        realmResources.forEach((resourceId) => {
          next[resourceId] =
            realmAutomation.customPercentages?.[resourceId] ??
            smartDefaults.get(resourceId) ??
            createBaselinePercentages(resourceId);
        });
        return next;
      }

      const allocations = calculatePresetAllocations(realmResources, presetId);
      realmResources.forEach((resourceId) => {
        next[resourceId] = allocations.get(resourceId) ?? createBaselinePercentages(resourceId);
      });
      return next;
    };

    if (targetPreset !== "custom") {
      setRealmPreset(realmEntityId, targetPreset);
      const normalizedPercentages = buildPercentagesForPreset(targetPreset);
      setLastSavedSnapshot({ presetId: targetPreset, percentages: normalizedPercentages });
      setDraftPercentages(normalizedPercentages);
      setDraftPresetId(targetPreset);
      return;
    }

    const allResources = new Set<number>([
      ...realmResources.map((resourceId) => Number(resourceId)),
      ...Object.keys(realmAutomation.customPercentages ?? {}).map(Number),
    ]);

    const currentResourceSet = new Set<number>(realmResources.map((resourceId) => Number(resourceId)));
    const normalizedPercentages: Record<number, ResourceAutomationPercentages> = {};
    allResources.forEach((id) => {
      const resourceId = Number(id) as ResourcesIds;
      const source = currentResourceSet.has(resourceId)
        ? (draftPercentages[resourceId] ?? resolveDraftPercentages(resourceId))
        : (realmAutomation.customPercentages?.[resourceId] ?? resolveDraftPercentages(resourceId));
      normalizedPercentages[resourceId] = resolveProductionPercentages(source, resourceId);
    });

    Object.entries(normalizedPercentages).forEach(([key, value]) => {
      setResourcePercentages(realmEntityId, Number(key) as ResourcesIds, value);
    });

    setRealmPreset(realmEntityId, "custom");

    setLastSavedSnapshot({ presetId: "custom", percentages: normalizedPercentages });
    setDraftPercentages(normalizedPercentages);
    setDraftPresetId("custom");
  }, [
    realmAutomation,
    hasLocalChanges,
    lastSavedSnapshot,
    draftPresetId,
    draftPercentages,
    realmResources,
    createBaselinePercentages,
    resolveDraftPercentages,
    realmEntityId,
    setRealmPreset,
    setResourcePercentages,
  ]);

  if (!automationRows.length) {
    return <HudEmpty icon="automation" line={NOTHING_TO_AUTOMATE} />;
  }

  return (
    <HudPanel
      kind="section"
      title="Production automation"
      collapsible={false}
      cue={
        <span className="flex gap-2">
          <HudButton kind="quiet" size="sm" onClick={handleUndo} disabled={!hasLocalChanges}>
            Undo
          </HudButton>
          <HudButton
            kind={hasLocalChanges ? "primary" : "secondary"}
            size="sm"
            onClick={handleSave}
            disabled={!hasLocalChanges || isOverallocated}
            title={isOverallocated ? "Resolve over-allocation before saving changes." : undefined}
          >
            Save Changes
          </HudButton>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-hud-muted">Move a slider or apply a preset, then save.</p>
        {isOverallocated && (
          <HudNotice tone="bad" line={`Resolve over-allocation for ${overallocatedLabels.join(", ")} before saving.`} />
        )}
        <div className="flex flex-wrap gap-2">
          {[
            ...REALM_PRESETS.filter((preset) => preset.id !== "custom"),
            ...REALM_PRESETS.filter((preset) => preset.id === "custom"),
          ].map((preset) => (
            <HudButton
              key={preset.id}
              kind="secondary"
              size="sm"
              aria-pressed={activePresetId === preset.id}
              title={preset.description}
              onClick={() => handlePresetSelect(preset.id)}
            >
              {preset.label}
            </HudButton>
          ))}
        </div>
        {hasLocalChanges && <HudNotice tone="warn" line="Unsaved changes pending. Save to apply automation updates." />}

        {/* The usage and each resource's allocation are HUD panels: cards, as the Transfer window draws its columns. */}
        <HudPanel label="Resource usage" title="Resource usage" collapsible={false}>
          {usageDisplayList.length === 0 ? (
            <p className="text-hud-label text-hud-muted">No resources allocated yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {usageDisplayList.map(({ resourceId, percent, perCycle }) => {
                const isOverBudget = percent > MAX_RESOURCE_ALLOCATION_PERCENT;
                return (
                  <li key={`usage-${resourceId}`}>
                    <HudRow
                      lead={<ResourceIcon resource={resourceId as ResourcesIds} size="xs" />}
                      title={resolveResourceLabel(resourceId)}
                      detail={formatPerCycle(perCycle)}
                      trail={
                        <span className={isOverBudget ? "text-hud-strong text-hud-bad" : "text-hud-strong"}>
                          {formatPercent(percent / 100)}
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </HudPanel>

        {/* The sliders are always in reach: moving one turns the preset into Custom. */}
        {
          <section aria-label="Automation allocations" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-hud-label text-hud-muted">{sliderLabel}</span>
                      <span className="flex w-24 items-center gap-1">
                        <HudField
                          value={String(value)}
                          inputMode="numeric"
                          aria-label={`${label} ${sliderLabel.toLowerCase()} share`}
                          onChange={(typed) => onChange(clampPercent(Number(typed.replace(/\D/g, "")) || 0))}
                        />
                        <span className="text-hud-strong">%</span>
                      </span>
                    </div>
                    <HudSlider
                      label={`${label} ${sliderLabel.toLowerCase()} share`}
                      value={value}
                      max={MAX_RESOURCE_ALLOCATION_PERCENT}
                      step={sliderStep}
                      onChange={onChange}
                    />
                    {impactedResources.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-hud-label text-hud-cue">Inputs</span>
                        <div className="flex flex-wrap gap-1">
                          {impactedResources.map((impacted) => (
                            <span key={`impact-${resourceId}-${impacted}`} title={resolveResourceLabel(impacted)}>
                              <ResourceIcon resource={impacted as ResourcesIds} size="sm" />
                            </span>
                          ))}
                        </div>
                        {impactedTotals.length > 0 && (
                          <span className="text-right text-hud-label text-hud-cue">
                            Peak usage {formatPercent(Math.max(...impactedTotals) / 100)}
                          </span>
                        )}
                      </div>
                    )}
                    {overBudgetResources.length > 0 && (
                      <span className="text-hud-label text-hud-bad">
                        Over budget for {overBudgetResources.map((res) => resolveResourceLabel(res)).join(", ")}
                      </span>
                    )}
                  </div>
                );
              };

              const isDonkeyResource = resourceId === ResourcesIds.Donkey;
              const laborDisabled =
                !laborEnabled || isDonkeyResource || ARMY_T2_T3_RESOURCES.has(resourceId as ResourcesIds);

              return (
                <HudPanel
                  key={`automation-row-${resourceId}`}
                  label={`${label} automation`}
                  collapsible={false}
                  title={
                    <span className="flex items-center gap-2">
                      <ResourceIcon resource={resourceId as ResourcesIds} size="sm" />
                      {label}
                    </span>
                  }
                  cue={
                    resourceOverBudget ? (
                      <span className="text-hud-label text-hud-bad">
                        {formatPercent(resourceUsage / 100)} allocated
                      </span>
                    ) : undefined
                  }
                >
                  <div className="flex flex-col gap-3">
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
                </HudPanel>
              );
            })}
          </section>
        }
      </div>
    </HudPanel>
  );
};
