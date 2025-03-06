import { DepositResourceArrival } from "@/ui/components/resources/deposit-resources";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  divideByPrecision,
  EntityType,
  formatTime,
  ResourceArrivalInfo
} from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";

const entityIcon: Record<EntityType, string> = {
  [EntityType.DONKEY]: "🫏",
  [EntityType.TROOP]: "🥷",
  [EntityType.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
};

export const ResourceArrival = ({ arrival }: { arrival: ResourceArrivalInfo }) => {
  const { currentBlockTimestamp } = getBlockTimestamp();

  const renderEntityStatus = useMemo(() => {
    return currentBlockTimestamp ? (
      arrival.arrivesAt <= currentBlockTimestamp ? (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Waiting to offload
        </div>
      ) : (
        <div className="flex ml-auto italic self-center bg-brown/20 rounded-md px-2 py-1">
          Arriving in {formatTime(Number(arrival.arrivesAt) - currentBlockTimestamp)}
        </div>
      )
    ) : null;
  }, [currentBlockTimestamp]);

  const renderedResources = useMemo(() => {
    return arrival.resources
      .filter(Boolean)
      .map((resource) => (
        <ResourceCost
          key={resource.resourceId}
          className="!text-gold"
          type="vertical"
          size="xs"
          withTooltip={true}
          resourceId={resource.resourceId}
          amount={divideByPrecision(resource.amount)}
        />
      ));
  }, [arrival.resources]);

  return (
    <div className={clsx("flex flex-col p-2 text-gold border border-gold/10", "bg-gold/10")}>
      <div className="flex justify-between">
        <div className="flex gap-2">
          <div className="flex gap-8 items-center">{entityIcon[EntityType.DONKEY]}</div>
          {renderEntityStatus}
        </div>
        <div className="flex justify-between items-center self-center">
          <DepositResourceArrival arrival={arrival} />
        </div>
      </div>
      {renderedResources && <div className="flex items-center gap-2 flex-wrap mt-4">{renderedResources}</div>}
    </div>
  );
};
