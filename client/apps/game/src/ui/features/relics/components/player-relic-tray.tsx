import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { BottomHudEmptyState } from "@/ui/features/world/components/hud-bottom";
import { currencyFormat } from "@/ui/utils/utils";
import { PlayerRelicsData } from "@bibliothecadao/torii";
import { ID, ResourcesIds } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

interface PlayerRelicTrayProps {
  variant?: "floating" | "embedded";
  className?: string;
}

interface AggregatedRelic {
  resourceId: ID;
  amount: number;
  displayAmount: string;
}

const RELIC_ITEM_CLASSES =
  "flex h-full w-full flex-col items-center justify-center rounded-md border text-center px-1 py-0.5";
const RELIC_ITEM_THEME = "border-relic2/40 bg-relic/10 backdrop-blur-sm";
const RELIC_AMOUNT_CLASS = "text-[10px] font-semibold text-gold/90";

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
    const key = ResourcesIds[resourceId];
    if (typeof key === "string") {
      return key;
    }
  }

  if (typeof resourceId === "string") {
    const numericId = Number(resourceId);
    if (!Number.isNaN(numericId)) {
      const key = ResourcesIds[numericId];
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

const renderRelicGrid = (relics: AggregatedRelic[], gridClass: string, iconSize: "xs" | "sm") => (
  <div className={gridClass}>
    {relics.map((relic) => {
      const resourceKey = resolveResourceKey(relic.resourceId);
      return (
        <div key={`${relic.resourceId}`} className={cn(RELIC_ITEM_CLASSES, RELIC_ITEM_THEME)}>
          <ResourceIcon resource={resourceKey} size={iconSize} withTooltip />
          <span className={RELIC_AMOUNT_CLASS}>{relic.displayAmount}</span>
        </div>
      );
    })}
  </div>
);

export const PlayerRelicTray = memo(({ variant = "floating", className }: PlayerRelicTrayProps = {}) => {
  const playerRelics = useUIStore((state) => state.playerRelics);
  const playerRelicsLoading = useUIStore((state) => state.playerRelicsLoading);

  const aggregatedRelics = useMemo(() => aggregateRelics(playerRelics), [playerRelics]);

  if (variant === "embedded") {
    return (
      <div className={cn("flex h-full min-h-0 flex-col gap-1", className)}>
        {aggregatedRelics.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-auto pr-1">
            {renderRelicGrid(aggregatedRelics, "grid grid-cols-[repeat(auto-fit,minmax(48px,1fr))] gap-1", "xs")}
          </div>
        ) : (
          <BottomHudEmptyState className="flex-1">No relics discovered yet.</BottomHudEmptyState>
        )}
        {playerRelicsLoading && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-gold/60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold/70" /> Updating
          </div>
        )}
      </div>
    );
  }

  if (aggregatedRelics.length === 0) {
    return null;
  }

  return (
    <div className={cn("pointer-events-auto ml-auto", className)}>
      <div className="rounded-xl border border-gold/25 bg-black/80 p-2 shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold/60">Relics</span>
          {playerRelicsLoading && (
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-gold/60">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold/70" /> Updating
            </div>
          )}
        </div>
        <div className="max-w-xs overflow-x-auto">
          {renderRelicGrid(aggregatedRelics, "grid auto-cols-[minmax(56px,1fr)] grid-flow-col gap-1", "sm")}
        </div>
      </div>
    </div>
  );
});
