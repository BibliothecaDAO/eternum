import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { getBlockTimestamp } from "@/utils/timestamp";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, getRelicInfo, ID, isRelic, RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { RelicActivationPopup } from "./relic-activation-popup";

export const InventoryResources = ({
  resources,
  relicEffects,
  max = Infinity,
  className = "flex flex-wrap gap-1",
  resourcesIconSize = "sm",
  textSize,
  entityId,
  recipientType,
  activateRelics = false,
}: {
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  relicEffects: ResourcesIds[];
  max?: number;
  className?: string;
  resourcesIconSize?: "xs" | "sm" | "md" | "lg";
  textSize?: "xxs" | "xs" | "sm" | "md" | "lg";
  entityId?: ID;
  recipientType?: RelicRecipientType;
  activateRelics?: boolean;
}) => {
  const [showAll, setShowAll] = useState(false);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const { regularResources, relics } = useMemo(() => {
    const { currentDefaultTick } = getBlockTimestamp();
    // Only include resources with amount > 0
    const balances = ResourceManager.getResourceBalancesWithProduction(resources, currentDefaultTick).filter(
      (resource) => resource.amount > 0,
    );

    if (!activateRelics) {
      return {
        regularResources: balances.sort((a, b) => b.amount - a.amount),
        relics: [],
      };
    }

    const regular: typeof balances = [];
    const relicList: typeof balances = [];

    balances.forEach((resource) => {
      if (isRelic(resource.resourceId)) {
        relicList.push(resource);
      } else {
        regular.push(resource);
      }
    });

    return {
      regularResources: regular.sort((a, b) => b.amount - a.amount),
      relics: relicList.sort((a, b) => b.amount - a.amount),
    };
  }, [resources, activateRelics]);

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

  const totalItems = regularResources.length + relics.length;
  let currentCount = 0;

  const renderResourceItem = (resource: any, isRelicItem: boolean) => {
    if (!resource || currentCount >= updatedMax) return null;
    currentCount++;

    const relicInfo = isRelicItem ? getRelicInfo(resource.resourceId) : null;
    const isCompatibleRelic = isRelicItem && relicInfo && relicInfo.recipientType === recipientType;
    const isRelicActive = relicEffects.includes(resource.resourceId);

    return (
      <div
        key={resource.resourceId}
        className={`relative ${
          isRelicActive ? "bg-purple-500/20 border border-purple-500/50 rounded-lg animate-pulse" : ""
        }`}
        onClick={() => {
          if (isRelicItem && entityId && !isRelicActive) {
            handleRelicClick(resource.resourceId, divideByPrecision(Number(resource.amount)));
          }
        }}
      >
        <ResourceCost
          size={resourcesIconSize}
          textSize={textSize}
          type="vertical"
          color={isRelicActive ? "text-relic" : "text-green"}
          resourceId={resource.resourceId}
          amount={divideByPrecision(Number(resource.amount))}
          className={`!p-1 ${isRelicItem ? "cursor-pointer hover:bg-gold/20 transition-all duration-200" : ""}`}
        />
        {isCompatibleRelic && !isRelicActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full animate-pulse bg-gold/10 rounded" />
          </div>
        )}
        {isRelicActive && (
          <div className="absolute top-0 right-0 pointer-events-none">
            <Sparkles className="h-3 w-3 text-relic2 animate-pulse" />
          </div>
        )}
      </div>
    );
  };

  return totalItems > 0 ? (
    <div className={`p-1 bg-gold/10 ${className}`}>
      {/* Resources Section */}
      {regularResources.length > 0 && <>{regularResources.map((resource) => renderResourceItem(resource, false))}</>}

      {/* Relics Section - only show when activateRelics is true */}
      {activateRelics && relics.length > 0 && (
        <>
          {currentCount < updatedMax && regularResources.length > 0 && <div className="w-full basis-full h-0" />}
          {relics.length > 0 && currentCount < updatedMax && (
            <div className="text-xs text-gold/60 w-full mb-1">Click relics to activate them</div>
          )}
          {relics.map((relic) => renderResourceItem(relic, true))}
        </>
      )}

      <div className="ml-1 font-bold hover:opacity-70">
        {updatedMax < totalItems && !showAll && <div onClick={() => setShowAll(true)}>+{totalItems - updatedMax}</div>}
        {showAll && <div onClick={() => setShowAll(false)}>hide</div>}
      </div>
    </div>
  ) : (
    <div>No resources</div>
  );
};
