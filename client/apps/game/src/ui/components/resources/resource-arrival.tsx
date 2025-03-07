import { DepositResourceArrival } from "@/ui/components/resources/deposit-resources";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { getBlockTimestamp } from "@/utils/timestamp";
import { divideByPrecision, EntityType, formatTime, ResourceArrivalInfo } from "@bibliothecadao/eternum";
import { useArrivalsByStructure } from "@bibliothecadao/react";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

const entityIcon: Record<EntityType, string> = {
  [EntityType.DONKEY]: "🫏",
  [EntityType.TROOP]: "🥷",
  [EntityType.UNKNOWN]: "❓", // Add a default or placeholder icon for UNKNOWN
};

export const StructureArrivals = memo(
  ({
    structure,
    isExpanded,
    toggleStructure,
  }: {
    structure: any;
    isExpanded: boolean;
    toggleStructure: (id: string) => void;
  }) => {
    const arrivals = useArrivalsByStructure({ structureEntityId: structure.entityId });

    if (arrivals.length === 0) return null;

    return (
      <div className="border border-gold/20 rounded-md">
        <div
          className="flex justify-between items-center p-2 bg-gold/10 cursor-pointer"
          onClick={() => toggleStructure(structure.entityId.toString())}
        >
          <h3 className="text-gold font-medium">{structure.name}</h3>
          <div className="text-gold">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
        </div>

        {isExpanded && (
          <div className="flex flex-col gap-2 p-2">
            {arrivals.map((arrival) => (
              <ResourceArrival arrival={arrival} key={`${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`} />
            ))}
          </div>
        )}
      </div>
    );
  },
);

const ResourceArrival = ({ arrival }: { arrival: ResourceArrivalInfo }) => {
  const { currentBlockTimestamp } = getBlockTimestamp();
  const [now, setNow] = useState(currentBlockTimestamp);

  useEffect(() => {
    if (!currentBlockTimestamp) return;
    setNow(currentBlockTimestamp);

    const interval = setInterval(() => {
      setNow((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentBlockTimestamp]);

  const renderEntityStatus = useMemo(() => {
    return now ? (
      arrival.arrivesAt <= now ? (
        <div className="flex ml-auto italic animate-pulse self-center bg-brown/20 rounded-md px-2 py-1">
          Waiting to offload
        </div>
      ) : (
        <div className="flex ml-auto italic self-center bg-brown/20 rounded-md px-2 py-1">
          Arriving in {formatTime(Number(arrival.arrivesAt) - now)}
        </div>
      )
    ) : null;
  }, [arrival.arrivesAt, now]);

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
