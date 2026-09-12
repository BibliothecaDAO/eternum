import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { ResourceChip } from "@/ui/features/economy/resources";
import {
  getBuildingCount,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { BuildingType, getBuildingFromResource, ID, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import React, { useCallback, useMemo, useState } from "react";
import { ALWAYS_SHOW_RESOURCES, TIER_DISPLAY_NAMES } from "./utils";
import { gameEntityKey } from "@bibliothecadao/eternum/game-client";

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

    const { setup } = useDojo();
    const mode = useGameModeConfig();

    if (!entityId || entityId === 0) {
      return <div>No Entity Selected</div>;
    }

    const resources = useComponentValue(setup.components.Resource, gameEntityKey([BigInt(entityId)]));

    const structureBuildings = useComponentValue(
      setup.components.StructureBuildings,
      gameEntityKey([BigInt(entityId)]),
    );

    const productionBoostBonus = useComponentValue(
      setup.components.ProductionBoostBonus,
      gameEntityKey([BigInt(entityId)]),
    );

    const structure = useComponentValue(setup.components.Structure, gameEntityKey([BigInt(entityId)]));

    const { currentDefaultTick, currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
    const currentTick = currentDefaultTick || 0;

    const activeRelicEffects = useMemo(() => {
      const structureArmyRelicEffects = structure ? getStructureArmyRelicEffects(structure, currentArmiesTick) : [];
      const structureRelicEffects = productionBoostBonus
        ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick)
        : [];
      return [...structureRelicEffects, ...structureArmyRelicEffects];
    }, [currentArmiesTick, productionBoostBonus, structure]);

    const resourceManager = useResourceManager(entityId);

    const handleToggleTierVisibility = useCallback((tierKey: string) => {
      setCollapsedTiers((prev) => {
        const next = { ...prev, [tierKey]: !prev[tierKey] };
        localStorage.setItem("entityResourceTableCollapsedTiers", JSON.stringify(next));
        return next;
      });
    }, []);

    return (
      <div className="flex flex-col gap-3">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-gold/15 bg-[#101c23]/95 px-1 pb-2 pt-1 backdrop-blur">
          <span className={HUD_LABEL}>Resources</span>
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
              const { balance } = resourceManager.balanceWithProduction(currentTick, resourceId);

              if (!showAllResources && !alwaysShow && balance <= 0) {
                return false;
              }

              if (showProductionOnly) {
                const resourceComponent = resources;

                if (!resourceComponent) {
                  return false;
                }

                const productionInfo = ResourceManager.balanceAndProduction(resourceComponent, resourceId);
                const { isProducing } = ResourceManager.calculateResourceProductionData(
                  resourceId,
                  productionInfo,
                  currentTick,
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
                  className="flex w-full items-center justify-between border-b border-gold/10 px-1 pb-1 text-left"
                >
                  <span className={HUD_LABEL}>{TIER_DISPLAY_NAMES[tier]}</span>
                  <span className={cn(HUD_CUE, "flex items-center gap-1")}>
                    {resourcesForTier.length}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
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
                          size="large"
                          resourceId={resourceId}
                          resourceManager={resourceManager}
                          hideZeroBalance={!showAllResources && !ALWAYS_SHOW_RESOURCES.includes(resourceId)}
                          activeRelicEffects={activeRelicEffects}
                          canOpenProduction={hasProductionBuilding}
                          disableButtons={disableButtons}
                          currentDefaultTick={currentDefaultTick}
                          currentArmiesTick={currentArmiesTick}
                          armiesTickTimeRemaining={armiesTickTimeRemaining}
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

/** One filter switch in the balances header: a small caps label that lights while it is on. */
const FilterToggle = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onToggle}
    className={cn(
      "rounded-md border px-2 py-1 transition",
      HUD_CUE,
      checked ? "border-gold/60 bg-gold/15 text-gold" : "border-gold/15 bg-black/20 hover:border-gold/40",
    )}
  >
    {label}
  </button>
);
