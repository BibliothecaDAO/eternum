import { useResourceBalance, useResources } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

export const InventoryResources = ({
  entityId,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  dynamic = [],
  resourcesIconSize = "sm",
}: {
  entityId: bigint;
  max?: number;
  className?: string;
  dynamic?: ResourcesIds[];
  resourcesIconSize?: "xs" | "sm" | "md" | "lg";
}) => {
  const [showAll, setShowAll] = useState(false);
  const { getResourcesFromBalance } = useResources();
  const { getBalance } = useResourceBalance();

  const inventoryResources = getResourcesFromBalance(entityId);

  const dynamicResources = dynamic.map((resourceId): { resourceId: number; balance: number } =>
    getBalance(entityId, resourceId),
  );

  const updatedMax = useMemo(() => {
    if (showAll) return Infinity;
    return max;
  }, [showAll, max]);

  return (inventoryResources && inventoryResources.length > 0) || (dynamicResources && dynamicResources.length > 0) ? (
    <div className={`p-2 bg-gold/10 clip-angled ${className}`}>
      {dynamicResources &&
        dynamicResources.length > 0 &&
        dynamicResources
          .slice(0, updatedMax - dynamicResources.length)
          .map(
            (resource) =>
              resource && (
                <ResourceCost
                  size={resourcesIconSize}
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
        .slice(0, updatedMax - dynamicResources.length)
        .map(
          (resource) =>
            resource && (
              <ResourceCost
                size={resourcesIconSize}
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
        {updatedMax < inventoryResources.length && !showAll && (
          <div onClick={() => setShowAll(true)}>+{inventoryResources.length - updatedMax}</div>
        )}
        {showAll && <div onClick={() => setShowAll(false)}>hide</div>}
      </div>
    </div>
  ) : (
    <></>
  );
};
