import { useResourceBalance, useResources } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";

export const InventoryResources = ({
  entityId,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  setShowAll,
  dynamic = [],
}: {
  entityId: bigint;
  max?: number;
  className?: string;
  setShowAll?: (showAll: boolean) => void;
  dynamic?: ResourcesIds[];
}) => {
  const { getResourcesFromBalance } = useResources();
  const { getBalance } = useResourceBalance();

  const inventoryResources = getResourcesFromBalance(entityId);

  const dynamicResources = dynamic.map((resourceId): { resourceId: number; balance: number } =>
    getBalance(entityId, resourceId),
  );

  return (inventoryResources && inventoryResources.length > 0) || (dynamicResources && dynamicResources.length > 0) ? (
    <div className={`p-2 bg-gold/10 clip-angled ${className}`}>
      {dynamicResources &&
        dynamicResources.length > 0 &&
        dynamicResources
          .slice(0, max - dynamicResources.length)
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
                  amount={divideByPrecision(Number(resource.balance))}
                />
              ),
          )}
      {inventoryResources
        .slice(0, max - dynamicResources.length)
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
  ) : (
    <></>
  );
};
