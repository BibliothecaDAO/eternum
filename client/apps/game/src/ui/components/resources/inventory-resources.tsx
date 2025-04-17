import { ResourceCost } from "@/ui/elements/resource-cost";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

export const InventoryResources = ({
  entityId,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  resourcesIconSize = "sm",
  textSize,
}: {
  entityId: ID;
  max?: number;
  className?: string;
  resourcesIconSize?: "xs" | "sm" | "md" | "lg";
  textSize?: "xxs" | "xs" | "sm" | "md" | "lg";
}) => {
  const [showAll, setShowAll] = useState(false);

  const resourceManager = useResourceManager(entityId);

  const sortedResources = useMemo(() => {
    return resourceManager.getResourceBalances().sort((a, b) => b.amount - a.amount);
  }, [resourceManager]);

  const updatedMax = useMemo(() => {
    if (showAll) return Infinity;
    return max;
  }, [showAll, max]);

  let currentCount = 0;

  return sortedResources.length > 0 ? (
    <div className={`p-1 bg-gold/10 ${className}`}>
      {sortedResources.map((resource) => {
        if (!resource || currentCount >= updatedMax) return null;
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
            className="!p-1"
          />
        );
      })}
      <div className="ml-1 font-bold hover:opacity-70">
        {updatedMax < sortedResources.length && !showAll && (
          <div onClick={() => setShowAll(true)}>+{sortedResources.length - updatedMax}</div>
        )}
        {showAll && <div onClick={() => setShowAll(false)}>hide</div>}
      </div>
    </div>
  ) : (
    <div>No resources</div>
  );
};
