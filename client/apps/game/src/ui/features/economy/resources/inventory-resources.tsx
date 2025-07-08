import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, getRelicInfo, ID, isRelic, RelicRecipientType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { RelicActivationPopup } from "./relic-activation-popup";

export const InventoryResources = ({
  resources,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  resourcesIconSize = "sm",
  textSize,
  entityId,
  recipientType,
}: {
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  max?: number;
  className?: string;
  resourcesIconSize?: "xs" | "sm" | "md" | "lg";
  textSize?: "xxs" | "xs" | "sm" | "md" | "lg";
  entityId?: ID;
  recipientType?: RelicRecipientType;
}) => {
  const [showAll, setShowAll] = useState(false);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const sortedResources = useMemo(() => {
    return ResourceManager.getResourceBalances(resources).sort((a, b) => b.amount - a.amount);
  }, [resources]);

  const updatedMax = useMemo(() => {
    if (showAll) return Infinity;
    return max;
  }, [showAll, max]);

  const handleRelicClick = (resourceId: number, amount: number) => {
    if (!entityId || recipientType === undefined) return;

    toggleModal(
      <RelicActivationPopup
        structureEntityId={entityId}
        recipientType={recipientType}
        relicId={resourceId}
        relicBalance={amount}
        onClose={() => toggleModal(null)}
      />,
    );
  };

  let currentCount = 0;

  return sortedResources.length > 0 ? (
    <div className={`p-1 bg-gold/10 ${className}`}>
      {sortedResources.map((resource) => {
        if (!resource || currentCount >= updatedMax) return null;
        currentCount++;

        const resourceIsRelic = isRelic(resource.resourceId);
        const relicInfo = resourceIsRelic ? getRelicInfo(resource.resourceId) : null;

        // Check if relic is compatible with the current entity type
        const isCompatibleRelic =
          resourceIsRelic &&
          relicInfo &&
          ((recipientType === RelicRecipientType.Explorer && relicInfo.activation === "Army") ||
            (recipientType === RelicRecipientType.Structure && relicInfo.activation === "Structure"));

        return (
          <div
            key={resource.resourceId}
            className="relative"
            onClick={() => {
              if (isCompatibleRelic && entityId) {
                handleRelicClick(resource.resourceId, divideByPrecision(Number(resource.amount)));
              }
            }}
          >
            <ResourceCost
              size={resourcesIconSize}
              textSize={textSize}
              type="vertical"
              color="text-green"
              resourceId={resource.resourceId}
              amount={divideByPrecision(Number(resource.amount))}
              className={`!p-1 ${
                isCompatibleRelic ? "cursor-pointer hover:bg-gold/20 transition-all duration-200" : ""
              }`}
            />
            {isCompatibleRelic && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full animate-pulse bg-gold/10 rounded" />
              </div>
            )}
          </div>
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
