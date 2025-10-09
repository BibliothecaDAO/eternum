import {
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  isAutomationResourceBlocked,
  useAutomationStore,
} from "@/hooks/store/use-automation-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import { useCallback, useEffect, useMemo } from "react";
import { REALM_PRESETS, RealmPresetId, inferRealmPreset } from "@/utils/automation-presets";

type RealmAutomationPanelProps = {
  realmEntityId: string;
  realmName?: string;
  producedResources: ResourcesIds[];
  entityType?: "realm" | "village";
};

const sliderStep = 5;

const resolveResourceLabel = (resourceId: number): string => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

const uniqueResources = (resources: ResourcesIds[]): ResourcesIds[] => {
  return Array.from(new Set(resources)).sort((a, b) => a - b);
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
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const setRealmPreset = useAutomationStore((state) => state.setRealmPreset);
  const setResourcePercentages = useAutomationStore((state) => state.setResourcePercentages);
  const ensureResourceConfig = useAutomationStore((state) => state.ensureResourceConfig);
  const removeResourceConfig = useAutomationStore((state) => state.removeResourceConfig);
  const realmAutomation = useAutomationStore((state) => state.realms[realmEntityId]);

  const realmResources = useMemo(
    () => uniqueResources(producedResources.filter((resourceId) => !isAutomationResourceBlocked(resourceId, entityType))),
    [entityType, producedResources],
  );

  useEffect(() => {
    const current = useAutomationStore.getState().realms[realmEntityId];
    const needsMetadataUpdate =
      current && (current.realmName !== realmName || current.entityType !== entityType);

    if (!current || needsMetadataUpdate) {
      upsertRealm(realmEntityId, { realmName, entityType });
    }
  }, [entityType, realmEntityId, realmName, upsertRealm]);

  const missingResources = useMemo(() => {
    if (!realmAutomation) return realmResources;
    return realmResources.filter((resourceId) => !realmAutomation.resources?.[resourceId]);
  }, [realmAutomation, realmResources]);

  useEffect(() => {
    if (!missingResources.length) return;
    missingResources.forEach((resourceId) => ensureResourceConfig(realmEntityId, resourceId));
  }, [ensureResourceConfig, missingResources, realmEntityId]);

  const extraResources = useMemo(() => {
    if (!realmAutomation) return [];
    const effectiveEntityType = realmAutomation.entityType ?? entityType;
    return Object.keys(realmAutomation.resources ?? {})
      .map((key) => Number(key) as ResourcesIds)
      .filter(
        (resourceId) => !isAutomationResourceBlocked(resourceId, effectiveEntityType) && !realmResources.includes(resourceId),
      );
  }, [realmAutomation, realmResources, entityType]);

  useEffect(() => {
    if (!extraResources.length) return;
    extraResources.forEach((resourceId) => removeResourceConfig(realmEntityId, resourceId));
  }, [extraResources, realmEntityId, removeResourceConfig]);

  const automationRows = useMemo(() => {
    const rows = realmResources.map((resourceId) => {
      const config = realmAutomation?.resources[resourceId];
      const percentages = config?.percentages
        ? { ...config.percentages }
        : { ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES };

      const complexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
      const simpleInputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];

      return {
        resourceId,
        config,
        percentages,
        complexInputs,
        simpleInputs,
      };
    });

    return rows;
  }, [realmResources, realmAutomation]);

  const aggregatedUsageMap = useMemo(() => {
    const totals = new Map<number, number>();
    const effectiveEntityType = realmAutomation?.entityType ?? entityType;

    automationRows.forEach((row) => {
      const { resourceId, percentages, complexInputs, simpleInputs } = row;

      if (percentages.resourceToResource > 0) {
        complexInputs.forEach((input) => {
          if (isAutomationResourceBlocked(input.resource, effectiveEntityType)) return;
          totals.set(
            input.resource,
            (totals.get(input.resource) ?? 0) + percentages.resourceToResource,
          );
        });
      }

      if (percentages.laborToResource > 0) {
        simpleInputs.forEach((input) => {
          if (isAutomationResourceBlocked(input.resource, effectiveEntityType)) return;
          totals.set(
            input.resource,
            (totals.get(input.resource) ?? 0) + percentages.laborToResource,
          );
        });
      }
    });

    return totals;
  }, [automationRows, entityType, realmAutomation]);

  const aggregatedUsageList = useMemo(() => {
    return Array.from(aggregatedUsageMap.entries())
      .map(([resourceId, percent]) => ({ resourceId, percent }))
      .sort((a, b) => a.resourceId - b.resourceId);
  }, [aggregatedUsageMap]);

  const aggregatedUsageRecord = useMemo(() => {
    const record: Record<number, number> = {};
    aggregatedUsageMap.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }, [aggregatedUsageMap]);

  const lastExecution = realmAutomation?.lastExecution;
  const lastExecutionEntries = useMemo(() => {
    if (!lastExecution) return [];
    return [...(lastExecution.resourceToResource ?? []), ...(lastExecution.laborToResource ?? [])].sort(
      (a, b) => a.resourceId - b.resourceId,
    );
  }, [lastExecution]);
  const activePresetId = inferRealmPreset(realmAutomation);
  const handlePresetSelect = useCallback(
    (presetId: RealmPresetId) => {
      if (presetId === "custom") {
        setRealmPreset(realmEntityId, null);
        return;
      }
      setRealmPreset(realmEntityId, presetId);
    },
    [realmEntityId, setRealmPreset],
  );

  const handleSliderChange = useCallback(
    (
      resourceId: ResourcesIds,
      key: "resourceToResource" | "laborToResource",
      value: number,
    ) => {
      setRealmPreset(realmEntityId, null);
      setResourcePercentages(realmEntityId, resourceId, { [key]: value });
    },
    [realmEntityId, setRealmPreset, setResourcePercentages],
  );

  if (!automationRows.length) {
    return (
      <div className="panel-wood p-4 rounded-lg text-sm text-gold/70">
        This realm has no active production buildings yet. Create production structures to configure automation.
      </div>
    );
  }

  return (
    <div className="panel-wood p-4 rounded-lg space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gold">Production Automation</h4>
          <p className="text-xs text-gold/60">
            Adjust sliders or apply a preset to fine-tune production.
          </p>
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
              const isClose = percent >= MAX_RESOURCE_ALLOCATION_PERCENT - 5;
              return (
                <li
                  key={`usage-${resourceId}`}
                  className={clsx(
                    "flex items-center gap-2 rounded border px-3 py-2 text-xs",
                    isOverBudget
                      ? "border-danger/60 text-danger"
                      : isClose
                        ? "border-warning/60 text-warning"
                        : "border-gold/20 text-gold/80",
                  )}
                >
                  <ResourceIcon resource={ResourcesIds[resourceId as ResourcesIds]} size="xs" />
                  <span className="flex-1">{label}</span>
                  <span className="font-semibold">{Math.round(percent)}%</span>
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
                {renderSlider(
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

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-gold">Last Automation Run</h5>
          {lastExecution ? (
            <span className="text-[11px] text-gold/60">
              {new Date(lastExecution.executedAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-[11px] text-gold/60">Pending execution</span>
          )}
        </div>
        {lastExecution ? (
          <div className="grid grid-cols-4 gap-2">
            {lastExecutionEntries.map((entry, index) => (
              <div key={`exec-${entry.resourceId}-${index}`} className="rounded border border-gold/20 px-3 py-2 text-xs text-gold/80">
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={ResourcesIds[entry.resourceId as ResourcesIds]} size="xs" />
                  <span className="font-semibold text-gold">{resolveResourceLabel(entry.resourceId)}</span>
                </div>
                <div className="mt-1">Produced {Math.round(entry.produced).toLocaleString()}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gold/60">
            Once automation executes, production summaries will appear here.
          </p>
        )}
        {lastExecution?.skipped.length ? (
          <div className="text-[11px] text-warning">
            Skipped: {lastExecution.skipped.map((item) => resolveResourceLabel(item.resourceId)).join(", ")}
          </div>
        ) : null}
      </section>
    </div>
  );
};
