import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import useUIStore from "@/hooks/store/useUIStore";
import { getEntityIdFromKeys, gramToKg, multiplyByPrecision } from "@/ui/utils/utils";
import { BuildingType, CapacityConfigCategory, ID, RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { ResourceChip } from "./ResourceChip";

export const EntityResourceTable = ({ entityId }: { entityId: ID | undefined }) => {
  const dojo = useDojo();

  const tick = useUIStore((state) => state.currentDefaultTick);

  if (!entityId) {
    return <div>No Entity Selected</div>; // Early return for undefined entityId
  }

  const quantity =
    useComponentValue(
      dojo.setup.components.BuildingQuantityv2,
      getEntityIdFromKeys([BigInt(entityId || 0), BigInt(BuildingType.Storehouse)]),
    )?.value || 0;

  const maxStorehouseCapacityKg = useMemo(() => {
    const storehouseCapacityKg = gramToKg(configManager.getCapacityConfig(CapacityConfigCategory.Storehouse));
    return multiplyByPrecision(quantity * storehouseCapacityKg + storehouseCapacityKg);
  }, [quantity, entityId]);

  if (entityId === undefined || entityId === null) {
    return <div>No Entity Selected</div>;
  }
  return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
    const resources = resourceIds.map((resourceId: any) => (
      <ResourceChip
        key={resourceId}
        resourceId={resourceId}
        entityId={entityId}
        maxStorehouseCapacityKg={maxStorehouseCapacityKg}
        tick={tick}
      />
    ));

    return (
      <div key={tier}>
        <div className="grid grid-cols-1 flex-wrap">{resources}</div>
      </div>
    );
  });
};
