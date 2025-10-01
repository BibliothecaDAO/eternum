import { ResourceChip } from "@/ui/features/economy/resources";
import { formatStorageValue } from "@/ui/utils/storage-utils";
import {
  getBlockTimestamp,
  getBuildingCount,
  getEntityIdFromKeys,
  getIsBlitz,
  getRealmInfo,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  isMilitaryResource,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { BuildingType, getBuildingFromResource, getResourceTiers, ID, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { ALWAYS_SHOW_RESOURCES, TIER_DISPLAY_NAMES } from "./utils";

interface EntityResourceTableOldProps {
  entityId: ID | undefined;
}

export const EntityResourceTableOld = React.memo(({ entityId }: EntityResourceTableOldProps) => {
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

  if (!entityId || entityId === 0) {
    return <div>No Entity Selected</div>;
  }

  const resources = useComponentValue(setup.components.Resource, getEntityIdFromKeys([BigInt(entityId)]));

  const structureBuildings = useComponentValue(
    setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(entityId)]),
  );

  const realmInfo = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), setup.components),
    [entityId, structureBuildings, resources, setup.components],
  );

  const productionBoostBonus = useComponentValue(
    setup.components.ProductionBoostBonus,
    getEntityIdFromKeys([BigInt(entityId)]),
  );

  const structure = useComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(entityId)]));

  const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

  const activeRelicEffects = useMemo(() => {
    const structureArmyRelicEffects = structure ? getStructureArmyRelicEffects(structure, currentArmiesTick) : [];
    const structureRelicEffects = productionBoostBonus
      ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick)
      : [];
    return [...structureRelicEffects, ...structureArmyRelicEffects];
  }, [currentArmiesTick, productionBoostBonus, structure]);

  const resourceManager = useResourceManager(entityId);

  const storageOverview = useMemo(() => {
    if (!realmInfo?.storehouses) return null;

    const capacityKg = realmInfo.storehouses.capacityKg || 0;
    const capacityUsedKg = realmInfo.storehouses.capacityUsedKg || 0;
    const storehouseCount = realmInfo.storehouses.quantity || 0;

    if (capacityKg === 0 && capacityUsedKg === 0 && storehouseCount === 0) {
      return null;
    }

    return {
      capacityKg,
      capacityUsedKg,
      remainingKg: Math.max(0, capacityKg - capacityUsedKg),
      storehouseCount,
    };
  }, [realmInfo?.storehouses]);

  const storageWarning =
    storageOverview && storageOverview.capacityKg > 0
      ? storageOverview.remainingKg / storageOverview.capacityKg <= 0.15
      : false;
  const formattedStorageCapacity = storageOverview ? formatStorageValue(storageOverview.capacityKg) : null;
  const formattedStorageUsed = storageOverview ? formatStorageValue(storageOverview.capacityUsedKg) : null;
  const formattedStorageRemaining =
    storageOverview && formattedStorageCapacity
      ? formatStorageValue(storageOverview.remainingKg, { forceInfinite: formattedStorageCapacity.isInfinite })
      : null;

  const handleToggleTierVisibility = useCallback((tierKey: string) => {
    setCollapsedTiers((prev) => {
      const next = { ...prev, [tierKey]: !prev[tierKey] };
      localStorage.setItem("entityResourceTableCollapsedTiers", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 -mx-2 -mt-2 px-2 pt-3 pb-2 border-b border-gold/20 bg-dark-wood/95 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gold">Resources</h4>
            <p className="text-[11px] text-gold/60">Entity #{entityId}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 text-[11px] text-gold/70">
              <span className={clsx(!showAllResources && "text-gold")}>Hide empty</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={!showAllResources}
                  onChange={() => setShowAllResources((prev) => !prev)}
                />
                <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                  <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                </div>
              </div>
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 text-[11px] text-gold/70">
              <span className={clsx(showProductionOnly && "text-gold")}>Production only</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={showProductionOnly}
                  onChange={() => {
                    const nextValue = !showProductionOnly;
                    setShowProductionOnly(nextValue);
                    localStorage.setItem("entityResourceTableShowProductionOnly", String(nextValue));
                  }}
                />
                <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                  <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                </div>
              </div>
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 text-[11px] text-gold/70">
              <span className={clsx(showMilitaryOnly && "text-gold")}>Military only</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={showMilitaryOnly}
                  onChange={() => {
                    const nextValue = !showMilitaryOnly;
                    setShowMilitaryOnly(nextValue);
                    localStorage.setItem("entityResourceTableShowMilitaryOnly", String(nextValue));
                  }}
                />
                <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                  <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                </div>
              </div>
            </label>
          </div>
        </div>
        {storageOverview && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gold/70">
            <div className="flex items-center gap-2">
              <span className="uppercase font-semibold text-gold/80">Remaining Storage</span>
              <span className={clsx("font-semibold", storageWarning ? "text-red" : "text-green")}>
                {formattedStorageRemaining?.isInfinite
                  ? formattedStorageRemaining.display
                  : `${formattedStorageRemaining?.display ?? "0"} kg`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="text-gold/50">Used</span>
                <span className="text-gold">
                  {formattedStorageUsed?.isInfinite
                    ? formattedStorageUsed.display
                    : `${formattedStorageUsed?.display ?? "0"} kg`}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gold/50">Total</span>
                <span className="text-gold">
                  {formattedStorageCapacity?.isInfinite
                    ? formattedStorageCapacity.display
                    : `${formattedStorageCapacity?.display ?? "0"} kg`}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gold/50">Storehouses</span>
                <span className="text-gold">{storageOverview.storehouseCount}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-2">
        {Object.entries(getResourceTiers(getIsBlitz())).map(([tier, resourceIds]) => {
          const resourcesForTier = (resourceIds as ResourcesIds[]).filter((resourceId: ResourcesIds) => {
            const alwaysShow = ALWAYS_SHOW_RESOURCES.includes(resourceId);
            const { balance } = resourceManager.balanceWithProduction(currentDefaultTick, resourceId);

            if (!showAllResources && !alwaysShow && balance <= 0) {
              return false;
            }

            if (showProductionOnly && !resourceManager.isActive(resourceId)) {
              return false;
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
            <div key={tier} className="pb-3">
              <button
                type="button"
                onClick={() => handleToggleTierVisibility(tier)}
                className="flex w-full items-center justify-between border-b border-gold/10 pb-1 text-left text-sm font-medium text-gold/80"
              >
                <span>{TIER_DISPLAY_NAMES[tier]}</span>
                <span className="flex items-center gap-2 text-[11px] text-gold/60">
                  {resourcesForTier.length}
                  {isCollapsed ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                </span>
              </button>

              {!isCollapsed && (
                <div className="mt-3 grid grid-cols-1 gap-2">
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
                        storageCapacity={realmInfo?.storehouses.capacityKg}
                        storageCapacityUsed={realmInfo?.storehouses.capacityUsedKg}
                        activeRelicEffects={activeRelicEffects}
                        canOpenProduction={hasProductionBuilding}
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
});
