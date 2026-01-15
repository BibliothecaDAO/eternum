import { memo, useCallback, useMemo } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { EntityWithRelics, PlayerRelicsData } from "@bibliothecadao/torii";
import { EntityType, ID, RelicRecipientType } from "@bibliothecadao/types";
import { resolveRelicResourceKey } from "../hooks/use-relic-activation";

export interface RelicHolderPreview {
  entityId: ID;
  amount: number;
  recipientType: RelicRecipientType;
  entityType: EntityType;
}

interface PlayerRelicTrayProps {
  variant?: "floating" | "embedded";
  className?: string;
}

interface AggregatedRelic {
  resourceId: ID;
  amount: number;
  displayAmount: string;
  holders: RelicHolderPreview[];
}

interface RelicGridProps {
  relics: AggregatedRelic[];
  gridClass: string;
  iconSize: "xs" | "sm";
  onRelicClick: (relic: AggregatedRelic) => void;
}

const RELIC_ITEM_CLASSES =
  "flex h-full w-full flex-col items-center justify-center rounded-md border text-center px-1 py-0.5";
const RELIC_ITEM_THEME = "border-relic2/40 bg-relic/10 backdrop-blur-sm";
const RELIC_ITEM_INTERACTIVE =
  "cursor-pointer transition-colors duration-150 hover:bg-relic/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";
const RELIC_AMOUNT_CLASS = "text-xxs font-semibold text-gold/90";

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

  const relicMap = new Map<ID, AggregatedRelic>();

  const appendEntityRelics = (entity: EntityWithRelics, recipientType: RelicRecipientType) => {
    entity.relics?.forEach((relic) => {
      const resourceId = relic.resourceId;
      const amount = toNumber(relic.amount);
      if (!resourceId || amount <= 0) {
        return;
      }

      const holder: RelicHolderPreview = {
        entityId: entity.entityId,
        amount,
        recipientType,
        entityType: entity.type,
      };

      const current = relicMap.get(resourceId);

      if (current) {
        current.amount += amount;
        current.displayAmount = currencyFormat(current.amount, 0);
        current.holders.push(holder);
        return;
      }

      relicMap.set(resourceId, {
        resourceId,
        amount,
        displayAmount: currencyFormat(amount, 0),
        holders: [holder],
      });
    });
  };

  playerRelics.structures?.forEach((structure) => appendEntityRelics(structure, RelicRecipientType.Structure));
  playerRelics.armies?.forEach((army) => appendEntityRelics(army, RelicRecipientType.Explorer));

  return Array.from(relicMap.values()).sort((a, b) => b.amount - a.amount);
};

const RelicGrid = ({ relics, gridClass, iconSize, onRelicClick }: RelicGridProps) => (
  <div className={gridClass}>
    {relics.map((relic) => {
      const resourceKey = resolveRelicResourceKey(relic.resourceId);
      return (
        <div
          key={`${relic.resourceId}`}
          className={cn(RELIC_ITEM_CLASSES, RELIC_ITEM_THEME, RELIC_ITEM_INTERACTIVE)}
          onClick={() => onRelicClick(relic)}
        >
          <ResourceIcon resource={resourceKey} size={iconSize} />
          <span className={RELIC_AMOUNT_CLASS}>{relic.displayAmount}</span>
        </div>
      );
    })}
  </div>
);

export const PlayerRelicTray = memo(({ variant = "floating", className }: PlayerRelicTrayProps = {}) => {
  const playerRelics = useUIStore((state) => state.playerRelics);
  const playerRelicsLoading = useUIStore((state) => state.playerRelicsLoading);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const aggregatedRelics = useMemo(() => aggregateRelics(playerRelics), [playerRelics]);

  const handleRelicClick = useCallback(
    (relic: AggregatedRelic) => {
      import("./relic-activation-selector")
        .then(({ RelicActivationSelector }) => {
          toggleModal(
            <RelicActivationSelector
              resourceId={relic.resourceId}
              displayAmount={relic.displayAmount}
              holders={relic.holders}
              onClose={() => toggleModal(null)}
            />,
          );
        })
        .catch((error) => {
          console.error("Failed to load relic activation selector", error);
        });
    },
    [toggleModal],
  );

  if (variant === "embedded") {
    return (
      <div className={cn("flex h-full min-h-0 flex-col gap-1", className)}>
        {aggregatedRelics.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-auto pr-1">
            <RelicGrid
              relics={aggregatedRelics}
              gridClass="grid grid-cols-[repeat(auto-fit,minmax(48px,1fr))] gap-1"
              iconSize="xs"
              onRelicClick={handleRelicClick}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center text-xs font-medium text-gold/60 italic">
            No relics discovered yet.
          </div>
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
          <RelicGrid
            relics={aggregatedRelics}
            gridClass="grid auto-cols-[minmax(56px,1fr)] grid-flow-col gap-1"
            iconSize="sm"
            onRelicClick={handleRelicClick}
          />
        </div>
      </div>
    </div>
  );
});
