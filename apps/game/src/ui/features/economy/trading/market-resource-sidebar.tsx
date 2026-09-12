import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { MarketResourceRow } from "./market-resource-row";
import { MarketManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { findResourceById, ID, MarketInterface, ResourcesIds } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

const SEARCH_INPUT_CLASS =
  "h-8 w-full rounded-md border border-gold/25 bg-black/40 px-2 text-xs text-gold placeholder:text-gold/40 focus:border-gold/60 focus:outline-none";

export const MarketResourceSidebar = ({
  entityId,
  onClick,
  selectedResource,
  resourceAskOffers,
  resourceBidOffers,
}: {
  entityId: ID;
  onClick: (value: number) => void;
  selectedResource: number;
  resourceAskOffers: MarketInterface[];
  resourceBidOffers: MarketInterface[];
}) => {
  const dojo = useDojo();
  const mode = useGameModeConfig();
  const [search, setSearch] = useState("");

  const tradableResources = useMemo(
    () =>
      Object.values(mode.resources.getTiers())
        .flat()
        .filter((resourceId) => resourceId !== ResourcesIds.Lords),
    [mode.resources],
  );

  const ammPrices = useMemo(() => {
    const prices = new Map<number, number>();
    for (const resourceId of tradableResources) {
      prices.set(resourceId, new MarketManager(dojo.setup.components, 0n, resourceId).getMarketPrice() || 0);
    }
    return prices;
  }, [tradableResources, dojo.setup.components]);

  // Best price per resource, indexed once per offer set instead of once per row.
  const bestPrices = useMemo(() => {
    const highestBid = new Map<number, number>();
    const lowestAsk = new Map<number, number>();
    for (const offer of resourceBidOffers) {
      const resourceId = offer.makerGets[0]?.resourceId;
      if (resourceId !== undefined && offer.perLords > (highestBid.get(resourceId) ?? -Infinity)) {
        highestBid.set(resourceId, offer.perLords);
      }
    }
    for (const offer of resourceAskOffers) {
      const resourceId = offer.takerGets[0]?.resourceId;
      if (resourceId !== undefined && offer.perLords < (lowestAsk.get(resourceId) ?? Infinity)) {
        lowestAsk.set(resourceId, offer.perLords);
      }
    }
    return { highestBid, lowestAsk };
  }, [resourceBidOffers, resourceAskOffers]);

  const visibleResources = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tradableResources;
    return tradableResources.filter((resourceId) =>
      (findResourceById(resourceId)?.trait ?? "").toLowerCase().includes(needle),
    );
  }, [tradableResources, search]);

  return (
    <div className="market-resource-bar-selector flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-2">
        <input
          type="text"
          value={search}
          placeholder="Search resources…"
          autoComplete="off"
          onChange={(event) => setSearch(event.currentTarget.value)}
          onKeyDown={(event) => event.stopPropagation()}
          className={SEARCH_INPUT_CLASS}
        />
      </div>
      <div className={`grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] border-b border-gold/15 px-3 pb-1.5 ${HUD_LABEL}`}>
        <span>Resource</span>
        <span className="market-resource-bar-buy-selector text-right">Buy</span>
        <span className="market-resource-bar-sell-selector text-right">Sell</span>
        <span className="market-resource-bar-amm-selector text-right">AMM</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        {visibleResources.map((resourceId) => (
          <MarketResourceRow
            key={resourceId}
            entityId={entityId}
            resourceId={resourceId}
            active={selectedResource === resourceId}
            onClick={onClick}
            buyPrice={bestPrices.lowestAsk.get(resourceId) ?? 0}
            sellPrice={bestPrices.highestBid.get(resourceId) ?? 0}
            ammPrice={ammPrices.get(resourceId) ?? 0}
          />
        ))}
      </div>
    </div>
  );
};
