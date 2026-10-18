import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { configManager, getStructureRelicEffects, ResourceManager } from "@bibliothecadao/eternum";
import { useBuildings } from "@/hooks/helpers/use-buildings";
import { useNativeRowOrAbsent } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { getProducedResource, ID, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { HudButton, HudChip, HudRow, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { REALM_PRESETS, RealmPresetId } from "@bibliothecadao/eternum/automation";
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { ProductionStatusBadge } from "@/ui/shared";

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
  const mode = useGameModeConfig();
  const now = useCurrentDefaultTick();
  const resourceData = useResourceManager(realm.entityId);

  const buildingsData = useBuildings(realm.entityId);
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

    return Array.from(summaries.entries()).map(([resourceId, stats]) => {
      let isProducing = false;
      let timeRemainingSeconds: number | null = null;
      let productionPerSecond: number | null = null;
      let outputRemaining: number | null = null;
      let activeBuildings = 0;

      const productionInfo = resourceData.current(resourceId);
      if (productionInfo) {
        const productionData = ResourceManager.calculateResourceProductionData(resourceId, productionInfo, now);
        isProducing = productionData.isProducing;
        if (isProducing) {
          const buildingCount = productionInfo.production.building_count;
          activeBuildings = buildingCount > 0 ? buildingCount : stats.totalBuildings;
        }

        timeRemainingSeconds = productionData.timeRemainingSeconds;
        productionPerSecond = Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null;
        outputRemaining = productionData.outputRemaining;
      }

      return {
        resourceId,
        totalBuildings: stats.totalBuildings,
        activeBuildings,
        isProducing,
        timeRemainingSeconds,
        productionPerSecond,
        outputRemaining,
      };
    });
  }, [productionBuildings, resourceData, now]);

  const totalProductionBuildings = resourceProductionSummary.reduce(
    (accumulator, summary) => accumulator + summary.totalBuildings,
    0,
  );
  const activeProductionBuildings = resourceProductionSummary.reduce(
    (accumulator, summary) => accumulator + summary.activeBuildings,
    0,
  );
  const hasProduction = resourceProductionSummary.length > 0;

  const productionBoostBonus = useNativeRowOrAbsent("ProductionBonus", {
    game_id: configManager.getActiveGameId(),
    entity_id: realm.entityId,
  });

  const activeRelics = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, now);
  }, [productionBoostBonus, now]);

  if (!productionBoostBonus) return <p>Loading production…</p>;

  return (
    <div className="flex flex-col gap-1">
      <HudRow
        title={mode.structure.getName(realm.structure).name}
        detail={
          hasProduction
            ? `${buildingsData.length} buildings · ${activeProductionBuildings}/${totalProductionBuildings} producing`
            : `${buildingsData.length} buildings · no production`
        }
        trail={
          activeRelics.length > 0 ? (
            <span title={`${activeRelics.length} Active Relics`}>
              <HudChip>{activeRelics.length}</HudChip>
            </span>
          ) : undefined
        }
        selected={isSelected}
        onClick={onSelect}
      />
      <div className="flex flex-wrap items-center gap-2.5 px-1 pt-1">
        {hasProduction ? (
          resourceProductionSummary
            .toSorted((a, b) => {
              // Wheat first, then by resource id ascending
              if (a.resourceId === ResourcesIds.Wheat && b.resourceId !== ResourcesIds.Wheat) return -1;
              if (b.resourceId === ResourcesIds.Wheat && a.resourceId !== ResourcesIds.Wheat) return 1;
              return a.resourceId - b.resourceId;
            })
            .map((summary) => (
              <ProductionStatusBadge
                key={summary.resourceId}
                resource={summary.resourceId}
                isProducing={summary.isProducing}
                timeRemainingSeconds={summary.timeRemainingSeconds}
                buildings={summary.totalBuildings}
                size="xs"
                onClick={() => onSelectResource(realm.entityId, summary.resourceId)}
              />
            ))
        ) : (
          <span className="text-hud-muted">No production buildings</span>
        )}
      </div>
    </div>
  );
};

type AutomationTab = "realm" | "village";

