import { useMarketStore } from "@/hooks/store/use-market-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatNumber } from "@/ui/utils/utils";
import { findResourceById, ResourcesIds } from "@bibliothecadao/types";
import { memo } from "react";
import type { BestPriceResult, Venue } from "@/hooks/helpers/use-best-price";

interface VenueComparisonProps {
  bestPriceResult: BestPriceResult;
  resourceId: ResourcesIds;
}

const BestBadge = () => (
  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-green/90 text-black rounded-full">
    Best
  </span>
);

const VenueCard = memo(
  ({
    title,
    price,
    isBest,
    isSelected,
    onClick,
    resourceId,
    children,
  }: {
    title: string;
    price: number | null;
    isBest: boolean;
    isSelected: boolean;
    onClick: () => void;
    resourceId: ResourcesIds;
    children?: React.ReactNode;
  }) => {
    const resourceName = findResourceById(resourceId)?.trait || "";

    return (
      <div
        onClick={onClick}
        className={`relative flex-1 p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
          isSelected ? "border-gold/50 bg-gold/10" : "border-gold/15 bg-black/20 hover:border-gold/30 hover:bg-gold/5"
        }`}
      >
        {isBest && <BestBadge />}
        <div className="text-xs text-gold/50 uppercase mb-1">{title}</div>
        {price !== null ? (
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-medium text-gold">{formatNumber(price, 4)}</span>
            <div className="flex items-center gap-0.5 text-xs text-gold/50">
              <ResourceIcon resource="Lords" size="xs" withTooltip={false} />
              <span>/</span>
              <ResourceIcon resource={resourceName} size="xs" withTooltip={false} />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gold/30">No liquidity</div>
        )}
        {children && <div className="mt-1.5 text-xs text-gold/40">{children}</div>}
      </div>
    );
  },
);

VenueCard.displayName = "VenueCard";

export const VenueComparison = memo(({ bestPriceResult, resourceId }: VenueComparisonProps) => {
  const selectedVenue = useMarketStore((state) => state.selectedVenue);
  const setSelectedVenue = useMarketStore((state) => state.setSelectedVenue);

  const { obPrice, ammPrice, bestVenue, obAvailable, ammSlippage } = bestPriceResult;

  return (
    <div className="flex gap-2">
      <VenueCard
        title="Order Book"
        price={obPrice}
        isBest={bestVenue === "orderbook"}
        isSelected={selectedVenue === "orderbook"}
        onClick={() => setSelectedVenue(selectedVenue === "orderbook" ? "best" : "orderbook")}
        resourceId={resourceId}
      >
        {obPrice !== null && <span>{obAvailable > 0 ? `${formatNumber(obAvailable, 0)} available` : "No orders"}</span>}
      </VenueCard>

      <VenueCard
        title="AMM"
        price={ammPrice}
        isBest={bestVenue === "amm"}
        isSelected={selectedVenue === "amm"}
        onClick={() => setSelectedVenue(selectedVenue === "amm" ? "best" : "amm")}
        resourceId={resourceId}
      >
        {ammPrice !== null && ammSlippage > 0 && (
          <span className={ammSlippage > 2 ? "text-red" : ""}>Slippage: {formatNumber(ammSlippage, 2)}%</span>
        )}
      </VenueCard>
    </div>
  );
});

VenueComparison.displayName = "VenueComparison";
