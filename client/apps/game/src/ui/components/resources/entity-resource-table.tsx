import { ResourceChip } from "@/ui/components/resources/resource-chip";

import { getEntityIdFromKeys, getRealmInfo } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { ID, RESOURCE_TIERS, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import React, { useMemo, useState } from "react";

const TIER_DISPLAY_NAMES: Record<string, string> = {
  lords: "Lords & Fragments",
  labor: "Labor",
  military: "Military",
  transport: "Transport",
  food: "Food",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  unique: "Unique",
  mythic: "Mythic",
};

const alwaysShowResources = [
  ResourcesIds.Lords,
  ResourcesIds.Labor,
  ResourcesIds.Donkey,
  ResourcesIds.Fish,
  ResourcesIds.Wheat,
];

export const EntityResourceTable = React.memo(({ entityId }: { entityId: ID | undefined }) => {
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

  const resourceManager = useResourceManager(entityId);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gold/20 p-1">
        <h4>Resources</h4>
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

      <div className="space-y-4">
        {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
          return (
            <div key={tier} className="pb-3">
              <h4 className="text-sm text-gold/80 font-medium mb-2 border-b border-gold/10 pb-1">
                {TIER_DISPLAY_NAMES[tier]}
              </h4>
              <div className="grid grid-cols-1 flex-wrap">
                {resourceIds.map((resourceId: any) => (
                  <ResourceChip
                    key={resourceId}
                    size="large"
                    resourceId={resourceId}
                    resourceManager={resourceManager}
                    hideZeroBalance={!showAllResources && !alwaysShowResources.includes(resourceId)}
                    storageCapacity={realmInfo?.storehouses.capacityKg}
                    storageCapacityUsed={realmInfo?.storehouses.capacityUsedKg}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
