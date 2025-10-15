import { useUISound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ConfirmationPopup } from "@/ui/features/economy/banking";
import { DepositResources } from "@/ui/features/economy/resources";
import { formatStorageValue } from "@/ui/utils/storage-utils";

import {
  ResourceArrivalManager,
  configManager,
  divideByPrecision,
  formatTime,
  getBlockTimestamp,
  getIsBlitz,
  getStructureName,
} from "@bibliothecadao/eternum";
import { useArrivalsByStructure, useDojo, useResourceManager } from "@bibliothecadao/react";
import { ResourceArrivalInfo, Structure } from "@bibliothecadao/types";
import clsx from "clsx";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

const getArrivalKey = (arrival: ResourceArrivalInfo) =>
  `${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`;

const getArrivalWeightKg = (arrival: ResourceArrivalInfo) => {
  return arrival.resources
    .filter(Boolean)
    .reduce((total, resource) => {
      const weightPerUnit = configManager.resourceWeightsKg[resource.resourceId] || 0;
      const resourceAmount = divideByPrecision(resource.amount);

      return total + resourceAmount * weightPerUnit;
    }, 0);
};

export const StructureArrivals = memo(({ structure }: { structure: Structure }) => {
  const { currentBlockTimestamp } = getBlockTimestamp();

  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(currentBlockTimestamp);
  const [isBulkReceiving, setIsBulkReceiving] = useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const playBulkDeposit = useUISound("resources.stone.add");
  const arrivals = useArrivalsByStructure(structure.entityId);
  const resourceManager = useResourceManager(structure.entityId);
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();

  const readyArrivals = useMemo(() => {
    if (!now) return arrivals.filter((arrival) => arrival.arrivesAt <= currentBlockTimestamp);

    return arrivals.filter((arrival) => arrival.arrivesAt <= now);
  }, [arrivals, currentBlockTimestamp, now]);
  const readyArrivalsWithResources = useMemo(
    () => readyArrivals.filter((arrival) => arrival.resources.filter(Boolean).length > 0),
    [readyArrivals],
  );

  // Calculate summary information
  const readyArrivalsCount = readyArrivals.length;
  const pendingArrivals = arrivals.length - readyArrivalsCount;

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

  const bulkCapacityProjection = useMemo(() => {
    const storeCapacity = resourceManager.getStoreCapacityKg();

    if (!Number.isFinite(storeCapacity.capacityKg)) {
      return { hasOverflow: false, limitedArrivals: [] as string[] };
    }

    let projectedUsed = storeCapacity.capacityUsedKg;
    const limitedArrivals: string[] = [];

    readyArrivalsWithResources.forEach((arrival) => {
      const arrivalWeight = getArrivalWeightKg(arrival);

      if (projectedUsed + arrivalWeight > storeCapacity.capacityKg) {
        limitedArrivals.push(getArrivalKey(arrival));
      }

      projectedUsed += arrivalWeight;
    });

    return {
      hasOverflow: limitedArrivals.length > 0,
      limitedArrivals,
    };
  }, [readyArrivalsWithResources, resourceManager]);

  const processBulkOffload = async () => {
    if (isBulkReceiving || readyArrivalsWithResources.length === 0) return;
    if (!account) {
      setBulkError("Connect a wallet to receive resources.");
      return;
    }

    setBulkError(null);
    setIsBulkReceiving(true);

    let didFail = false;

    try {
      for (const arrival of readyArrivalsWithResources) {
        if (arrival.arrivesAt > (now ?? currentBlockTimestamp)) continue;
        if (arrival.resources.length === 0) continue;

        const resourceArrivalManager = new ResourceArrivalManager(components, systemCalls, arrival);

        try {
          await resourceArrivalManager.offload(account, arrival.resources.length);
          playBulkDeposit();
        } catch (error) {
          console.error("Failed to offload arrival", { arrival, error });
          didFail = true;
        }
      }
    } finally {
      setIsBulkReceiving(false);

      if (didFail) {
        setBulkError("Some arrivals could not be received. Check the console for details.");
      }
    }
  };

  const onReceiveAll = () => {
    if (readyArrivalsWithResources.length === 0) return;

    if (bulkCapacityProjection.hasOverflow) {
      setShowBulkConfirmation(true);
      return;
    }

    void processBulkOffload();
  };

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
          {readyArrivalsCount > 0 && (
            <div className="flex items-center gap-1 bg-emerald-900/40 text-emerald-400 rounded-md px-2 py-0.5 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span>{readyArrivalsCount} ready</span>
            </div>
          )}
          {pendingArrivals > 0 && (
            <div className="flex items-center gap-1 bg-amber-900/40 text-amber-400 rounded-md px-2 py-0.5 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
              <span>{pendingArrivals} pending</span>
            </div>
          )}
          <div className="text-xs text-gold/70 bg-gold/10 rounded-md px-2 py-0.5">{totalResources} resources</div>
          {readyArrivalsWithResources.length > 0 && (
            <Button
              size="xs"
              className="ml-2 whitespace-nowrap"
              variant="secondary"
              onClick={onReceiveAll}
              isLoading={isBulkReceiving}
              disabled={isBulkReceiving}
              withoutSound
            >
              Receive All
            </Button>
          )}
          <div className="text-gold ml-2">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
        </div>
      </button>

      {bulkError && <div className="px-2 py-1 text-xs text-red/80">{bulkError}</div>}

      {isExpanded && (
        <div className="flex flex-col gap-2 p-1">
          {arrivals.map((arrival) => (
            <ResourceArrival
              now={now}
              arrival={arrival}
              key={getArrivalKey(arrival)}
            />
          ))}
        </div>
      )}

      {showBulkConfirmation && (
        <ConfirmationPopup
          title="Warning: Storage at Max Capacity"
          warning="Receiving all arrivals may overflow storage and destroy resources."
          onConfirm={() => {
            setShowBulkConfirmation(false);
            void processBulkOffload();
          }}
          onCancel={() => setShowBulkConfirmation(false)}
          isLoading={isBulkReceiving}
        >
          <div className="flex flex-col items-center gap-3 text-amber-400">
            <AlertCircle className="w-12 h-12" />
            <p className="text-center">
              At least one arrival will exceed your storage capacity if you receive everything now. Some resources may be
              lost in the process.
            </p>
            <p className="text-center">
              {bulkCapacityProjection.limitedArrivals.length} arrival
              {bulkCapacityProjection.limitedArrivals.length === 1 ? "" : "s"} currently push you over the limit.
            </p>
            <p className="text-center font-bold">Do you still want to receive all arrivals?</p>
          </div>
        </ConfirmationPopup>
      )}
    </div>
  );
});

const ResourceArrival = ({ arrival, now }: { arrival: ResourceArrivalInfo; now: number }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const resourceManager = useResourceManager(arrival.structureEntityId);

  const storeCapacityKg = resourceManager.getStoreCapacityKg();
  const formattedStoreCapacity = formatStorageValue(storeCapacityKg.capacityKg);
  const formattedStoreCapacityUsed = formatStorageValue(storeCapacityKg.capacityUsedKg);
  const formatWithKgSuffix = (value: { display: string; isInfinite: boolean }) =>
    value.isInfinite ? value.display : `${value.display}kg`;

  const totalWeight = useMemo(() => getArrivalWeightKg(arrival), [arrival]);

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
            Cap: {formatWithKgSuffix(formattedStoreCapacityUsed)} / {formatWithKgSuffix(formattedStoreCapacity)}
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
