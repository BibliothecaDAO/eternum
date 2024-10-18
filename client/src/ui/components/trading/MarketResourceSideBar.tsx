import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ID, MarketInterface, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { MarketResource } from "./MarketOrderPanel";

export const MarketResourceSidebar = ({
  entityId,
  bankEntityId,
  search,
  onClick,
  selectedResource,
  resourceAskOffers,
  resourceBidOffers,
}: {
  entityId: ID;
  bankEntityId: ID | undefined;
  search: string;
  onClick: (value: number) => void;
  selectedResource: number;
  resourceAskOffers: MarketInterface[];
  resourceBidOffers: MarketInterface[];
}) => {
  const { setup } = useDojo();

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      return resource.trait.toLowerCase().includes(search.toLowerCase());
    });
  }, []);

  return (
    <div className=" px-1 bg-brown rounded-2xl p-1">
      <div className="w-full mb-1">
        <div className="grid grid-cols-5 text-xs font-bold uppercase py-2">
          <div className="col-span-2 px-2">Resource</div>
          <div className="flex items-center justify-center">Buy</div>
          <div className="flex items-center justify-center">Sell</div>
          <div className="flex items-center justify-center">AMM</div>
        </div>
      </div>

      <div className="flex flex-col h-full gap-[0.1]">
        {filteredResources
          .filter((resource) => resource.id !== ResourcesIds.Lords)
          .map((resource) => {
            const marketManager = bankEntityId ? new MarketManager(setup, bankEntityId, 0n, resource.id) : undefined;

            const askPrice = resourceBidOffers
              .filter((offer) => (resource.id ? offer.makerGets[0]?.resourceId === resource.id : true))
              .reduce((acc, offer) => (offer.perLords > acc ? offer.perLords : acc), 0);

            const bidPrice = resourceAskOffers
              .filter((offer) => offer.takerGets[0].resourceId === resource.id)
              .reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);

            const ammPrice = marketManager?.getMarketPrice() || 0;

            return (
              <MarketResource
                key={resource.id}
                entityId={entityId || 0}
                resource={resource}
                active={selectedResource == resource.id}
                onClick={onClick}
                askPrice={askPrice === Infinity ? "0" : askPrice.toFixed(2)}
                bidPrice={bidPrice === Infinity ? "0" : bidPrice.toFixed(2)}
                ammPrice={ammPrice}
              />
            );
          })}
      </div>
    </div>
  );
};