export const ProductionSidebar = memo(
  ({ realms, selectedRealmEntityId, onSelectRealm, onSelectResource }: ProductionSidebarProps) => {
    const upsertRealm = useAutomationStore((state) => state.upsertRealm);
    const setRealmPreset = useAutomationStore((state) => state.setRealmPreset);
    const mode = useGameModeConfig();

    const structuresByType = useMemo(() => {
      const realmStructures: RealmInfo[] = [];
      const campStructures: RealmInfo[] = [];

      realms.forEach((realm) => {
        if (isVillageLikeStructureCategory(realm.structure?.base.category)) {
          campStructures.push(realm);
        } else {
          realmStructures.push(realm);
        }
      });

      return { realm: realmStructures, village: campStructures };
    }, [realms]);

    const realmStructures = structuresByType.realm;
    const villageStructures = structuresByType.village;
    const realmCount = realmStructures.length;
    const villageCount = villageStructures.length;

    const selectedRealmInfo = useMemo(
      () => realms.find((realm) => realm.entityId === selectedRealmEntityId),
      [realms, selectedRealmEntityId],
    );
    const selectedEntityType: AutomationTab = isVillageLikeStructureCategory(
      selectedRealmInfo?.structure?.base.category,
    )
      ? "village"
      : "realm";

    const [activeTab, setActiveTab] = useState<AutomationTab>(() => {
      if (selectedEntityType === "village" && villageCount > 0) {
        return "village";
      }
      return realmCount > 0 ? "realm" : "village";
    });
    const selectionRef = useRef<string | null>(null);

    useEffect(() => {
      const activeStructures = activeTab === "realm" ? realmStructures : villageStructures;
      if (activeStructures.length === 0) {
        if (activeTab === "realm" && villageCount > 0) {
          setActiveTab("village");
        } else if (activeTab === "village" && realmCount > 0) {
          setActiveTab("realm");
        }
      }
    }, [activeTab, realmStructures, villageStructures, realmCount, villageCount]);

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
        }
        return;
      }

      if (realmCount > 0 && activeTab !== "realm") {
        setActiveTab("realm");
      }
    }, [activeTab, autoSelectionKey, selectedEntityType, villageCount, realmCount]);

    const activeStructures = activeTab === "realm" ? realmStructures : villageStructures;
    const activeLabel = activeTab === "realm" ? mode.labels.realms : mode.labels.villages;
    const tabButtons: { key: AutomationTab; label: string; count: number }[] = [
      { key: "realm", label: mode.labels.realms, count: realmCount },
      { key: "village", label: mode.labels.villages, count: villageCount },
    ];

    // A preset applies to every holding of the tab at once: setting another one undoes it, so there is nothing to confirm.
    const applyPreset = (presetId: RealmPresetId) => {
      activeStructures.forEach((realmInfo) => {
        const realmId = realmInfo.entityId.toString();
        const entityType = isVillageLikeStructureCategory(realmInfo.structure?.base.category) ? "village" : "realm";
        const realmName = mode.structure.getName(realmInfo.structure).name;
        upsertRealm(realmId, { realmName, entityType });
        setRealmPreset(realmId, presetId);
      });
    };

    return (
      <div className="flex flex-col gap-3">
        <HudTabs
          tabs={tabButtons.map((tab) => ({
            key: tab.key,
            label: tab.label,
            count: tab.count,
            disabled: tab.count === 0,
          }))}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeStructures.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-hud-label text-hud-muted">Apply preset to all {activeLabel.toLowerCase()}</div>
            <div className="flex flex-wrap gap-1.5">
              {REALM_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => (
                <HudButton
                  key={preset.id}
                  kind="secondary"
                  size="sm"
                  title={preset.description}
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                </HudButton>
              ))}
            </div>
          </div>
        )}

        {activeStructures.length === 0 ? (
          <p className="text-hud-muted">
            {activeTab === "realm"
              ? `You do not control any ${mode.labels.realms.toLowerCase()} yet.`
              : `You do not control any ${mode.labels.villages.toLowerCase()} yet.`}
          </p>
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
