import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { isAutomationResourceBlocked, useAutomationStore, RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { inferRealmPreset } from "@/utils/automation-presets";
import { ProductionModal } from "@/ui/features/settlement";
import { ProductionStatusBadge } from "@/ui/shared";
import {
  configManager,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getIsBlitz,
  getStructureName,
  Position,
  ResourceManager,
} from "@bibliothecadao/eternum";
import {
  useBuildings,
  useDojo,
  usePlayerOwnedRealmsInfo,
  usePlayerOwnedVillagesInfo,
  useQuery,
} from "@bibliothecadao/react";
import { getProducedResource, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { HasValue, runQuery } from "@dojoengine/recs";
import { Search } from "lucide-react";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatTimeRemaining } from "../../economy/resources/entity-resource-table/utils";

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(timestamp);
};

const formatRelative = (timestamp?: number) => {
  if (!timestamp) return "—";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatPerSecondValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs < 0.0001) return "0";
  if (abs >= 1000) return Math.round(abs).toLocaleString();
  if (abs >= 100) return abs.toFixed(0);
  if (abs >= 10) return abs.toFixed(1);
  if (abs >= 1) return abs.toFixed(2);
  return abs.toFixed(3);
};

const formatPerSecond = (value: number): string => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return "0/s";
  return `${formatPerSecondValue(value)}/s`;
};

const formatSignedPerSecond = (value: number): string => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return "0/s";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatPerSecondValue(value)}/s`;
};

const formatAmount = (value?: number): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${Math.round(value / 1_000)}k`;
  if (abs >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (abs >= 1_000) return Math.round(value).toLocaleString();
  if (abs >= 10) return Math.round(value).toLocaleString();
  return value.toFixed(1);
};

const formatSignedAmount = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) return "0";
  const label = formatAmount(Math.abs(value));
  return value > 0 ? `+${label}` : `-${label}`;
};

export const resolveAutomationStatusLabel = (automation?: RealmAutomationConfig | null): string => {
  if (!automation) {
    return "Burning labor";
  }

  const presetId = inferRealmPreset(automation);

  if (presetId === "idle") {
    return "Idle";
  }

  if (presetId === "labor") {
    return "Burning labor";
  }

  if (presetId === "resource") {
    return "Burning resources";
  }

  const hasLabor = Object.values(automation.resources ?? {}).some(
    (config) => (config?.percentages?.laborToResource ?? 0) > 0,
  );
  const hasResource = Object.values(automation.resources ?? {}).some(
    (config) => (config?.percentages?.resourceToResource ?? 0) > 0,
  );

  if (hasLabor && hasResource) return "Burning labor & resources";
  if (hasResource) return "Burning resources";
  if (hasLabor) return "Burning labor";

  return "Idle";
};

export const ProductionStatusPill = ({ statusLabel }: { statusLabel: string }) => (
  <span className="rounded-full border border-gold/30 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold/80">
    {statusLabel}
  </span>
);

