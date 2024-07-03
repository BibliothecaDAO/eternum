import { useResources } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";

export const InventoryResources = ({
  entityId,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  setShowAll,
}: {
  entityId: bigint;
  max?: number;
  className?: string;
  setShowAll?: (showAll: boolean) => void;
}) => {
  const { getResourcesFromBalance } = useResources();

  const inventoryResources = getResourcesFromBalance(entityId);

  return (
    inventoryResources &&
    inventoryResources.length > 0 && (
      <div className="p-2 bg-gold/10 clip-angled my-4">
        <div className={className}>
          {inventoryResources
            .slice(0, max)
            .map(
              (resource) =>
                resource && (
                  <ResourceCost
                    size="sm"
                    textSize="xs"
                    key={resource.resourceId}
                    type="vertical"
                    color="text-green"
                    resourceId={resource.resourceId}
                    amount={divideByPrecision(Number(resource.amount))}
                  />
                ),
            )}
          <div className="ml-1 font-bold hover:opacity-70">
            {max < inventoryResources.length && (
              <div onClick={() => setShowAll && setShowAll(true)}>+{inventoryResources.length - max}</div>
            )}
            {max === Infinity && Boolean(setShowAll) && <div onClick={() => setShowAll!(false)}>hide</div>}
          </div>
        </div>
      </div>
    )
  );
};
