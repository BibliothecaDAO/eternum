import { addToSubscription } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance, useResourcesUtils } from "@/hooks/helpers/useResources";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { ID, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";

export const InventoryResources = ({
  entityId,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  dynamic = [],
  resourcesIconSize = "sm",
  textSize,
}: {
  entityId: ID;
  max?: number;
  className?: string;
  dynamic?: ResourcesIds[];
  resourcesIconSize?: "xs" | "sm" | "md" | "lg";
  textSize?: "xxs" | "xs" | "sm" | "md" | "lg";
}) => {
  const dojo = useDojo();

  const [showAll, setShowAll] = useState(false);
  const { useResourcesFromBalance } = useResourcesUtils();
  const { getBalance } = useResourceBalance();

  const inventoriesResources = useResourcesFromBalance(entityId);

  const [isSyncing, setIsSyncing] = useState(false);

  const dynamicResources = useMemo(
    () => dynamic.map((resourceId): Resource => ({ resourceId, amount: getBalance(entityId, resourceId).balance })),
    [dynamic, entityId, getBalance],
  );

  useEffect(() => {
    if (inventoriesResources.length === 0) {
      setIsSyncing(true);
      const fetch = async () => {
        try {
          await addToSubscription(
            dojo.network.toriiClient,
            dojo.network.contractComponents as any,
            entityId.toString(),
          );
        } catch (error) {
          console.error("Fetch failed", error);
        } finally {
          setIsSyncing(false);
        }
      };
      fetch();
    }
  }, [inventoriesResources.length, entityId]);

  const allResources = [...inventoriesResources, ...dynamicResources];

  const sortedResources = useMemo(() => {
    return allResources.sort((a, b) => b.amount - a.amount);
  }, [allResources]);

  const updatedMax = useMemo(() => {
    if (showAll) return Infinity;
    return max;
  }, [showAll, max]);

  const maxResources = updatedMax - dynamicResources.length;
  let currentCount = 0;

  return isSyncing ? (
    <div className={`p-2 bg-gold/10 ${className}`}>
      <div className="text-gold/50 italic">Loading resources...</div>
    </div>
  ) : allResources.length > 0 ? (
    <div className={`p-2 bg-gold/10 ${className}`}>
      {sortedResources.map((resource) => {
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
