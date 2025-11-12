import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";

import {
  divideByPrecision,
  formatTime,
  getBlockTimestamp,
  getIsBlitz,
  getStructureName,
} from "@bibliothecadao/eternum";
import { useArrivalsByStructure } from "@bibliothecadao/react";
import { ResourcesIds, Structure } from "@bibliothecadao/types";
import { Loader2, Clock3 } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

export const StructureArrivals = memo(({ structure }: { structure: Structure }) => {
  const { currentBlockTimestamp } = getBlockTimestamp();
  const [now, setNow] = useState(currentBlockTimestamp);
  const arrivals = useArrivalsByStructure(structure.entityId);

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

  const arrivalsWithResources = useMemo(
    () =>
      arrivals
        .filter((arrival) => arrival.resources.some(Boolean))
        .sort((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt)),
    [arrivals],
  );

  const arrivalSummaries = useMemo(() => {
    return arrivalsWithResources.map((arrival) => {
      const resources = arrival.resources.filter(Boolean).map((resource) => ({
        resourceId: resource.resourceId as ResourcesIds,
        amount: divideByPrecision(resource.amount),
      }));

      const secondsUntilArrival = Math.max(0, Number(arrival.arrivesAt) - now);
      const isReady = secondsUntilArrival === 0;

      return {
        id: `${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`,
        resources,
        secondsUntilArrival,
        isReady,
      };
    });
  }, [arrivalsWithResources, now]);

  if (arrivalSummaries.length === 0) {
    return null;
  }

  const incomingLabel =
    arrivalSummaries.length === 1 ? "1 incoming transfer" : `${arrivalSummaries.length} incoming transfers`;

  return (
    <div className="border border-gold/5 rounded-md bg-gold/5 p-3 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2 text-gold">
        <h6 className="text-base">{structureName}</h6>
        <span className="text-xs text-gold/70">· {incomingLabel}</span>
      </div>

      <div className="flex flex-col gap-2">
        {arrivalSummaries.map((summary) => (
          <div
            key={summary.id}
            className="flex items-center gap-3 border border-gold/10 rounded-md px-2 py-2 bg-gold/10 text-gold w-full"
          >
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide whitespace-nowrap min-w-[110px]">
              {summary.isReady ? (
                <>
                  <Loader2 size={14} className="animate-spin text-emerald-300" />
                  <span className="text-emerald-300">Auto-claiming…</span>
                </>
              ) : (
                <>
                  <Clock3 size={14} className="text-amber-300" />
                  <span className="text-amber-300">{formatTime(summary.secondsUntilArrival)}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              {summary.resources.map((resource) => (
                <ResourceCost
                  key={`${summary.id}-${resource.resourceId}`}
                  type="vertical"
                  size="xs"
                  withTooltip
                  className="!text-gold bg-gold/15 rounded-md px-1 py-1"
                  resourceId={resource.resourceId}
                  amount={resource.amount}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
