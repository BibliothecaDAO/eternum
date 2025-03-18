import { ResourceChip } from "@/ui/components/resources/resource-chip";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  BuildingType,
  CapacityConfig,
  configManager,
  getBuildingQuantity,
  ID,
  multiplyByPrecision,
  RESOURCE_TIERS,
  StructureType,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const EntityResourceTable = ({ entityId }: { entityId: ID | undefined }) => {
  const dojo = useDojo();

  const quantity = entityId ? getBuildingQuantity(entityId, BuildingType.Storehouse, dojo.setup.components) : 0;

  const structure = getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));

  const maxStorehouseCapacityKg = useMemo(() => {
    if (structure?.base.category !== StructureType.Realm) return Infinity;
    const storehouseCapacityKg = configManager.getCapacityConfigKg(CapacityConfig.Storehouse);
    return multiplyByPrecision(quantity * storehouseCapacityKg + storehouseCapacityKg);
  }, [quantity, entityId]);

  if (!entityId || entityId === 0) {
    return <div>No Entity Selected</div>;
  }

  const resourceManager = useResourceManager(entityId);

  return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
    const resources = resourceIds.map((resourceId: any) => (
      <ResourceChip
        key={resourceId}
        resourceId={resourceId}
        resourceManager={resourceManager}
        maxStorehouseCapacityKg={maxStorehouseCapacityKg}
      />
    ));

    return (
      <div key={tier}>
        <div className="grid grid-cols-1 flex-wrap">{resources}</div>
      </div>
    );
  });
};
