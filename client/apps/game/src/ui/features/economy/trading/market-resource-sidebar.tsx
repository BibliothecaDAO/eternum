import { MarketResource } from "@/ui/features/economy/trading";
import { MarketManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ID, MarketInterface, RESOURCE_TIERS, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";

export const MarketResourceSidebar = ({
  entityId,
  search,
  onClick,
  selectedResource,
  resourceAskOffers,
  resourceBidOffers,
}: {
  entityId: ID;
  search: string;
  onClick: (value: number) => void;
  selectedResource: number;
  resourceAskOffers: MarketInterface[];
  resourceBidOffers: MarketInterface[];
}) => {
  const dojo = useDojo();

  const filteredResources = useMemo(() => {
    return Object.entries(RESOURCE_TIERS).flatMap(([_, resourceIds]) => {
      return resourceIds;
    });
  }, []);

  const resourceList = useMemo(() => {
    return filteredResources
      .filter((resourceId) => resourceId !== ResourcesIds.Lords)
      .map((resourceId) => {
        const marketManager = new MarketManager(dojo.setup.components, 0n, resourceId);

        const askPrice = resourceBidOffers
          .filter((offer) => (resourceId ? offer.makerGets[0]?.resourceId === resourceId : true))
          .reduce((acc, offer) => (offer.perLords > acc ? offer.perLords : acc), 0);

        const bidPrice = resourceAskOffers
          .filter((offer) => offer.takerGets[0].resourceId === resourceId)
          .reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);

        const ammPrice = marketManager?.getMarketPrice() || 0;

        return (
          <MarketResource
            key={resourceId}
            entityId={entityId || 0}
            resourceId={resourceId}
            active={selectedResource == resourceId}
            onClick={onClick}
            askPrice={askPrice === Infinity ? 0 : askPrice}
            bidPrice={bidPrice === Infinity ? 0 : bidPrice}
            ammPrice={ammPrice}
          />
        );
      });
  }, [filteredResources, dojo.setup, resourceBidOffers, resourceAskOffers, selectedResource, entityId, onClick]);

  return (
    <div className="market-resource-bar-selector panel-wood-top">
      <div className="w-full mb-1 panel-wood-bottom">
        <div className="grid grid-cols-5 text-xs uppercase py-2 h6">
          <div className="col-span-2 px-2">Resource</div>
          <div className="market-resource-bar-buy-selector flex items-center justify-center">Buy</div>
          <div className="market-resource-bar-sell-selector flex items-center justify-center">Sell</div>
          <div className="market-resource-bar-amm-selector flex items-center justify-center">AMM</div>
        </div>
      </div>

      <div className="flex flex-col h-full gap-[0.1]">{resourceList}</div>
    </div>
  );
};
