import { DepositResourceArrival } from "@/ui/components/resources/deposit-resources";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { getBlockTimestamp } from "@/utils/timestamp";
import { divideByPrecision, formatTime } from "@bibliothecadao/eternum";
import { ResourceArrivalInfo } from "@bibliothecadao/types";
import { useArrivalsByStructure } from "@bibliothecadao/react";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

export const StructureArrivals = memo(({ structure }: { structure: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const arrivals = useArrivalsByStructure(structure.entityId);

  const { currentBlockTimestamp } = getBlockTimestamp();

  if (arrivals.length === 0) return null;

  // Calculate summary information
  const readyArrivals = arrivals.filter((arrival) => arrival.arrivesAt <= currentBlockTimestamp).length;
  const pendingArrivals = arrivals.length - readyArrivals;

  // Count total resources
  const totalResources = arrivals.reduce((total, arrival) => total + arrival.resources.filter(Boolean).length, 0);

  const toggleStructure = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="border border-gold/20 rounded-md">
      <button
        className="flex w-full justify-between items-center p-2 bg-gold/10 cursor-pointer hover:bg-gold/20 transition-colors"
        onClick={toggleStructure}
      >
        <div className="flex items-center">
          <h4 className="text-gold font-medium">{structure.name}</h4>
        </div>
        <div className="flex items-center gap-2">
          {readyArrivals > 0 && (
            <div className="flex items-center gap-1 bg-emerald-900/40 text-emerald-400 rounded-md px-2 py-0.5 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span>{readyArrivals} ready</span>
            </div>
          )}
          {pendingArrivals > 0 && (
            <div className="flex items-center gap-1 bg-amber-900/40 text-amber-400 rounded-md px-2 py-0.5 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
              <span>{pendingArrivals} pending</span>
            </div>
          )}
          <div className="text-xs text-gold/70 bg-gold/10 rounded-md px-2 py-0.5">{totalResources} resources</div>
          <div className="text-gold ml-2">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
        </div>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-2 p-2">
          {arrivals.map((arrival) => (
            <ResourceArrival arrival={arrival} key={`${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`} />
          ))}
        </div>
      )}
    </div>
  );
});

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

  const isArrived = useMemo(() => {
    return now ? arrival.arrivesAt <= now : false;
  }, [arrival.arrivesAt, now]);

  const renderEntityStatus = useMemo(() => {
    if (!now) return null;

    return isArrived ? (
      <div className="flex items-center gap-2 bg-emerald-900/40 text-emerald-400 rounded-md px-3 py-1.5 font-medium border border-emerald-700/50">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        <span>Ready to offload</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 bg-amber-900/40 text-amber-400 rounded-md px-3 py-1.5 font-medium border border-amber-700/50">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
        <span>Arriving in {formatTime(Number(arrival.arrivesAt) - now)}</span>
      </div>
    );
  }, [arrival.arrivesAt, now, isArrived]);

  const renderedResources = useMemo(() => {
    return arrival.resources
      .filter(Boolean)
      .map((resource) => (
        <ResourceCost
          key={resource.resourceId}
          className={clsx("!text-gold", isArrived && "ring-1 ring-emerald-500/30 bg-emerald-900/20 rounded-md p-1")}
          type="vertical"
          size="xs"
          withTooltip={true}
          resourceId={resource.resourceId}
          amount={divideByPrecision(resource.amount)}
        />
      ));
  }, [arrival.resources, isArrived]);

  return (
    <div className={clsx("flex flex-col p-3 rounded-md text-gold")}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gold/20 border border-gold/30">
            {isArrived ? "🏰" : "🫏"}
          </div>
          {renderEntityStatus}
        </div>
        <div className="flex justify-between items-center">
          <DepositResourceArrival arrival={arrival} />
        </div>
      </div>
      {renderedResources && renderedResources.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-4 p-2 bg-black/20 rounded-md border border-gold/10">
          {renderedResources}
        </div>
      )}
    </div>
  );
};