export const ProductionModifyButton = ({
  onClick,
  disabled = false,
}: {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    className={`rounded border border-gold bg-gold px-2 py-0.5 text-[10px] uppercase tracking-wide text-black font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-gold ${
      disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[#ffd84a] hover:border-gold"
    }`}
    onClick={onClick}
  >
    Modify
  </button>
);

interface RealmProductionRecapProps {
  realmId: number;
  position: { x: number; y: number };
  metrics?: Record<number, ResourceProductionMetrics>;
  typeLabel?: string;
}

interface ResourceProductionSummaryItem {
  resourceId: ResourcesIds;
  totalBuildings: number;
  activeBuildings: number;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  productionPerSecond: number | null;
  outputRemaining: number | null;
  calculatedAt: number;
}

export const RealmProductionRecap = ({ realmId, position, metrics, typeLabel }: RealmProductionRecapProps) => {
  const {
    setup: {
      components: { Building, Resource },
    },
  } = useDojo();

  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setTimerTick((tick) => tick + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const currentTime = useMemo(() => Date.now(), [timerTick]);

  const buildings = useMemo(() => {
    return runQuery([
      HasValue(Building, {
        outer_entity_id: realmId,
      }),
    ]);
  }, [Building, realmId]);

  const resourceData = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realmId)]));

  const { currentDefaultTick } = getBlockTimestamp();

  const buildingsData = useBuildings(position.x, position.y);
  const productionBuildings = useMemo(
    () => buildingsData.filter((building) => building && getProducedResource(building.category)),
    [buildingsData],
  );

  const resourceProductionSummary = useMemo<ResourceProductionSummaryItem[]>(() => {
    const summaries = new Map<ResourcesIds, { totalBuildings: number }>();

    productionBuildings.forEach((building) => {
      if (!building?.produced?.resource) return;

      const resourceId = building.produced.resource as ResourcesIds;
      if (resourceId === ResourcesIds.Labor) return;

      const existing = summaries.get(resourceId);
      if (existing) {
        existing.totalBuildings += 1;
      } else {
        summaries.set(resourceId, { totalBuildings: 1 });
      }
    });

    const calculatedAt = Date.now();

    return Array.from(summaries.entries()).map(([resourceId, stats]) => {
      let isProducing = false;
      let timeRemainingSeconds: number | null = null;
      let productionPerSecond: number | null = null;
      let outputRemaining: number | null = null;
      let activeBuildings = 0;

      if (resourceData) {
        const productionInfo = ResourceManager.balanceAndProduction(resourceData, resourceId);
        const productionData = ResourceManager.calculateResourceProductionData(
          resourceId,
          productionInfo,
          currentDefaultTick || 0,
        );
        isProducing = productionData.isProducing;
        if (isProducing) {
          const buildingCount = productionInfo.production.building_count;
          activeBuildings = buildingCount > 0 ? buildingCount : stats.totalBuildings;
        }

        timeRemainingSeconds = Number.isFinite(productionData.timeRemainingSeconds)
          ? productionData.timeRemainingSeconds
          : null;
        productionPerSecond = Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null;
        outputRemaining = Number.isFinite(productionData.outputRemaining) ? productionData.outputRemaining : null;
      }

      return {
        resourceId,
        totalBuildings: stats.totalBuildings,
        activeBuildings,
        isProducing,
        timeRemainingSeconds,
        productionPerSecond,
        outputRemaining,
        calculatedAt,
      };
    });
  }, [productionBuildings, resourceData, currentDefaultTick]);

  const totalProductionBuildings = resourceProductionSummary.reduce(
    (accumulator, summary) => accumulator + summary.totalBuildings,
    0,
  );
  const activeProductionBuildings = resourceProductionSummary.reduce(
    (accumulator, summary) => accumulator + summary.activeBuildings,
    0,
  );
  const hasProduction = resourceProductionSummary.length > 0;

  const headerSegments = useMemo(() => {
    const segments = [
      `${buildings.size} buildings`,
      hasProduction ? `${activeProductionBuildings}/${totalProductionBuildings} producing` : "no production",
    ];
    if (typeLabel) {
      segments.unshift(typeLabel);
    }
    return segments;
  }, [activeProductionBuildings, buildings.size, hasProduction, totalProductionBuildings, typeLabel]);

  return (
    <div className="mt-1 space-y-3 px-1">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-gold/50">
        {headerSegments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span className="text-gold/40">●</span>}
            <span>{segment}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-5">
        {hasProduction ? (
          [...resourceProductionSummary]
            .sort((a, b) => {
              if (a.resourceId === ResourcesIds.Wheat && b.resourceId !== ResourcesIds.Wheat) return -1;
              if (b.resourceId === ResourcesIds.Wheat && a.resourceId !== ResourcesIds.Wheat) return 1;
              return a.resourceId - b.resourceId;
            })
            .map((summary) => {
              const resourceLabel = ResourcesIds[summary.resourceId];
              const metric = metrics?.[summary.resourceId];
              const elapsedSeconds = (currentTime - summary.calculatedAt) / 1000;
              const effectiveRemainingSeconds =
                summary.timeRemainingSeconds !== null
                  ? Math.max(summary.timeRemainingSeconds - elapsedSeconds, 0)
                  : null;
              const isWheat = summary.resourceId === ResourcesIds.Wheat;
              const formattedRemaining =
                !isWheat && summary.isProducing && effectiveRemainingSeconds !== null
                  ? formatTimeRemaining(Math.ceil(effectiveRemainingSeconds))
                  : null;
              const baseTooltipParts = summary.isProducing
                ? [
                    resourceLabel,
                    `${summary.activeBuildings}/${summary.totalBuildings} producing`,
                    formattedRemaining ? `${formattedRemaining} left` : null,
                  ]
                : [
                    resourceLabel,
                    `Idle (${summary.totalBuildings} building${summary.totalBuildings !== 1 ? "s" : ""})`,
                  ];
              const lastRunPart =
                metric && metric.hasLastExecution ? `Last run: ${formatSignedAmount(metric.netAmount)}` : null;
              const tooltipParts = [lastRunPart, ...baseTooltipParts].filter(Boolean);

              const buildingsLabel = String(summary.totalBuildings);
              const netLabel =
                metric && metric.hasLastExecution
                  ? formatSignedAmount(metric.netAmount)
                  : metric
                    ? formatSignedPerSecond(metric.netPerSecond).replace("/s", "")
                    : undefined;
              const cornerBottomRight = formattedRemaining ?? undefined;

              return (
                <ProductionStatusBadge
                  key={summary.resourceId}
                  className="scale-[1.1]"
                  resourceLabel={resourceLabel as string}
                  tooltipText={tooltipParts.join(" • ")}
                  isProducing={summary.isProducing}
                  timeRemainingSeconds={effectiveRemainingSeconds}
                  size="sm"
                  showTooltip={false}
                  cornerTopLeft={buildingsLabel}
                  cornerTopRight={netLabel}
                  cornerBottomRight={cornerBottomRight}
                />
              );
            })
        ) : (
          <span className="text-gold/70">No production buildings</span>
        )}
      </div>
    </div>
  );
};

