import { getBlockTimestamp, getIsBlitz } from "@bibliothecadao/eternum";
import {
  configManager,
  getEntityIdFromKeys,
  getStructureName,
  getStructureRelicEffects,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { getProducedResource, ID, RealmInfo, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { HasValue, runQuery } from "@dojoengine/recs";
import clsx from "clsx";
import { CheckCircle2Icon, SparklesIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/ui/design-system/atoms/button";
import { REALM_PRESETS, RealmPresetId } from "@/utils/automation-presets";
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { ProductionStatusBadge } from "@/ui/shared";
import { formatTimeRemaining } from "../../economy/resources/entity-resource-table/utils";

interface ProductionSidebarProps {
  realms: RealmInfo[];
  selectedRealmEntityId: ID;
  onSelectRealm: (id: ID) => void;
  onSelectResource: (realmId: ID, resource: ResourcesIds) => void;
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

const SidebarRealm = ({
  realm,
  isSelected,
  onSelect,
  onSelectResource,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  onSelect: () => void;
  onSelectResource: (realmId: ID, resource: ResourcesIds) => void;
}) => {
  const {
    setup: {
      components: { Building, Resource, ProductionBoostBonus },
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
    const buildings = runQuery([
      HasValue(Building, {
        outer_entity_id: realm.entityId,
      }),
    ]);

    return buildings;
  }, [realm]);

  // Get production data
  const resourceData = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const { currentDefaultTick } = getBlockTimestamp();

  const buildingsData = useBuildings(realm.position.x, realm.position.y);
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

      const summary = summaries.get(resourceId);
      if (summary) {
        summary.totalBuildings += 1;
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

  // Get bonuses
  const productionBoostBonus = useComponentValue(ProductionBoostBonus, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const { wonderBonus, hasActivatedWonderBonus } = useMemo(() => {
    const wonderBonusConfig = configManager.getWonderBonusConfig();
    const hasActivatedWonderBonus = productionBoostBonus && productionBoostBonus.wonder_incr_percent_num > 0;
    return {
      wonderBonus: hasActivatedWonderBonus ? 1 + wonderBonusConfig.bonusPercentNum / 10000 : 1,
      hasActivatedWonderBonus,
    };
  }, [productionBoostBonus]);

  const activeRelics = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, getBlockTimestamp().currentArmiesTick);
  }, [productionBoostBonus]);

  return (
    <div
      className={clsx(
        "rounded-lg panel-wood transition-all cursor-pointer border border-transparent",
        "px-3 py-2",
        isSelected ? "border-gold/70 bg-gold/5 shadow-[0_0_18px_rgba(255,204,102,0.45)]" : "hover:bg-gold/5",
      )}
      onClick={onSelect}
      aria-selected={isSelected}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gold">{getStructureName(realm.structure, getIsBlitz()).name}</h3>
            <p className="text-xs text-gold/60">
              {hasProduction
                ? `${buildings.size} buildings • ${activeProductionBuildings}/${totalProductionBuildings} producing`
                : `${buildings.size} buildings • no production`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSelected && (
              <div
                className="flex items-center gap-1 rounded bg-gold/20 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gold shadow-[0_0_12px_rgba(255,204,102,0.25)]"
                title="Selected structure"
              >
                <CheckCircle2Icon className="h-4 w-4" aria-hidden="true" />
                <span>Selected</span>
              </div>
            )}
            {(hasActivatedWonderBonus || activeRelics.length > 0) && (
              <div className="flex gap-1 shrink-0">
                {hasActivatedWonderBonus && (
                  <div
                    className="bg-gold/20 p-1 rounded"
                    title={`Wonder Bonus: +${((wonderBonus - 1) * 100).toFixed(2)}%`}
                  >
                    <SparklesIcon className="w-4 h-4 text-gold" />
                  </div>
                )}
                {activeRelics.length > 0 && (
                  <div className="bg-relic-activated/20 p-1 rounded" title={`${activeRelics.length} Active Relics`}>
                    <span className="text-xs font-bold text-relic-activated">{activeRelics.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasProduction ? (
            [...resourceProductionSummary]
              .sort((a, b) => {
                // Wheat first, then by resource id ascending
                if (a.resourceId === ResourcesIds.Wheat && b.resourceId !== ResourcesIds.Wheat) return -1;
                if (b.resourceId === ResourcesIds.Wheat && a.resourceId !== ResourcesIds.Wheat) return 1;
                return a.resourceId - b.resourceId;
              })
              .map((summary) => {
                const resourceLabel = ResourcesIds[summary.resourceId];
                const elapsedSeconds = (currentTime - summary.calculatedAt) / 1000;
                const effectiveRemainingSeconds =
                  summary.timeRemainingSeconds !== null
                    ? Math.max(summary.timeRemainingSeconds - elapsedSeconds, 0)
                    : null;
                const formattedRemaining =
                  summary.isProducing && effectiveRemainingSeconds !== null
                    ? formatTimeRemaining(Math.ceil(effectiveRemainingSeconds))
                    : null;
                const tooltipParts = summary.isProducing
                  ? [
                      resourceLabel,
                      `${summary.activeBuildings}/${summary.totalBuildings} producing`,
                      formattedRemaining ? `${formattedRemaining} left` : null,
                    ]
                  : [
                      resourceLabel,
                      `Idle (${summary.totalBuildings} building${summary.totalBuildings !== 1 ? "s" : ""})`,
                    ];

                return (
                  <ProductionStatusBadge
                    key={summary.resourceId}
                    resourceLabel={resourceLabel}
                    tooltipText={tooltipParts.filter(Boolean).join(" • ")}
                    isProducing={summary.isProducing}
                    timeRemainingSeconds={effectiveRemainingSeconds}
                    totalCount={summary.totalBuildings}
                    size="sm"
                    onClick={() => onSelectResource(realm.entityId, summary.resourceId)}
                  />
                );
              })
          ) : (
            <span className="text-xs text-gold/60">No production buildings</span>
          )}
        </div>
      </div>
    </div>
  );
};

type AutomationTab = "realm" | "village";

type PendingPresetAction = {
  presetId: RealmPresetId;
  realmIds: string[];
  tab: AutomationTab;
};

  export const ProductionSidebar = memo(
    ({ realms, selectedRealmEntityId, onSelectRealm, onSelectResource }: ProductionSidebarProps) => {
      const upsertRealm = useAutomationStore((state) => state.upsertRealm);
      const setRealmPreset = useAutomationStore((state) => state.setRealmPreset);
      const isBlitz = getIsBlitz();

    const structuresByType = useMemo(() => {
      const realmStructures: RealmInfo[] = [];
      const campStructures: RealmInfo[] = [];

      realms.forEach((realm) => {
        if (realm.structure?.category === StructureType.Village) {
          campStructures.push(realm);
        } else {
          realmStructures.push(realm);
        }
      });

      return { realm: realmStructures, village: campStructures };
    }, [realms]);

    const structureMap = useMemo(() => {
      const map = new Map<string, RealmInfo>();
      realms.forEach((realm) => {
        map.set(realm.entityId.toString(), realm);
      });
      return map;
    }, [realms]);

    const realmStructures = structuresByType.realm;
    const villageStructures = structuresByType.village;
    const realmCount = realmStructures.length;
    const villageCount = villageStructures.length;

    const selectedRealmInfo = useMemo(
      () => realms.find((realm) => realm.entityId === selectedRealmEntityId),
      [realms, selectedRealmEntityId],
    );
    const selectedEntityType: AutomationTab =
      selectedRealmInfo?.structure?.category === StructureType.Village ? "village" : "realm";

    const [activeTab, setActiveTab] = useState<AutomationTab>(() => {
      if (selectedEntityType === "village" && villageCount > 0) {
        return "village";
      }
      return realmCount > 0 ? "realm" : "village";
    });
    const [pendingPreset, setPendingPreset] = useState<PendingPresetAction | null>(null);
    const selectionRef = useRef<string | null>(null);

    useEffect(() => {
      const activeStructures = activeTab === "realm" ? realmStructures : villageStructures;
      if (activeStructures.length === 0) {
        if (activeTab === "realm" && villageCount > 0) {
          setActiveTab("village");
          setPendingPreset(null);
        } else if (activeTab === "village" && realmCount > 0) {
          setActiveTab("realm");
          setPendingPreset(null);
        }
      }
    }, [activeTab, realmStructures, villageStructures, realmCount, villageCount]);

    useEffect(() => {
      if (!pendingPreset) return;
      if (pendingPreset.tab === "realm" && realmCount === 0) {
        setPendingPreset(null);
      }
      if (pendingPreset.tab === "village" && villageCount === 0) {
        setPendingPreset(null);
      }
    }, [pendingPreset, realmCount, villageCount]);

    const autoSelectionKey = useMemo(
      () => `${selectedRealmEntityId}-${selectedEntityType}-${villageCount > 0 ? 1 : 0}-${realmCount > 0 ? 1 : 0}`,
      [selectedRealmEntityId, selectedEntityType, villageCount, realmCount],
    );

    useEffect(() => {
      if (selectionRef.current === autoSelectionKey) {
        return;
      }
      selectionRef.current = autoSelectionKey;

      if (selectedEntityType === "village") {
        if (villageCount > 0 && activeTab !== "village") {
          setActiveTab("village");
          setPendingPreset(null);
        }
        return;
      }

      if (realmCount > 0 && activeTab !== "realm") {
        setActiveTab("realm");
        setPendingPreset(null);
      }
    }, [activeTab, autoSelectionKey, selectedEntityType, villageCount, realmCount]);

    const activeStructures = activeTab === "realm" ? realmStructures : villageStructures;
    const activeLabel = activeTab === "realm" ? "Realms" : isBlitz ? "Camps" : "Villages";
    const tabButtons: { key: AutomationTab; label: string; count: number }[] = [
      { key: "realm", label: "Realms", count: realmCount },
      { key: "village", label: isBlitz ? "Camps" : "Villages", count: villageCount },
    ];

    const handleChangeTab = (tab: AutomationTab) => {
      setActiveTab(tab);
      setPendingPreset(null);
    };

    const handleStagePreset = (presetId: RealmPresetId) => {
      if (activeStructures.length === 0) return;
      const realmIds = activeStructures.map((realm) => realm.entityId.toString());
      setPendingPreset({ presetId, realmIds, tab: activeTab });
    };

    const handleUndoPreset = () => {
      setPendingPreset(null);
    };

    const handleSavePreset = () => {
      if (!pendingPreset || pendingPreset.realmIds.length === 0) return;

      pendingPreset.realmIds.forEach((realmId) => {
        const realmInfo = structureMap.get(realmId);
        if (!realmInfo) return;

        const entityType = realmInfo.structure?.category === StructureType.Village ? "village" : "realm";
        const realmName = getStructureName(realmInfo.structure, isBlitz).name;
        upsertRealm(realmId, { realmName, entityType });
        setRealmPreset(realmId, pendingPreset.presetId);
      });

      setPendingPreset(null);
    };

    const pendingPresetLabel = pendingPreset
      ? (REALM_PRESETS.find((preset) => preset.id === pendingPreset.presetId)?.label ?? "Preset")
      : null;

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            {tabButtons.map((tab) => {
              const isActive = activeTab === tab.key;
              const disabled = tab.count === 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleChangeTab(tab.key)}
                  className={clsx(
                    "rounded border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                    disabled
                      ? "cursor-not-allowed border-gold/10 text-gold/30"
                      : isActive
                        ? "border-gold/60 bg-black/25 text-gold shadow-[0_0_10px_rgba(255,204,102,0.25)]"
                        : "border-gold/20 text-gold/60 hover:border-gold/40 hover:text-gold",
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          {activeStructures.length > 0 && (
            <div className="space-y-2 rounded border border-gold/15 bg-black/10 p-3">
              <div className="text-[10px] uppercase tracking-wide text-gold/50">
                Apply preset to all {activeLabel.toLowerCase()}
              </div>
              <div className="flex flex-wrap gap-2">
                {REALM_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => {
                  const isPending =
                    pendingPreset?.presetId === preset.id && pendingPreset?.tab === activeTab && !!pendingPreset;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleStagePreset(preset.id)}
                      className={clsx(
                        "rounded border px-3 py-1 text-xs transition-colors",
                        activeStructures.length === 0
                          ? "cursor-not-allowed border-gold/10 text-gold/30"
                          : isPending
                            ? "border-gold text-gold bg-gold/10"
                            : "border-gold/30 text-gold/70 hover:border-gold/60 hover:text-gold",
                      )}
                      disabled={activeStructures.length === 0}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {pendingPreset && pendingPreset.tab === activeTab && (
                <div className="flex flex-wrap items-center gap-2 rounded border border-gold/20 bg-black/20 px-3 py-2">
                  <span className="text-xs text-gold/70">
                    Pending {pendingPresetLabel} for {pendingPreset.realmIds.length} {activeLabel.toLowerCase()}.
                  </span>
                  <div className="flex gap-2">
                    <Button variant="gold" size="xs" onClick={handleSavePreset}>
                      Save Changes
                    </Button>
                    <Button variant="outline" size="xs" onClick={handleUndoPreset}>
                      Undo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {activeStructures.length === 0 ? (
          <div className="rounded-lg border border-gold/20 bg-black/15 p-4 text-sm text-gold/70">
            {activeTab === "realm"
              ? "You do not control any realms yet."
              : isBlitz
                ? "You do not control any camps yet."
                : "You do not control any villages yet."}
          </div>
        ) : (
          activeStructures.map((realm) => (
            <SidebarRealm
              key={realm.entityId}
              realm={realm}
              isSelected={realm.entityId === selectedRealmEntityId}
              onSelect={() => onSelectRealm(realm.entityId)}
              onSelectResource={onSelectResource}
            />
          ))
        )}
      </div>
    );
  },
);
