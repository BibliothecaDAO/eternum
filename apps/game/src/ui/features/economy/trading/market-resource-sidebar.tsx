import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { HudField, HudTableHead } from "@/ui/design-system/kit/hud-elements";
import { resolveBestPrices } from "./best-prices";
import { MarketResourceRow } from "./market-resource-row";
import { MarketManager } from "@bibliothecadao/eternum";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { ID, MarketInterface, ResourcesIds, resourceName } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

/** The list's columns: the resource and its balance, then its best buy, best sell and AMM prices. */
export const MARKET_RESOURCE_COLS = "minmax(0,2fr) 1fr 1fr 1fr";

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
  const mode = useGameModeConfig();
  const facts = useNativeFacts(["Market"]);
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
      prices.set(resourceId, new MarketManager(facts.store, 0n, resourceId).getMarketPrice() || 0);
    }
    return prices;
  }, [tradableResources, facts]);

  // Indexed once per offer set instead of once per row.
  const bestPrices = useMemo(
    () => resolveBestPrices(resourceBidOffers, resourceAskOffers),
    [resourceBidOffers, resourceAskOffers],
  );

  const visibleResources = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tradableResources;
    return tradableResources.filter((resourceId) => resourceName(resourceId).toLowerCase().includes(needle));
  }, [tradableResources, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <HudField
        value={search}
        icon="search"
        placeholder="Search resources…"
        aria-label="Search resources"
        autoComplete="off"
        onChange={setSearch}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <HudTableHead cols={MARKET_RESOURCE_COLS}>
        <span>Resource</span>
        <span className="text-right">Buy</span>
        <span className="text-right">Sell</span>
        <span className="text-right">AMM</span>
      </HudTableHead>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
