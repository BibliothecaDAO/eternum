import { useResources } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";

export const InventoryResources = ({ entityId }: { entityId: bigint }) => {
  const { getResourcesFromBalance } = useResources();

  const inventoryResources = getResourcesFromBalance(entityId);

  return (
    <div className=" my-3">
      <h5>Inventory</h5>
      {inventoryResources && (
        <div className="flex items-center space-x-1 flex-wrap">
          {inventoryResources.map(
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
