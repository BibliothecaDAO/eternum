import { RESOURCE_TIER_NAMES } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceChip } from "@/ui/features/economy/resources";
import {
  configManager,
  getBuildingCount,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { useNativeRowOrAbsent, useNativeRow, useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { BuildingType, getBuildingFromResource, ID, ResourcesIds } from "@bibliothecadao/types";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import React, { useCallback, useMemo, useState } from "react";
import { ALWAYS_SHOW_RESOURCES } from "./utils";

interface EntityResourceTableOldProps {
  entityId: ID | undefined;
  disableButtons?: boolean;
}

export const EntityResourceTableOld = React.memo(
  ({ entityId, disableButtons = false }: EntityResourceTableOldProps) => {
    const [showAllResources, setShowAllResources] = useState(false);
    const [showProductionOnly, setShowProductionOnly] = useState(
      () => localStorage.getItem("entityResourceTableShowProductionOnly") === "true",
    );
    const [showMilitaryOnly, setShowMilitaryOnly] = useState(
      () => localStorage.getItem("entityResourceTableShowMilitaryOnly") === "true",
    );
    const [collapsedTiers, setCollapsedTiers] = useState<Record<string, boolean>>(() => {
      try {
        const stored = localStorage.getItem("entityResourceTableCollapsedTiers");
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    });

    const mode = useGameModeConfig();

    const keys = entityId ? { game_id: configManager.getActiveGameId(), entity_id: entityId } : undefined;
    const structureBuildings = useNativeRow("StructureBuildings", keys);
    const productionBoostBonus = useNativeRowOrAbsent("ProductionBonus", keys);
    const guards = useNativeFacts(["Guard"]);
    const now = useCurrentDefaultTick();

    const activeRelicEffects = useMemo(() => {
      const structureArmyRelicEffects = [...guards.store.inGame("Guard", configManager.getActiveGameId())]
        .filter((guard) => entityId !== undefined && guard.structure_id === BigInt(entityId))
        .flatMap((guard) => getStructureArmyRelicEffects(guard, now));
      const structureRelicEffects = productionBoostBonus ? getStructureRelicEffects(productionBoostBonus, now) : [];
      return [...structureRelicEffects, ...structureArmyRelicEffects];
    }, [now, productionBoostBonus, guards, entityId]);

    const resourceManager = useResourceManager(entityId);

    const handleToggleTierVisibility = useCallback((tierKey: string) => {
      setCollapsedTiers((prev) => {
        const next = { ...prev, [tierKey]: !prev[tierKey] };
        localStorage.setItem("entityResourceTableCollapsedTiers", JSON.stringify(next));
        return next;
      });
    }, []);

    if (!entityId || !resourceManager) return <div>No Entity Selected</div>;
    if (!productionBoostBonus) return <div>Loading production…</div>;

    return (
      <div className="flex flex-col gap-3">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-hud-divider bg-hud-surface px-1 pb-2 pt-1">
          <span className="text-hud-label text-hud-muted">Resources</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterToggle
              label="Hide empty"
              checked={!showAllResources}
              onToggle={() => setShowAllResources((prev) => !prev)}
            />
            <FilterToggle
              label="Producing"
              checked={showProductionOnly}
              onToggle={() => {
                const nextValue = !showProductionOnly;
                setShowProductionOnly(nextValue);
                localStorage.setItem("entityResourceTableShowProductionOnly", String(nextValue));
              }}
            />
            <FilterToggle
              label="Military"
              checked={showMilitaryOnly}
              onToggle={() => {
                const nextValue = !showMilitaryOnly;
                setShowMilitaryOnly(nextValue);
                localStorage.setItem("entityResourceTableShowMilitaryOnly", String(nextValue));
              }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(mode.resources.getTiers()).map(([tier, resourceIds]) => {
            const resourcesForTier = (resourceIds as ResourcesIds[]).filter((resourceId: ResourcesIds) => {
              const alwaysShow = ALWAYS_SHOW_RESOURCES.includes(resourceId);
              const balance = resourceManager.balanceWithProduction(now, resourceId)?.balance;

              if (!showAllResources && !alwaysShow && (balance === undefined || balance <= 0)) {
                return false;
              }

              if (showProductionOnly) {
                const productionInfo = resourceManager.current(resourceId);
                if (!productionInfo) return false;
                const { isProducing } = ResourceManager.calculateResourceProductionData(
                  resourceId,
                  productionInfo,
                  now,
                );

                if (!isProducing) {
                  return false;
                }
              }

              if (showMilitaryOnly && !isMilitaryResource(resourceId)) {
                return false;
              }

              return true;
            });

            if (resourcesForTier.length === 0) {
              return null;
            }

            const isCollapsed = collapsedTiers[tier] ?? false;

            return (
              <div key={tier}>
                <button
                  type="button"
                  onClick={() => handleToggleTierVisibility(tier)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between border-b border-hud-divider px-1 pb-1 text-left"
                >
                  <span className="text-hud-label text-hud-muted">
                    {RESOURCE_TIER_NAMES[tier as keyof typeof RESOURCE_TIER_NAMES]}
                  </span>
                  <span className="flex items-center gap-1 text-hud-label text-hud-cue">
                    {resourcesForTier.length}
                    <SemanticIcon
                      name="chevron-down"
                      className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")}
                    />
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    {resourcesForTier.map((resourceId) => {
                      const buildingType = getBuildingFromResource(resourceId);
                      const hasProductionBuilding =
                        !!structureBuildings &&
                        buildingType !== BuildingType.None &&
                        (getBuildingCount(buildingType, [
                          structureBuildings.packed_counts_1 || 0n,
                          structureBuildings.packed_counts_2 || 0n,
                          structureBuildings.packed_counts_3 || 0n,
                        ]) || 0) > 0;

                      return (
                        <ResourceChip
                          key={resourceId}
                          resourceId={resourceId}
                          resourceManager={resourceManager}
                          hideZeroBalance={!showAllResources && !ALWAYS_SHOW_RESOURCES.includes(resourceId)}
                          activeRelicEffects={activeRelicEffects}
                          canOpenProduction={hasProductionBuilding}
                          disableButtons={disableButtons}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

/** One filter in the balances header: a small toggle that stays pressed while it is on. */
const FilterToggle = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) => (
  <HudButton kind="secondary" size="sm" aria-pressed={checked} onClick={onToggle}>
    {label}
  </HudButton>
);
