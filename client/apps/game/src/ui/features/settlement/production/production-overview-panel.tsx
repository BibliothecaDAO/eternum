import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { isAutomationResourceBlocked, useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionModal } from "@/ui/features/settlement";
import {
  configManager,
  getBlockTimestamp,
  getIsBlitz,
  getStructureName,
  Position,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo, useQuery } from "@bibliothecadao/react";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

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
  const [expandedRealmId, setExpandedRealmId] = useState<string | null>(null);

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
  const handleToggleRealm = useCallback((realmId: string) => {
    setExpandedRealmId((current) => (current === realmId ? null : realmId));
  }, []);
  const autoSelectionRef = useRef<string | null>(null);

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
    if (!hydrated) return;
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    // If we don't yet have any structures, skip pruning to avoid wiping store during data load.
    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const structureName = getStructureName(structure.structure, isBlitz).name;

      upsertRealm(String(structure.entityId), {
        realmName: structureName,
        entityType,
      });
    });

    Object.entries(useAutomationStore.getState().realms).forEach(([realmId, config]) => {
      const supportedType = config.entityType === "realm" || config.entityType === "village";
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

      const statusLabel = (() => {
        if (!automation) {
          return "Burning labor";
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
      })();

      cards.push({
        id: String(realm.entityId),
        name: realmName,
        entityType,
        typeLabel: entityType === "village" ? (isBlitz ? "Camp" : "Village") : "Realm",
        position: { x: realm.position.x, y: realm.position.y },
        resourceIds: displayedResourceIds,
        lastRun: automation?.lastExecution?.executedAt,
        statusLabel,
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
        <h4 className="text-sm font-semibold text-gold">Production Automation Overview</h4>
        <p className="text-[11px] text-gold/60">
          Tap any realm to inspect recent production, or click Modify to update the production automation.
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
            const isExpanded = expandedRealmId === card.id;
            const statusLabel = card.statusLabel;
            const handleKeyToggle = (event: ReactKeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleToggleRealm(card.id);
              }
            };
            return (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => handleToggleRealm(card.id)}
                onKeyDown={handleKeyToggle}
                className={`rounded border border-gold/10 bg-black/20 p-3 text-xs text-gold/80 space-y-3 transition cursor-pointer focus:outline-none focus-visible:border-gold/50 ${
                  isExpanded
                    ? "border-gold/30 bg-black/15 shadow-[0_0_12px_rgba(255,204,102,0.15)]"
                    : "hover:border-gold/20 hover:bg-black/25"
                }`}
              >
                <div className="flex items-center justify-between gap-3 rounded border border-transparent px-1 py-1 transition">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gold/90">{card.name}</span>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-gold/50">
                      <span>{card.typeLabel}</span>
                      <span className="text-gold/40">●</span>
                      <span>{isExpanded ? "Tap to hide" : "Tap to expand"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-gold/20 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold/70">
                      {statusLabel}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-gold bg-gold px-2 py-0.5 text-[10px] uppercase tracking-wide text-black font-semibold transition-colors hover:bg-[#ffd84a] hover:border-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
                      onClick={(event) => {
                        event.stopPropagation();
                        const realmIdNum = Number(card.id);
                        if (Number.isFinite(realmIdNum) && card.position) {
                          const position = new Position({ x: card.position.x, y: card.position.y });
                          void goToStructure(realmIdNum, position, isMapView);
                        }
                        toggleModal(<ProductionModal />);
                      }}
                    >
                      Modify
                    </button>
                  </div>
                </div>

                {card.resourceIds.length === 0 ? (
                  <div className="rounded border border-gold/15 bg-black/20 px-3 py-2 text-[11px] text-gold/60">
                    No automated resources
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {card.resourceIds.map((resourceId) => {
                      const metrics = card.metrics[resourceId];
                      const hasLastRun = metrics?.hasLastExecution ?? false;
                      const hasDeficit = hasLastRun
                        ? (metrics?.netAmount ?? 0) <= 0
                        : (metrics?.netPerSecond ?? 0) <= 0;
                      const netLabel = hasLastRun
                        ? `Last run: ${formatSignedAmount(metrics?.netAmount ?? 0)}`
                        : `Net rate ${formatSignedPerSecond(metrics?.netPerSecond ?? 0)}`;

                      return (
                        <div
                          key={`${card.id}-${resourceId}`}
                          className="rounded border border-gold/15 bg-black/25 p-3 space-y-2 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" />
                              <span className="text-sm font-semibold text-gold">{ResourcesIds[resourceId]}</span>
                            </div>
                            <span
                              className={`text-[11px] font-semibold ${hasDeficit ? "text-red/80" : "text-gold/70"}`}
                            >
                              {netLabel}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="space-y-2 text-[11px] text-gold/70">
                              {hasLastRun ? (
                                <>
                                  <div>Produced {formatAmount(metrics?.producedAmount ?? 0)}</div>
                                  <div>Consumed {formatAmount(metrics?.consumedAmount ?? 0)}</div>
                                  <div className={`${hasDeficit ? "text-red/80" : "text-gold/70"}`}>
                                    Last run: {formatSignedAmount(metrics?.netAmount ?? 0)}
                                  </div>
                                </>
                              ) : (
                                <div>No automation run recorded yet.</div>
                              )}
                              <div className="text-[10px] text-gold/50">
                                Net rate {formatSignedPerSecond(metrics?.netPerSecond ?? 0)}
                              </div>
                              {hasLastRun && metrics && metrics.inputBreakdown.length > 0 ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-wide text-gold/50">
                                    Inputs (last run)
                                  </span>
                                  <div className="grid grid-cols-2 gap-1">
                                    {metrics.inputBreakdown.map((input) => (
                                      <div
                                        key={`input-${card.id}-${resourceId}-${input.resourceId}`}
                                        className="flex items-center justify-between rounded border border-gold/15 bg-black/20 px-2 py-1 text-[10px] text-gold/70"
                                      >
                                        <span className="flex items-center gap-1">
                                          <ResourceIcon resource={ResourcesIds[input.resourceId]} size="xs" />
                                          {ResourcesIds[input.resourceId]}
                                        </span>
                                        <span className="text-red/70">-{formatAmount(input.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : !hasLastRun && metrics && metrics.perSecondInputs.length > 0 ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-wide text-gold/50">
                                    Inputs (per second estimate)
                                  </span>
                                  <div className="grid grid-cols-2 gap-1">
                                    {metrics.perSecondInputs.map((input) => (
                                      <div
                                        key={`input-${card.id}-${resourceId}-${input.resourceId}`}
                                        className="flex items-center justify-between rounded border border-gold/15 bg-black/20 px-2 py-1 text-[10px] text-gold/70"
                                      >
                                        <span className="flex items-center gap-1">
                                          <ResourceIcon resource={ResourcesIds[input.resourceId]} size="xs" />
                                          {ResourcesIds[input.resourceId]}
                                        </span>
                                        <span className="text-red/70">-{formatPerSecondValue(input.perSecond)}/s</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gold/60">No resource inputs recorded.</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-[10px] text-gold/50">
                  {card.lastRun
                    ? `Latest automation run ${formatRelative(card.lastRun)} (${formatTimestamp(card.lastRun)})`
                    : "Automation has not executed yet."}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
