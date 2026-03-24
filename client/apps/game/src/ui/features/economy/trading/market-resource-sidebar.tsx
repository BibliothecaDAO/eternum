import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import TextInput from "@/ui/design-system/atoms/text-input";
import { MarketResourceRow } from "./market-resource-row";
import { MarketManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { findResourceById, ID, MarketInterface, ResourcesIds } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

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
  const mode = useGameModeConfig();
  const [localSearch, setLocalSearch] = useState(search);

  const filteredResources = useMemo(() => {
    return Object.entries(mode.resources.getTiers()).flatMap(([_, resourceIds]) => {
      return resourceIds;
    });
  }, [mode.resources]);

  const ammPrices = useMemo(() => {
    const prices: Record<number, number> = {};
    filteredResources
      .filter((resourceId) => resourceId !== ResourcesIds.Lords)
      .forEach((resourceId) => {
        const marketManager = new MarketManager(dojo.setup.components, 0n, resourceId);
        prices[resourceId] = marketManager?.getMarketPrice() || 0;
      });
    return prices;
  }, [filteredResources, dojo.setup.components]);

  // Pre-index best prices per resource - O(offers) instead of O(resources * offers)
  const priceIndex = useMemo(() => {
    const bestBid = new Map<number, number>(); // highest bid per resource
    const bestAsk = new Map<number, number>(); // lowest ask per resource

    for (const offer of resourceBidOffers) {
      const rid = offer.makerGets[0]?.resourceId;
      if (rid !== undefined) {
        const current = bestBid.get(rid);
        if (current === undefined || offer.perLords > current) {
          bestBid.set(rid, offer.perLords);
        }
      }
    }

    for (const offer of resourceAskOffers) {
      const rid = offer.takerGets[0]?.resourceId;
      if (rid !== undefined) {
        const current = bestAsk.get(rid);
        if (current === undefined || offer.perLords < current) {
          bestAsk.set(rid, offer.perLords);
        }
      }
    }

    return { bestBid, bestAsk };
  }, [resourceBidOffers, resourceAskOffers]);

  const resourceList = useMemo(() => {
    return filteredResources
      .filter((resourceId) => resourceId !== ResourcesIds.Lords)
      .filter((resourceId) => {
        if (!localSearch) return true;
        const name = findResourceById(resourceId)?.trait || "";
        return name.toLowerCase().includes(localSearch.toLowerCase());
      })
      .map((resourceId) => (
        <MarketResourceRow
          key={resourceId}
          entityId={entityId || 0}
          resourceId={resourceId}
          active={selectedResource == resourceId}
          onClick={onClick}
          askPrice={priceIndex.bestBid.get(resourceId) || 0}
          bidPrice={priceIndex.bestAsk.get(resourceId) || 0}
          ammPrice={ammPrices[resourceId] || 0}
        />
      ));
  }, [filteredResources, selectedResource, entityId, onClick, ammPrices, priceIndex, localSearch]);

  return (
    <div className="market-resource-bar-selector panel-wood-top">
      <div className="px-2 py-1.5">
        <TextInput placeholder="Search resources..." onChange={(val) => setLocalSearch(val)} value={localSearch} className="w-full" />
      </div>
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
