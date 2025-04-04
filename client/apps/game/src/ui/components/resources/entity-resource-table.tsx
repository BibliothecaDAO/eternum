import { ResourceChip } from "@/ui/components/resources/resource-chip";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  BuildingType,
  getBuildingQuantity,
  getRealmInfo,
  ID,
  RESOURCE_TIERS,
  StructureType,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import React, { useMemo } from "react";

export const EntityResourceTable = React.memo(({ entityId }: { entityId: ID | undefined }) => {
  const dojo = useDojo();

  const quantity = entityId ? getBuildingQuantity(entityId, BuildingType.Storehouse, dojo.setup.components) : 0;

  const structure = getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));

  const maxStorehouseCapacityKg = useMemo(() => {
    if (structure?.base.category !== StructureType.Realm) return Infinity;
    if (!entityId) return 0;
    const capacity = getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), dojo.setup.components)?.storehouses
      .capacityKg;
    return capacity || 0;
  }, [quantity, entityId]);

  if (!entityId || entityId === 0) {
    return <div>No Entity Selected</div>;
  }

  const resourceManager = useResourceManager(entityId);

  return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
    const resources = resourceIds.map((resourceId: any) => (
      <ResourceChip
        key={resourceId}
        size="large"
        resourceId={resourceId}
        resourceManager={resourceManager}
        maxCapacityKg={maxStorehouseCapacityKg}
      />
    ));

    return (
      <div key={tier}>
        <div className="grid grid-cols-1 flex-wrap">{resources}</div>
      </div>
    );
  });
});
