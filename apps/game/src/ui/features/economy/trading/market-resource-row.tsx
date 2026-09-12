import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { HUD_CUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat, formatNumber } from "@/ui/utils/utils";
import { useResourceManager } from "@bibliothecadao/react";
import { findResourceById, ID, ResourcesIds } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

interface MarketResourceRowProps {
  entityId: ID;
  resourceId: ResourcesIds;
  active: boolean;
  onClick: (value: number) => void;
  /** Lowest ask: what buying one unit costs right now. */
  buyPrice: number;
  /** Highest bid: what selling one unit pays right now. */
  sellPrice: number;
  ammPrice: number;
}

const PRICE_CLASS = "text-right text-[11px] font-semibold tabular-nums";

export const MarketResourceRow = memo(
  ({ entityId, resourceId, active, onClick, buyPrice, sellPrice, ammPrice }: MarketResourceRowProps) => {
    const currentDefaultTick = useCoarseCurrentDefaultTick();
    const resourceManager = useResourceManager(entityId);
    const balance = useMemo(
      () => Number(resourceManager.balanceWithProduction(currentDefaultTick, resourceId).balance),
      [resourceManager, currentDefaultTick, resourceId],
    );
    const trait = findResourceById(resourceId)?.trait ?? "";

    return (
      <button
        type="button"
        onClick={() => onClick(resourceId)}
        aria-pressed={active}
        className={cn(
          "grid h-8 w-full grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] items-center rounded-md border px-1.5 text-left transition-colors",
          active ? "border-gold/60 bg-gold/10" : "border-transparent hover:bg-gold/10",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ResourceIcon size="xs" resource={trait} withTooltip={false} />
          <span className="truncate text-[11px] text-gold">{trait}</span>
          <span className={cn(HUD_CUE, "shrink-0 tracking-normal")}>{currencyFormat(balance, 0)}</span>
        </span>
        <span className={cn(PRICE_CLASS, buyPrice > 0 ? "text-green" : "text-gold/30")}>
          {formatNumber(buyPrice, 4)}
        </span>
        <span className={cn(PRICE_CLASS, sellPrice > 0 ? "text-red" : "text-gold/30")}>
          {formatNumber(sellPrice, 4)}
        </span>
        <span className={cn(PRICE_CLASS, ammPrice > 0 ? "text-blueish" : "text-gold/30")}>
          {formatNumber(ammPrice, 4)}
        </span>
      </button>
    );
  },
);

MarketResourceRow.displayName = "MarketResourceRow";
