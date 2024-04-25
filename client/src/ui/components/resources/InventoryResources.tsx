import { useResources } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";

export const InventoryResources = ({ entityId }: { entityId: bigint }) => {
  const { getResourcesFromInventory } = useResources();

  const inventoryResources = getResourcesFromInventory(entityId);

  return (
    <div className="flex items-center justify-between mt-[8px] text-xxs">
      {inventoryResources && (
        <div className="flex justify-center items-center space-x-1 flex-wrap">
          {inventoryResources.resources.map(
            (resource) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  type="vertical"
                  color="text-order-brilliance"
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(Number(resource.amount))}
                />
              ),
          )}
        </div>
      )}
    </div>
  );
};
