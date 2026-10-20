import { HudChip, HudPanel, HudRow } from "@/ui/design-system/kit/hud-elements";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";

import { divideByPrecision } from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useArrivalsByStructure } from "@/hooks/helpers/use-resource-arrivals";
import { ResourcesIds, Structure, formatWait } from "@bibliothecadao/types";

import { memo, useMemo } from "react";

type ArrivalSummaryResource = {
  resourceId: ResourcesIds;
  amount: number;
};

type ArrivalSummary = {
  id: string;
  resources: ArrivalSummaryResource[];
  secondsUntilArrival: number;
  isReady: boolean;
};

type ArrivalResourceLike = {
  resourceId: ResourcesIds;
  amount: number;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

export const StructureArrivals = memo(({ structure, now: nowOverride }: { structure: Structure; now?: number }) => {
  const chainNowMs = useNowMs();
  const arrivals = useArrivalsByStructure(structure.entityId);

  const now = nowOverride ?? Math.floor(chainNowMs / 1000);
  const mode = useGameModeConfig();
  const structureName = useMemo(() => {
    return mode.structure.getName(structure.structure).name;
  }, [mode.structure, structure]);

  const arrivalsWithResources = useMemo(
    () =>
      arrivals
        .filter((arrival) => arrival.resources.some(isDefined))
        .toSorted((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt)),
    [arrivals],
  );

  const arrivalSummaries = useMemo<ArrivalSummary[]>(() => {
    return arrivalsWithResources.map((arrival) => {
      const resources: ArrivalSummaryResource[] = arrival.resources
        .filter(isDefined)
        .map((resource: ArrivalResourceLike) => ({
          resourceId: resource.resourceId,
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
    <HudPanel
      kind="section"
      title={structureName}
      collapsible={false}
      cue={
        <span className="flex items-center gap-2">
          {readyCount > 0 && <HudChip tone="good">{readyCount} ready</HudChip>}
          {pendingCount > 0 && <HudChip>{pendingCount} pending</HudChip>}
        </span>
      }
    >
      <div className="flex flex-col gap-1">
        {arrivalSummaries.map((summary) => (
          <HudRow
            key={summary.id}
            lead={
              summary.isReady ? (
                <span className="flex w-24 items-center gap-1.5 text-hud-label text-hud-good">
                  <SemanticIcon name="refresh" size={12} className="animate-spin" />
                  Claiming
                </span>
              ) : (
                <span className="flex w-24 items-center gap-1.5 text-hud-label tabular-nums text-hud-muted">
                  <SemanticIcon name="hourglass" size={12} />
                  {formatWait(summary.secondsUntilArrival)}
                </span>
              )
            }
            title={
              <span className="flex flex-wrap gap-1.5">
                {summary.resources.map((resource) => (
                  <ResourceCost
                    key={`${summary.id}-${resource.resourceId}`}
                    type="vertical"
                    size="xs"
                    withTooltip
                    resourceId={resource.resourceId}
                    amount={resource.amount}
                  />
                ))}
              </span>
            }
          />
        ))}
      </div>
    </HudPanel>
  );
});
