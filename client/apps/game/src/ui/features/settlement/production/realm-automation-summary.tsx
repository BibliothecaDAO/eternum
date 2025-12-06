import {
  DONKEY_DEFAULT_RESOURCE_PERCENT,
  DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
  MAX_RESOURCE_ALLOCATION_PERCENT,
  RealmAutomationConfig,
  RealmEntityType,
  isAutomationResourceBlocked,
} from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { CircularProgress } from "@/ui/features/world/containers/top-header/circular-progress";
import { ProductionModal } from "@/ui/features/settlement";
import { REALM_PRESETS, inferRealmPreset } from "@/utils/automation-presets";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import { useCallback, useMemo } from "react";

const resolveResourceLabel = (resourceId: number): string => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : `Resource ${resourceId}`;
};

const resolveProgressColor = (percent: number): "red" | "green" | "gold" => {
  if (percent >= MAX_RESOURCE_ALLOCATION_PERCENT) return "red";
  if (percent >= MAX_RESOURCE_ALLOCATION_PERCENT - 10) return "red";
  if (percent >= 60) return "gold";
  return "green";
};

const resolveBarClass = (percent: number): string => {
  if (percent >= MAX_RESOURCE_ALLOCATION_PERCENT) return "bg-danger/80";
  if (percent >= MAX_RESOURCE_ALLOCATION_PERCENT - 10) return "bg-danger/60";
  if (percent >= 60) return "bg-gold/70";
  return "bg-gold/30";
};

