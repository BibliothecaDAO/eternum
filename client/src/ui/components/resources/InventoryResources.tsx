import { getResourceBalance, getResourcesUtils } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { ID, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

export const InventoryResources = ({
  entityIds,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  dynamic = [],
  resourcesIconSize = "sm",
  textSize,
}: {
  entityIds: ID[];
  max?: number;
  className?: string;
  dynamic?: ResourcesIds[];
  resourcesIconSize?: "xs" | "sm" | "md" | "lg";
  textSize?: "xxs" | "xs" | "sm" | "md" | "lg";
}) => {
  const [showAll, setShowAll] = useState(false);
  const { getResourcesFromBalance } = getResourcesUtils();
  const { getBalance } = getResourceBalance();

  const inventoriesResources = entityIds.map(getResourcesFromBalance).flatMap((item) => item);

  const dynamicResources = dynamic.map(
    (resourceId): Resource => ({ resourceId, amount: getBalance(entityIds[0], resourceId).balance }),
  );

  const allResources = [...inventoriesResources, ...dynamicResources];

  const updatedMax = useMemo(() => {
    if (showAll) return Infinity;
    return max;
  }, [showAll, max]);

  const maxResources = updatedMax - dynamicResources.length;
  let currentCount = 0;

  return allResources.length > 0 ? (
    <div className={`p-2 bg-gold/10 ${className}`}>
      {allResources
        .sort((a, b) => b.amount - a.amount)
        .map((resource) => {
          if (!resource || currentCount >= maxResources) return null;
          currentCount++;
          return (
            <ResourceCost
              size={resourcesIconSize}
              textSize={textSize}
              key={resource.resourceId}
              type="vertical"
              color="text-green"
              resourceId={resource.resourceId}
              amount={divideByPrecision(Number(resource.amount))}
            />
          );
        })}
      <div className="ml-1 font-bold hover:opacity-70">
        {updatedMax < inventoriesResources.length && !showAll && (
          <div onClick={() => setShowAll(true)}>+{inventoriesResources.length - updatedMax}</div>
        )}
        {showAll && <div onClick={() => setShowAll(false)}>hide</div>}
      </div>
    </div>
  ) : (
    <div>No resources</div>
  );
};
