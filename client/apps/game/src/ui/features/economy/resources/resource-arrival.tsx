import { useUIStore } from "@/hooks/store/use-ui-store";
import { getIsBlitz } from "@bibliothecadao/eternum";

import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { DepositResources } from "@/ui/features/economy/resources";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { configManager, divideByPrecision, formatTime, getStructureName } from "@bibliothecadao/eternum";
import { useArrivalsByStructure, useResourceManager } from "@bibliothecadao/react";
import { ResourceArrivalInfo, Structure } from "@bibliothecadao/types";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

export const StructureArrivals = memo(({ structure }: { structure: Structure }) => {
  const { currentBlockTimestamp } = getBlockTimestamp();

  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(currentBlockTimestamp);

  const arrivals = useArrivalsByStructure(structure.entityId);

  // Calculate summary information
  const readyArrivals = arrivals.filter((arrival) => arrival.arrivesAt <= currentBlockTimestamp).length;
  const pendingArrivals = arrivals.length - readyArrivals;

  // Count total resources
  const totalResources = arrivals.reduce((total, arrival) => total + arrival.resources.filter(Boolean).length, 0);

  const toggleStructure = () => {
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    if (!currentBlockTimestamp) return;
    setNow(currentBlockTimestamp);

    const interval = setInterval(() => {
      setNow((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentBlockTimestamp]);

  const structureName = useMemo(() => {
    return getStructureName(structure.structure, getIsBlitz()).name;
  }, [structure]);

  if (arrivals.length === 0) return null;

  return (
    <div className="border border-gold/5">
      <button
        className="flex w-full justify-between items-center px-2 bg-gold/10 cursor-pointer hover:bg-gold/20 transition-colors"
        onClick={toggleStructure}
      >
        <div className="flex items-center">
          <h6 className="">{structureName}</h6>
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
        <div className="flex flex-col gap-2 p-1">
          {arrivals.map((arrival) => (
            <ResourceArrival
              now={now}
              arrival={arrival}
              key={`${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const ResourceArrival = ({ arrival, now }: { arrival: ResourceArrivalInfo; now: number }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const resourceManager = useResourceManager(arrival.structureEntityId);

  const storeCapacityKg = resourceManager.getStoreCapacityKg();

  const totalWeight = useMemo(() => {
    return arrival.resources.reduce((total, resource) => {
      const weightPerUnit = configManager.resourceWeightsKg[resource.resourceId] || 0;

      const resourceAmount = divideByPrecision(resource.amount);
      return total + resourceAmount * weightPerUnit;
    }, 0);
  }, [arrival.resources]);

  const isOverCapacity = useMemo(() => {
    return totalWeight + storeCapacityKg.capacityUsedKg > storeCapacityKg.capacityKg;
  }, [totalWeight, storeCapacityKg]);

  const isArrived = useMemo(() => {
    return now ? arrival.arrivesAt <= now : false;
  }, [arrival.arrivesAt, now]);

  const renderEntityStatus = useMemo(() => {
    if (!now) return null;

    return isArrived ? (
      <div className="flex flex-wrap items-center  bg-emerald-900/40 text-emerald-400 rounded-md px-2 font-medium border border-emerald-700/50 uppercase text-xs">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        <span className="ml-2">Ready to offload</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 bg-amber-900/40 text-amber-400 rounded-md px-2 font-medium border border-amber-700/50">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
        <span> {formatTime(Number(arrival.arrivesAt) - now)}</span>
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
    <div className={clsx("flex flex-col text-gold")}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <div>{isArrived ? "🏰" : "🫏"}</div>
          {renderEntityStatus}
        </div>
        <div className="flex justify-between items-center">
          <DepositResources isMaxCapacity={isOverCapacity} arrival={arrival} />
        </div>
      </div>
      {isOverCapacity && (
        <div
          onMouseEnter={() => {
            setTooltip({
              position: "top",
              content: (
                <>
                  {isOverCapacity
                    ? "This arrival is over capacity - if you accept the order some resources will be lost. Use some of your realms resources in order to fully offload this order"
                    : "This arrival is under storage capacity and will be fully offloaded"}
                </>
              ),
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className={clsx(
            "w-full border border-gold/10 p-1 rounded-md mt-1 justify-between flex text-xs uppercase",
            isOverCapacity ? "bg-red/30 border-red-700/50 text-red/90 animate-pulse" : "text-gold/70 bg-gold/10",
          )}
        >
          <span className={clsx(isOverCapacity && "font-bold")}>
            Cap: {storeCapacityKg.capacityUsedKg.toLocaleString()}kg / {storeCapacityKg.capacityKg.toLocaleString()}
            kg
          </span>
          <span className={clsx(isOverCapacity && "font-bold")}>Total: {totalWeight.toLocaleString()}kg</span>
        </div>
      )}

      {renderedResources && renderedResources.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap py-2">{renderedResources}</div>
      )}
    </div>
  );
};
