import { ResourceChip } from "@/ui/features/economy/resources";
import {
  getBlockTimestamp,
  getBuildingCount,
  getEntityIdFromKeys,
  getIsBlitz,
  getRealmInfo,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { BuildingType, getBuildingFromResource, getResourceTiers, ID, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import React, { useMemo, useState } from "react";
import { ALWAYS_SHOW_RESOURCES, TIER_DISPLAY_NAMES } from "./utils";

interface EntityResourceTableOldProps {
  entityId: ID | undefined;
}

export const EntityResourceTableOld = React.memo(({ entityId }: EntityResourceTableOldProps) => {
  const [showAllResources, setShowAllResources] = useState(false);

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
    [entityId, structureBuildings, resources],
  );

  const productionBoostBonus = useComponentValue(
    setup.components.ProductionBoostBonus,
    getEntityIdFromKeys([BigInt(entityId)]),
  );

  const structure = useComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(entityId)]));

  const activeRelicEffects = useMemo(() => {
    const currentTick = getBlockTimestamp().currentArmiesTick;
    const structureArmyRelicEffects = structure ? getStructureArmyRelicEffects(structure, currentTick) : [];
    const structureRelicEffects = productionBoostBonus
      ? getStructureRelicEffects(productionBoostBonus, currentTick)
      : [];
    return [...structureRelicEffects, ...structureArmyRelicEffects];
  }, [productionBoostBonus, structure]);

  const resourceManager = useResourceManager(entityId);

  return (
    <div>
      <div className="flex justify-between items-center pb-2 border-b border-gold/20 p-1">
        <h4>Resources</h4>
        <div className="flex gap-2 items-center">
          <label className="inline-flex items-center cursor-pointer">
            <span className={`mr-2 text-xxs ${showAllResources ? "text-gold/50" : ""}`}>Hide Empty</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={!showAllResources}
                onChange={() => setShowAllResources(!showAllResources)}
              />
              <div className="w-9 h-5 bg-brown/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/30"></div>
            </div>
          </label>
        </div>
      </div>

      {/* <div className=" text-gold font-medium border-b pt-2 border-gold/10 pb-3 sticky -top-2 left-0 w-full bg-dark-wood z-10 flex justify-between">
        <div className="flex items-center gap-2">
          <div className="text-gold h6">Remaining Storage:</div>
          <div className="text-gold/80">
            {isStorageFull ? (
              <div className="text-red/80">Out of Storage!</div>
            ) : (
              <div className="text-green/80 text-xl">
                {storageRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}kg
              </div>
            )}
          </div>
        </div>
      </div> */}

      <div className="space-y-4">
        {Object.entries(getResourceTiers(getIsBlitz())).map(([tier, resourceIds]) => {
          return (
            <div key={tier} className="pb-3">
              <h4 className="text-sm text-gold/80 font-medium mb-2 border-b border-gold/10 pb-1">
                {TIER_DISPLAY_NAMES[tier]}
              </h4>
              <div className="grid grid-cols-1 flex-wrap">
                {resourceIds.map((resourceId: any) => {
                  const buildingType = getBuildingFromResource(resourceId as ResourcesIds);
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
            </div>
          );
        })}
      </div>
    </div>
  );
});
