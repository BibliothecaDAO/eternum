import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";

import { divideByPrecision, formatTime } from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useArrivalsByStructure } from "@bibliothecadao/react";
import { ResourcesIds, Structure } from "@bibliothecadao/types";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Check from "lucide-react/dist/esm/icons/check";
import { memo, useMemo } from "react";

export const StructureArrivals = memo(({ structure, now: nowOverride }: { structure: Structure; now?: number }) => {
  const chainNowMs = useChainTimeStore((state) => state.nowMs);
  const arrivals = useArrivalsByStructure(structure.entityId);

  const now = nowOverride ?? Math.floor(chainNowMs / 1000);
  const mode = useGameModeConfig();
  const structureName = useMemo(() => {
    return mode.structure.getName(structure.structure).name;
  }, [mode.structure, structure]);

  const arrivalsWithResources = useMemo(
    () =>
      arrivals
        .filter((arrival) => arrival.resources.some(Boolean))
        .toSorted((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt)),
    [arrivals],
  );

  const arrivalSummaries = useMemo(() => {
    return arrivalsWithResources.map((arrival) => {
      const resources = arrival.resources.filter(Boolean).map((resource) => ({
        resourceId: resource.resourceId as ResourcesIds,
        amount: divideByPrecision(resource.amount),
      }));

      const secondsUntilArrival = Math.max(0, Number(arrival.arrivesAt) + RESOURCE_ARRIVAL_READY_BUFFER_SECONDS - now);
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

  const readyCount = arrivalSummaries.filter((s) => s.isReady).length;
  const pendingCount = arrivalSummaries.length - readyCount;

  return (
    <div className="rounded-md border border-gold/10 bg-gold/[0.03] overflow-hidden">
      {/* Structure header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gold/10 bg-gold/[0.04]">
        <h6 className="text-sm text-gold font-semibold tracking-wide">{structureName}</h6>
        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400/80">
              <Check size={10} />
              {readyCount} ready
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gold/50">
              <Clock3 size={10} />
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Arrival rows */}
      <div className="flex flex-col gap-px bg-gold/5">
        {arrivalSummaries.map((summary) => (
          <div key={summary.id} className="flex items-center gap-3 px-3 py-2 bg-brown/40">
            {/* Status badge */}
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide whitespace-nowrap min-w-[100px]">
              {summary.isReady ? (
                <>
                  <Loader2 size={12} className="animate-spin text-emerald-400" />
                  <span className="text-emerald-400">Claiming</span>
                </>
              ) : (
                <>
                  <Clock3 size={12} className="text-gold/60" />
                  <span className="text-gold/70 tabular-nums">{formatTime(summary.secondsUntilArrival)}</span>
                </>
              )}
            </div>

            {/* Resources */}
            <div className="flex flex-wrap gap-1.5 flex-1">
              {summary.resources.map((resource) => (
                <ResourceCost
                  key={`${summary.id}-${resource.resourceId}`}
                  type="vertical"
                  size="xs"
                  withTooltip
                  className="!text-gold/90 bg-gold/[0.08] border-gold/10 rounded px-1 py-0.5"
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