type ResourceProductionMetrics = {
  resourceId: ResourcesIds;
  outputPerSecond: number;
  netPerSecond: number;
  producedAmount: number;
  consumedAmount: number;
  netAmount: number;
  hasLastExecution: boolean;
  inputBreakdown: { resourceId: ResourcesIds; amount: number }[];
  perSecondInputs: { resourceId: ResourcesIds; perSecond: number }[];
};

type RealmCard = {
  id: string;
  name: string;
  typeLabel: string;
  entityType: "realm" | "village";
  resourceIds: ResourcesIds[];
  position: { x: number; y: number };
  lastRun?: number;
  statusLabel: string;
  metrics: Record<number, ResourceProductionMetrics>;
};

export const ProductionOverviewPanel = () => {
  const [activeTab, setActiveTab] = useState<"realm" | "village">("realm");
  const [searchTerm, setSearchTerm] = useState("");
  const automationRealms = useAutomationStore((state) => state.realms);
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const removeRealm = useAutomationStore((state) => state.removeRealm);
  const hydrated = useAutomationStore((state) => state.hydrated);

  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const {
    setup,
    setup: { components },
  } = useDojo();
  const isBlitz = getIsBlitz();
  const goToStructure = useGoToStructure(setup);
  const { isMapView } = useQuery();
  const autoSelectionRef = useRef<string | null>(null);
  const syncedRealmIdsRef = useRef<Set<string>>(new Set());

  const selectedStructureType = useMemo(() => {
    if (structureEntityId === 0) {
      return null;
    }
    const targetId = String(structureEntityId);
    if (playerVillages.some((village) => String(village.entityId) === targetId)) {
      return StructureType.Village;
    }
    if (playerRealms.some((realm) => String(realm.entityId) === targetId)) {
      return StructureType.Realm;
    }
    return null;
  }, [structureEntityId, playerVillages, playerRealms]);
  const isCampSelected = selectedStructureType === StructureType.Village;

  useEffect(() => {
    if (!hydrated) {
      syncedRealmIdsRef.current.clear();
      return;
    }
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    // If we don't yet have any structures, skip pruning to avoid wiping store during data load.
    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const structureName = getStructureName(structure.structure, isBlitz).name;

      const realmId = String(structure.entityId);
      syncedRealmIdsRef.current.add(realmId);
      upsertRealm(realmId, {
        realmName: structureName,
        entityType,
      });
    });

    Object.entries(useAutomationStore.getState().realms).forEach(([realmId, config]) => {
      const supportedType = config.entityType === "realm" || config.entityType === "village";
      const hasSyncedThisSession = syncedRealmIdsRef.current.has(realmId);
      if (!hasSyncedThisSession) {
        return;
      }
      if (!supportedType || !activeIds.has(realmId)) {
        removeRealm(realmId);
      }
    });
  }, [isBlitz, playerRealms, playerVillages, removeRealm, upsertRealm, hydrated]);

  const realmCards = useMemo<RealmCard[]>(() => {
    const cards: RealmCard[] = [];
    const managedStructures = [...playerRealms, ...playerVillages];
    const { currentDefaultTick } = getBlockTimestamp();

    managedStructures.forEach((realm) => {
      const automation = automationRealms[String(realm.entityId)];
      const realmName = getStructureName(realm.structure, isBlitz).name;
      const producedResources = automation?.resources ?? {};
      const entityType = automation?.entityType ?? "realm";
      let resourceComponent: ReturnType<ResourceManager["getResource"]> | null = null;

      // Derive produced resources from live game state (buildings) to enable presets
      // even before any automation resources are configured.
      let producedFromBuildings: ResourcesIds[] = [];
      try {
        const realmIdNum = Number(realm.entityId);
        if (components && Number.isFinite(realmIdNum) && realmIdNum > 0) {
          const manager = new ResourceManager(components, realmIdNum);
          resourceComponent = manager.getResource();
          if (resourceComponent) {
            const ALL = Object.values(ResourcesIds).filter((v) => typeof v === "number") as ResourcesIds[];
            for (const resId of ALL) {
              const prod = ResourceManager.balanceAndProduction(resourceComponent, resId).production;
              if (prod && prod.building_count > 0) {
                producedFromBuildings.push(resId);
              }
            }
          }
        }
      } catch (_e) {
        // ignore
      }

      const lastExecution = automation?.lastExecution;
      const outputsByResourceMap = new Map<number, number>(
        Object.entries(lastExecution?.outputsByResource ?? {}).map(([key, value]) => [Number(key), Number(value)]),
      );
      const consumptionByResourceMap = new Map<number, number>(
        Object.entries(lastExecution?.consumptionByResource ?? {}).map(([key, value]) => [Number(key), Number(value)]),
      );
      const inputBreakdownByOutput = new Map<number, Map<number, number>>();

      const addInputBreakdown = (
        entry:
          | undefined
          | {
              resourceId?: number;
              inputs?: { resourceId?: number; amount?: number }[];
            },
      ) => {
        if (!entry || entry.resourceId === undefined || !Array.isArray(entry.inputs)) return;
        const outputId = Number(entry.resourceId);
        if (!inputBreakdownByOutput.has(outputId)) {
          inputBreakdownByOutput.set(outputId, new Map());
        }
        const current = inputBreakdownByOutput.get(outputId)!;
        entry.inputs.forEach((input) => {
          if (!input || input.resourceId === undefined || input.amount === undefined) return;
          const inputId = Number(input.resourceId);
          current.set(inputId, (current.get(inputId) ?? 0) + Number(input.amount));
        });
      };

      (lastExecution?.resourceToResource ?? []).forEach(addInputBreakdown);
      (lastExecution?.laborToResource ?? []).forEach(addInputBreakdown);

      const configuredIds = Object.keys(producedResources).map((key) => Number(key));
      const producedKeys = Array.from(outputsByResourceMap.keys());
      const consumedKeys = Array.from(consumptionByResourceMap.keys());
      const uniqueResourceIds = Array.from(
        new Set<number>([...configuredIds, ...producedFromBuildings.map(Number), ...producedKeys, ...consumedKeys]),
      )
        .filter((resourceId) => !isAutomationResourceBlocked(resourceId as ResourcesIds, entityType))
        .sort((a, b) => a - b);

      const perSecondConsumptionTotals = new Map<number, number>();
      const perSecondSummaries = new Map<number, { outputPerSecond: number; perSecondInputs: Map<number, number> }>();

      uniqueResourceIds.forEach((resourceId) => {
        let outputPerSecond = 0;
        const inputAccumulator = new Map<number, number>();

        if (resourceComponent) {
          try {
            const productionInfo = ResourceManager.balanceAndProduction(resourceComponent, resourceId);
            const productionData = ResourceManager.calculateResourceProductionData(
              resourceId,
              productionInfo,
              currentDefaultTick || 0,
            );
            if (Number.isFinite(productionData.productionPerSecond)) {
              outputPerSecond = productionData.productionPerSecond;
            }
          } catch (_error) {
            outputPerSecond = 0;
          }
        }

        if (outputPerSecond > 0) {
          const complexOutput = configManager.complexSystemResourceOutput[resourceId]?.amount ?? 0;
          if (complexOutput > 0) {
            const ratio = outputPerSecond / complexOutput;
            (configManager.complexSystemResourceInputs[resourceId] ?? []).forEach((input) => {
              const perSecond = ratio * input.amount;
              if (Number.isFinite(perSecond) && perSecond > 0) {
                inputAccumulator.set(input.resource, (inputAccumulator.get(input.resource) ?? 0) + perSecond);
              }
            });
          }

          const simpleOutput = configManager.simpleSystemResourceOutput[resourceId]?.amount ?? 0;
          if (simpleOutput > 0) {
            const ratio = outputPerSecond / simpleOutput;
            (configManager.simpleSystemResourceInputs[resourceId] ?? []).forEach((input) => {
              const perSecond = ratio * input.amount;
              if (Number.isFinite(perSecond) && perSecond > 0) {
                inputAccumulator.set(input.resource, (inputAccumulator.get(input.resource) ?? 0) + perSecond);
              }
            });
          }

          const laborOutput = configManager.laborOutputPerResource[resourceId]?.amount ?? 0;
          if (laborOutput > 0) {
            const laborPerSecond = outputPerSecond / laborOutput;
            if (Number.isFinite(laborPerSecond) && laborPerSecond > 0) {
              inputAccumulator.set(
                ResourcesIds.Labor,
                (inputAccumulator.get(ResourcesIds.Labor) ?? 0) + laborPerSecond,
              );
            }
          }
        }

        const inputs = Array.from(inputAccumulator.entries())
          .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
          .map(([inputId, amount]) => ({
            resourceId: Number(inputId) as ResourcesIds,
            perSecond: amount,
          }))
          .sort((a, b) => a.resourceId - b.resourceId);

        inputs.forEach((input) => {
          perSecondConsumptionTotals.set(
            input.resourceId,
            (perSecondConsumptionTotals.get(input.resourceId) ?? 0) + input.perSecond,
          );
        });

        perSecondSummaries.set(resourceId, {
          outputPerSecond,
          perSecondInputs: inputAccumulator,
        });
      });

      const metrics: Record<number, ResourceProductionMetrics> = {};
      uniqueResourceIds.forEach((resourceId) => {
        const perSecondSummary = perSecondSummaries.get(resourceId);
        const outputPerSecond = perSecondSummary?.outputPerSecond ?? 0;
        const perSecondInputs = perSecondSummary
          ? Array.from(perSecondSummary.perSecondInputs.entries())
              .map(([inputId, amount]) => ({
                resourceId: Number(inputId) as ResourcesIds,
                perSecond: amount,
              }))
              .sort((a, b) => a.resourceId - b.resourceId)
          : [];
        const netPerSecond = outputPerSecond - (perSecondConsumptionTotals.get(resourceId) ?? 0);
        const producedAmount = outputsByResourceMap.get(resourceId) ?? 0;
        const consumedAmount = consumptionByResourceMap.get(resourceId) ?? 0;
        const netAmount = producedAmount - consumedAmount;
        const breakdownMap = inputBreakdownByOutput.get(resourceId);
        const inputBreakdown = breakdownMap
          ? Array.from(breakdownMap.entries())
              .map(([inputId, amount]) => ({
                resourceId: Number(inputId) as ResourcesIds,
                amount,
              }))
              .sort((a, b) => a.resourceId - b.resourceId)
          : [];

        metrics[resourceId] = {
          resourceId: resourceId as ResourcesIds,
          outputPerSecond,
          netPerSecond,
          producedAmount,
          consumedAmount,
          netAmount,
          hasLastExecution: Boolean(lastExecution),
          inputBreakdown,
          perSecondInputs,
        };
      });

      const displayedResourceIds = [...uniqueResourceIds].sort((a, b) => a - b).slice(0, 8);

      cards.push({
        id: String(realm.entityId),
        name: realmName,
        entityType,
        typeLabel: entityType === "village" ? (isBlitz ? "Camp" : "Village") : "Realm",
        position: { x: realm.position.x, y: realm.position.y },
        resourceIds: displayedResourceIds,
        lastRun: automation?.lastExecution?.executedAt,
        statusLabel: resolveAutomationStatusLabel(automation),
        metrics,
      });

      // quiet
    });

    return cards.sort((a, b) => a.name.localeCompare(b.name));
  }, [automationRealms, isBlitz, playerRealms, playerVillages]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matches = realmCards.filter((card) => {
      if (activeTab === "realm") {
        return card.entityType === "realm";
      }
      if (activeTab === "village") {
        return card.entityType === "village";
      }
      return true;
    });

    const byName = matches.filter((card) => {
      if (!normalizedSearch) return true;
      return card.name.toLowerCase().includes(normalizedSearch);
    });

    return byName;
  }, [realmCards, activeTab, searchTerm]);

  const totals = useMemo(
    () =>
      realmCards.reduce(
        (acc, card) => {
          if (card.entityType === "realm") {
            acc.realms += 1;
          } else if (card.entityType === "village") {
            acc.villages += 1;
          }
          return acc;
        },
        { realms: 0, villages: 0 },
      ),
    [realmCards],
  );

  const autoSelectionKey = useMemo(() => {
    if (structureEntityId === 0) {
      return "none";
    }
    const baseKey = `${structureEntityId}-${isCampSelected ? "village" : "realm"}`;
    const villageFlag = totals.villages > 0 ? "v1" : "v0";
    const realmFlag = totals.realms > 0 ? "r1" : "r0";
    return `${baseKey}-${villageFlag}-${realmFlag}`;
  }, [structureEntityId, isCampSelected, totals.villages, totals.realms]);

  useEffect(() => {
    if (structureEntityId === 0) {
      autoSelectionRef.current = "none";
      return;
    }

    if (autoSelectionRef.current === autoSelectionKey) {
      return;
    }

    autoSelectionRef.current = autoSelectionKey;

    if (isCampSelected) {
      if (totals.villages > 0 && activeTab !== "village") {
        setActiveTab("village");
      }
      return;
    }

    if (totals.realms > 0 && activeTab !== "realm") {
      setActiveTab("realm");
    }
  }, [activeTab, autoSelectionKey, isCampSelected, structureEntityId, totals.realms, totals.villages]);

  useEffect(() => {
    if (totals.villages === 0 && activeTab === "village") {
      setActiveTab("realm");
    }
  }, [activeTab, totals.villages]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-semibold text-gold">Production Overview</h4>
        <p className="text-[11px] text-gold/60">
          Tap any resource to inspect recent production, or click modify to update the automation.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {[
          { value: "realm" as const, label: `Realms (${totals.realms})`, disabled: false },
          {
            value: "village" as const,
            label: `${isBlitz ? "Camps" : "Villages"} (${totals.villages})`,
            disabled: totals.villages === 0,
          },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              if (tab.disabled) return;
              setActiveTab(tab.value);
            }}
            disabled={tab.disabled}
            className={`rounded border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
              activeTab === tab.value
                ? "border-gold/60 bg-black/25 text-gold"
                : tab.disabled
                  ? "border-gold/20 text-gold/40 cursor-not-allowed"
                  : "border-gold/20 text-gold/60 hover:text-gold"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-48">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Filter by name"
            className="w-full rounded border border-gold/30 bg-black/20 py-1 pl-7 pr-3 text-[11px] text-gold placeholder:text-gold/60 transition focus:border-gold/60 focus:outline-none"
          />
        </div>
      </div>
      {realmCards.length === 0 ? (
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          No production configured yet. Use Modify to set up automation.
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          No matches found. Adjust the filters to see results.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredCards.map((card) => {
            const statusLabel = card.statusLabel;
            const realmIdNum = Number(card.id);
            return (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                className="flex flex-col rounded-lg border border-gold/15 bg-black/25 p-3 text-[12px] text-gold/80 space-y-0 transition hover:border-gold/30 hover:bg-black/30 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60"
                onClick={() => {
                  if (Number.isFinite(realmIdNum) && card.position) {
                    const position = new Position({ x: card.position.x, y: card.position.y });
                    void goToStructure(realmIdNum, position, isMapView);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (Number.isFinite(realmIdNum) && card.position) {
                      const position = new Position({ x: card.position.x, y: card.position.y });
                      void goToStructure(realmIdNum, position, isMapView);
                    }
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3 rounded border border-transparent px-1 py-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-semibold text-gold/90">{card.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProductionStatusPill statusLabel={statusLabel} />
                    <ProductionModifyButton
                      onClick={(event) => {
                        event.stopPropagation();
                        if (Number.isFinite(realmIdNum) && card.position) {
                          const position = new Position({ x: card.position.x, y: card.position.y });
                          void goToStructure(realmIdNum, position, isMapView);
                        }
                        toggleModal(<ProductionModal />);
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1">
                  {Number.isFinite(realmIdNum) && card.position && (
                    <RealmProductionRecap
                      realmId={realmIdNum}
                      position={card.position}
                      metrics={card.metrics}
                      typeLabel={card.typeLabel}
                    />
                  )}
                </div>

                <div className="px-1 mt-5 text-[10px] text-gold/50 text-right self-end">
                  {card.lastRun ? `Last run ${formatRelative(card.lastRun)}` : "Automation has not executed yet."}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
