import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { PlayerRelicsData } from "@bibliothecadao/torii";
import { ID, ResourcesIds } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

interface AggregatedRelic {
  resourceId: ID;
  amount: number;
  displayAmount: string;
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
};

const aggregateRelics = (playerRelics: PlayerRelicsData | null): AggregatedRelic[] => {
  if (!playerRelics) {
    return [];
  }

  const totals = new Map<ID, number>();

  const appendFromEntities = (
    entities: Array<{ relics?: Array<{ resourceId: ID; amount?: number | string | bigint }> }> | undefined,
  ) => {
    entities?.forEach((entity) => {
      entity.relics?.forEach((relic) => {
        const resourceId = relic.resourceId;
        const amount = toNumber(relic.amount);
        if (!resourceId || amount <= 0) {
          return;
        }

        const current = totals.get(resourceId) ?? 0;
        totals.set(resourceId, current + amount);
      });
    });
  };

  appendFromEntities(playerRelics.structures);
  appendFromEntities(playerRelics.armies);

  return Array.from(totals.entries())
    .map(([resourceId, amount]) => ({
      resourceId,
      amount,
      displayAmount: currencyFormat(amount, 0),
    }))
    .sort((a, b) => b.amount - a.amount);
};

const resolveResourceKey = (resourceId: ID): string => {
  if (typeof resourceId === "number") {
    const key = ResourcesIds[resourceId as keyof typeof ResourcesIds];
    if (typeof key === "string") {
      return key;
    }
  }

  if (typeof resourceId === "string") {
    const numericId = Number(resourceId);
    if (!Number.isNaN(numericId)) {
      const key = ResourcesIds[numericId as keyof typeof ResourcesIds];
      if (typeof key === "string") {
        return key;
      }
    }
    if (resourceId in ResourcesIds) {
      return resourceId;
    }
  }

  return resourceId.toString();
};

export const PlayerRelicTray = memo(() => {
  const playerRelics = useUIStore((state) => state.playerRelics);
  const playerRelicsLoading = useUIStore((state) => state.playerRelicsLoading);

  const aggregatedRelics = useMemo(() => aggregateRelics(playerRelics), [playerRelics]);

  if (aggregatedRelics.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-auto p-3 ml-auto">
      <div className="relative inline-flex items-center gap-2 rounded-2xl border border-gold/30 bg-black/70 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gold/60">Relics</span>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {aggregatedRelics.map((relic) => {
            const resourceKey = resolveResourceKey(relic.resourceId);
            return (
              <div key={`${relic.resourceId}`} className="relative">
                <ResourceIcon resource={resourceKey} size="xl" withTooltip />
                <span className="absolute bottom-0 right-0 translate-y-1/4 translate-x-1/4 rounded-full bg-black/85 px-1.5 text-[11px] font-bold leading-tight text-gold shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
                  {relic.displayAmount}
                </span>
              </div>
            );
          })}
        </div>

        {playerRelicsLoading && (
          <div className="absolute inset-0 rounded-2xl border border-gold/20 bg-black/30 backdrop-blur pointer-events-none animate-pulse" />
        )}
      </div>
    </div>
  );
});