const formatAmount = (value?: number): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${Math.round(value / 1_000)}k`;
  if (absolute >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (absolute >= 1_000) return Math.round(value).toLocaleString();
  if (absolute >= 10) return Math.round(value).toLocaleString();
  return value.toFixed(1);
};

const formatPercent = (value?: number): string => {
  if (value === undefined || Number.isNaN(value)) return "0%";
  return `${Math.round(value)}%`;
};

const clampPercent = (value?: number | null): number => {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
};

type AutomationStatusTone = "success" | "warning" | "danger";

const STATUS_CLASS: Record<AutomationStatusTone, string> = {
  success: "text-gold",
  warning: "text-warning",
  danger: "text-danger",
};

const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

const resolveAutomationStatus = (
  maxInputPercent: number,
  lastRunAt: number | null,
): { icon: string; label: string; tone: AutomationStatusTone } => {
  const clamped = clampPercent(maxInputPercent);
  const now = Date.now();
  const isStale = !lastRunAt || now - lastRunAt > STALE_THRESHOLD_MS;

  if (clamped >= MAX_RESOURCE_ALLOCATION_PERCENT) {
    return { icon: "⛔️", label: isStale ? "Capped & stale" : "Input capped", tone: "danger" };
  }

  if (clamped >= MAX_RESOURCE_ALLOCATION_PERCENT - 10) {
    return { icon: "⚠️", label: "Near capacity", tone: "warning" };
  }

  if (isStale) {
    return { icon: "⚠️", label: "Awaiting run", tone: "warning" };
  }

  return { icon: "✅", label: "Stable", tone: "success" };
};

interface RealmAutomationSummaryProps {
  realmId: string;
  realmName?: string;
  entityType: RealmEntityType;
  resourceIds: ResourcesIds[];
  automation?: RealmAutomationConfig;
}

export const RealmAutomationSummary = ({
  realmId,
  realmName,
  entityType,
  resourceIds,
  automation,
}: RealmAutomationSummaryProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const inferredPresetId = inferRealmPreset(automation);
  const effectiveEntityType = automation?.entityType ?? entityType;
  const presetLabel = useMemo(() => {
    return REALM_PRESETS.find((preset) => preset.id === inferredPresetId)?.label ?? "Custom";
  }, [inferredPresetId]);
  const handleAdjustAutomation = useCallback(() => {
    const numericId = Number(realmId);
    if (Number.isFinite(numericId)) {
      setStructureEntityId(numericId);
    }
    toggleModal(<ProductionModal />);
  }, [realmId, setStructureEntityId, toggleModal]);

  const normalizedResourceIds = useMemo(() => {
    const unique = Array.from(new Set(resourceIds));
    return unique
      .filter((resourceId) => !isAutomationResourceBlocked(resourceId, effectiveEntityType))
      .sort((a, b) => {
        if (a === ResourcesIds.Wheat && b !== ResourcesIds.Wheat) return -1;
        if (b === ResourcesIds.Wheat && a !== ResourcesIds.Wheat) return 1;
        return a - b;
      });
  }, [resourceIds, effectiveEntityType]);

  const automationRows = useMemo(() => {
    return normalizedResourceIds.map((resourceId) => {
      const config = automation?.resources?.[resourceId];
      const percentages = config?.percentages
        ? { ...config.percentages }
        : resourceId === ResourcesIds.Donkey
          ? { resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT, laborToResource: 0 }
          : { ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES };

      if (resourceId === ResourcesIds.Donkey) {
        percentages.laborToResource = 0;
      }

      const complexInputs = configManager.complexSystemResourceInputs[resourceId] ?? [];
      const simpleInputs = configManager.simpleSystemResourceInputs[resourceId] ?? [];

      return {
        resourceId,
        percentages,
        complexInputs,
        simpleInputs,
      };
    });
  }, [automation?.resources, normalizedResourceIds]);

  const referenceAggregatedUsageMap = useMemo(() => {
    const totals = new Map<number, number>();

    automationRows.forEach((row) => {
      const { complexInputs, simpleInputs, percentages } = row;

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
  }, [automationRows, effectiveEntityType]);

  const referenceAggregatedUsageList = useMemo(() => {
    return Array.from(referenceAggregatedUsageMap.entries())
      .filter(([resourceId]) => resourceId !== ResourcesIds.Wheat)
      .map(([resourceId, percent]) => ({ resourceId, percent }))
      .sort((a, b) => a.resourceId - b.resourceId);
  }, [referenceAggregatedUsageMap]);

  const maxSavedInputPercent = useMemo(() => {
    return referenceAggregatedUsageList.reduce((max, item) => Math.max(max, item.percent), 0);
  }, [referenceAggregatedUsageList]);

  const referenceAggregatedUsageRecord = useMemo(() => {
    const record: Record<number, number> = {};
    referenceAggregatedUsageMap.forEach((value, key) => {
      if (key === ResourcesIds.Wheat) return;
      record[key] = value;
    });
    return record;
  }, [referenceAggregatedUsageMap]);

  const lastExecution = automation?.lastExecution;
  const lastExecutionEntries = useMemo(() => {
    if (!lastExecution) return [];
    return [...(lastExecution.resourceToResource ?? []), ...(lastExecution.laborToResource ?? [])].sort(
      (a, b) => a.resourceId - b.resourceId,
    );
  }, [lastExecution]);

  const lastExecutionTotals = useMemo(() => {
    if (!lastExecution) {
      return { produced: 0, consumed: 0, executedAt: null as number | null };
    }

    const produced = lastExecutionEntries.reduce((total, entry) => total + (entry.produced ?? 0), 0);

    const consumedFromSummary = lastExecution.consumptionByResource
      ? Object.values(lastExecution.consumptionByResource).reduce((total, amount) => total + amount, 0)
      : 0;

    const consumedFromEntries = consumedFromSummary
      ? 0
      : lastExecutionEntries.reduce((total, entry) => {
          if (!Array.isArray(entry.inputs)) return total;
          return total + entry.inputs.reduce((sum, input) => sum + (input.amount ?? 0), 0);
        }, 0);

    return {
      produced,
      consumed: consumedFromSummary || consumedFromEntries,
      executedAt: lastExecution.executedAt ?? null,
    };
  }, [lastExecution, lastExecutionEntries]);

  const status = useMemo(
    () => resolveAutomationStatus(maxSavedInputPercent, lastExecutionTotals.executedAt),
    [maxSavedInputPercent, lastExecutionTotals.executedAt],
  );

  const lastProducedByResource = useMemo(() => {
    const map = new Map<number, { produced: number; cycles: number }>();
    lastExecutionEntries.forEach((entry) => {
      const current = map.get(entry.resourceId) ?? { produced: 0, cycles: 0 };
      map.set(entry.resourceId, {
        produced: current.produced + (entry.produced ?? 0),
        cycles: current.cycles + (entry.cycles ?? 0),
      });
    });
    return map;
  }, [lastExecutionEntries]);

  const productionSummaryList = useMemo(() => {
    return automationRows.map(({ resourceId }) => {
      const producedSummary = lastProducedByResource.get(resourceId);
      return {
        resourceId,
        produced: producedSummary?.produced ?? 0,
        cycles: producedSummary?.cycles ?? 0,
      };
    });
  }, [automationRows, lastProducedByResource]);

  const resourceInputUsage = useMemo(() => {
    const map = new Map<number, Record<number, number>>();
    lastExecutionEntries.forEach((entry) => {
      if (!Array.isArray(entry.inputs)) return;
      const existing = map.get(entry.resourceId) ?? {};
      entry.inputs.forEach((input) => {
        const key = input.resourceId;
        if (typeof key !== "number") return;
        existing[key] = (existing[key] ?? 0) + (input.amount ?? 0);
      });
      map.set(entry.resourceId, existing);
    });
    return map;
  }, [lastExecutionEntries]);

  const aggregatedConsumptionTotals = useMemo(() => {
    const totals = new Map<number, number>();
    lastExecutionEntries.forEach((entry) => {
      if (!Array.isArray(entry.inputs)) return;
      entry.inputs.forEach((input) => {
        const key = input.resourceId;
        if (typeof key !== "number") return;
        totals.set(key, (totals.get(key) ?? 0) + (input.amount ?? 0));
      });
    });
    return totals;
  }, [lastExecutionEntries]);

  const consumptionHighlights = useMemo(() => {
    return referenceAggregatedUsageList.map(({ resourceId, percent }) => ({
      resourceId,
      percent,
      amount: aggregatedConsumptionTotals.get(resourceId) ?? 0,
    }));
  }, [aggregatedConsumptionTotals, referenceAggregatedUsageList]);

  if (!normalizedResourceIds.length) {
    return (
      <div className="rounded border border-gold/15 bg-black/20 p-4 text-xs text-gold/70">
        {realmName ?? realmId} has no configured automation yet. Use Modify to set up production.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          <span className="text-xxs uppercase tracking-wide text-gold/50">Preset</span>
          <div className="mt-1 text-sm font-semibold text-gold">
            {REALM_PRESETS.find((preset) => preset.id === inferredPresetId)?.label ?? "Custom"}
          </div>
        </div>
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          <span className="text-xxs uppercase tracking-wide text-gold/50">Last Run</span>
          <div className="mt-1 text-sm font-semibold text-gold">
            {lastExecutionTotals.executedAt
              ? new Date(lastExecutionTotals.executedAt).toLocaleString()
              : "Pending execution"}
          </div>
        </div>
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          <span className="text-xxs uppercase tracking-wide text-gold/50">Output (last run)</span>
          <div className="mt-1 text-sm font-semibold text-gold">
            {formatAmount(lastExecutionTotals.produced)}
            <span className="text-xxs text-gold/50"> total</span>
          </div>
        </div>
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          <span className="text-xxs uppercase tracking-wide text-gold/50">Inputs Burned (last run)</span>
          <div className="mt-1 text-sm font-semibold text-gold">
            {formatAmount(lastExecutionTotals.consumed)}
            <span className="text-xxs text-gold/50"> total</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-gold">Automation Snapshot</h5>
          <span className="text-xxs text-gold/50">Percentages reflect saved allocations.</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {automationRows.map(({ resourceId, percentages, complexInputs, simpleInputs }) => {
            const label = resolveResourceLabel(resourceId);
            const isDonkeyResource = resourceId === ResourcesIds.Donkey;
            const producedSummary = lastProducedByResource.get(resourceId);
            const inputsForResource = resourceInputUsage.get(resourceId) ?? {};
            const inputEntries = Object.entries(inputsForResource)
              .map(([key, amount]) => ({
                resourceId: Number(key),
                amount,
                percent: referenceAggregatedUsageRecord[Number(key)] ?? 0,
              }))
              .sort((a, b) => b.amount - a.amount);

            const impactedResources = Array.from(
              new Set([
                ...complexInputs.map((input) => input.resource),
                ...simpleInputs.map((input) => input.resource),
              ]),
            );

            return (
              <div
                key={`summary-${realmId}-${resourceId}`}
                className="rounded border border-gold/20 bg-black/15 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resource={ResourcesIds[resourceId as ResourcesIds]} size="sm" />
                    <div>
                      <div className="text-sm font-semibold text-gold">{label}</div>
                      <div className="text-xxs text-gold/50">
                        {producedSummary
                          ? `${formatAmount(producedSummary.produced)} produced · ${producedSummary.cycles} cycles`
                          : "Awaiting automation run"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <CircularProgress
                      progress={percentages.resourceToResource}
                      size="md"
                      color={resolveProgressColor(percentages.resourceToResource)}
                    >
                      <span className="text-xs font-semibold text-gold">{percentages.resourceToResource}%</span>
                    </CircularProgress>
                    <span className="text-xxs uppercase tracking-wide text-gold/60">Resource burn</span>
                  </div>
                  {!isDonkeyResource && (
                    <div className="flex flex-col items-center gap-1">
                      <CircularProgress
                        progress={percentages.laborToResource}
                        size="md"
                        color={resolveProgressColor(percentages.laborToResource)}
                      >
                        <span className="text-xs font-semibold text-gold">{percentages.laborToResource}%</span>
                      </CircularProgress>
                      <span className="text-xxs uppercase tracking-wide text-gold/60">Labor burn</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-xxs uppercase tracking-wide text-gold/50">Inputs</span>
                  {impactedResources.length === 0 ? (
                    <span className="text-xxs text-gold/60">No inputs required.</span>
                  ) : inputEntries.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {inputEntries.map(({ resourceId: inputId, amount, percent }) => (
                        <div
                          key={`summary-${realmId}-${resourceId}-input-${inputId}`}
                          className="flex items-center gap-2 rounded border border-gold/25 bg-black/20 px-2 py-1"
                        >
                          <ResourceIcon resource={ResourcesIds[inputId as ResourcesIds]} size="xs" />
                          <div className="text-xxs text-gold/60">
                            <div className="text-gold font-semibold">{formatAmount(amount)}</div>
                            <div>{formatPercent(percent)} budget</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xxs text-gold/60">
                      Inputs configured, awaiting next automation cycle for production data.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-gold">Input Load</h5>
          <span className="text-xxs text-gold/50">Track how close each input resource is to its budget.</span>
        </div>
        {referenceAggregatedUsageList.length === 0 ? (
          <p className="text-xs text-gold/60">No inputs allocated yet.</p>
        ) : (
          <div className="space-y-2">
            {referenceAggregatedUsageList.map(({ resourceId, percent }) => {
              const label = resolveResourceLabel(resourceId);
              const barWidth = Math.min(Math.max(percent, 0), 100);
              const barClass = resolveBarClass(percent);
              return (
                <div
                  key={`summary-${realmId}-input-load-${resourceId}`}
                  className="rounded border border-gold/15 bg-black/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-gold/80">
                    <div className="flex items-center gap-2">
                      <ResourceIcon resource={ResourcesIds[resourceId as ResourcesIds]} size="xs" />
                      <span>{label}</span>
                    </div>
                    <span className="font-semibold text-gold">{formatPercent(percent)}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-black/40">
                    <div className={clsx("h-full rounded", barClass)} style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
