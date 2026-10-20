import { knownAmount } from "@/ui/utils/utils";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ID, ResourcesIds, formatAmount, resourceName, formatFigure } from "@bibliothecadao/types";
import { memo, useMemo } from "react";
import { MARKET_RESOURCE_COLS } from "./market-resource-sidebar";

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

/** A price in its side's tone (buying green, selling red), muted while no one offers it. */
const Price = ({ price, tone }: { price: number; tone?: "text-hud-good" | "text-hud-bad" }) => (
  <span className={`text-right tabular-nums ${price > 0 ? (tone ?? "") : "text-hud-muted"}`}>
    {formatFigure(price)}
  </span>
);

export const MarketResourceRow = memo(
  ({ entityId, resourceId, active, onClick, buyPrice, sellPrice, ammPrice }: MarketResourceRowProps) => {
    const currentDefaultTick = useCurrentDefaultTick();
    const resourceManager = useResourceManager(entityId);
    const balance = useMemo(
      () => resourceManager.balanceWithProduction(currentDefaultTick, resourceId)?.balance,
      [resourceManager, currentDefaultTick, resourceId],
    );
    const name = resourceName(resourceId);

    return (
      <HudTableRow cols={MARKET_RESOURCE_COLS} label={name} selected={active} onClick={() => onClick(resourceId)}>
        <span className="flex min-w-0 items-center gap-1.5">
          <ResourceIcon size="xs" resource={resourceId} withTooltip={false} />
          <span className="truncate">{name}</span>
          <span className="shrink-0 text-hud-label text-hud-muted">{formatAmount(knownAmount(balance))}</span>
        </span>
        <Price price={buyPrice} tone="text-hud-good" />
        <Price price={sellPrice} tone="text-hud-bad" />
        <Price price={ammPrice} />
      </HudTableRow>
    );
  },
);

MarketResourceRow.displayName = "MarketResourceRow";
