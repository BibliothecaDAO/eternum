import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
import { CreateOfferPopup } from "../CreateOffer";
import Button from "../../../../../elements/Button";
import { MarketOffer } from "./MarketOffer";
import { AcceptOfferPopup } from "../AcceptOffer";
import { MarketInterface, sortTrades, useGetMarket } from "../../../../../hooks/helpers/useTrade";
import { RoadBuildPopup } from "../Roads/RoadBuildPopup";

type MarketPanelProps = {
  directOffers: boolean;
};

export const MarketPanel = ({ directOffers }: MarketPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<MarketInterface | undefined>(undefined);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [buildRoadToEntityId, setBuildRoadToEntityId] = useState<number | undefined>(undefined);

  const sortingParams = useMemo(() => {
    return [
      { label: "Realm", sortKey: "realm" },
      { label: "Give", sortKey: "give", className: "ml-4" },
      { label: "Exchange rate", sortKey: "ratio", className: "ml-auto mr-4" },
      { label: "Get", sortKey: "get", className: "ml-auto mr-4" },
      { label: "Travel distance", sortKey: "distance", className: "ml-auto mr-4" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const market = useGetMarket({ selectedResources, selectedOrders, directOffers });

  const renderedMarketOffers = useMemo(() => {
    if (!market) return null;

    return (
      <div className="flex flex-col p-2 space-y-2">
        {sortTrades(market, activeSort).map((trade) => (
          <MarketOffer
            key={trade.tradeId}
            marketOffer={trade}
            onAccept={() => setSelectedTrade(trade)}
            onBuildRoad={() => setBuildRoadToEntityId(trade.makerId)}
          />
        ))}
      </div>
    );
  }, [market, activeSort]);

  return (
    <div className="flex flex-col min-h-[125px] relative pb-3">
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>
          Filter
        </FilterButton>
        <ResourceFilter selectedResources={selectedResources} setSelectedResources={setSelectedResources} />
        <OrdersFilter selectedOrders={selectedOrders} setSelectedOrders={setSelectedOrders} />
      </FiltersPanel>
      <SortPanel className="px-3 py-2">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>
      {showCreateOffer && <CreateOfferPopup onClose={() => setShowCreateOffer(false)} onCreate={() => {}} />}
      {buildRoadToEntityId && (
        <RoadBuildPopup onClose={() => setBuildRoadToEntityId(undefined)} toEntityId={buildRoadToEntityId} />
      )}
      {selectedTrade && (
        <AcceptOfferPopup
          onClose={() => {
            setSelectedTrade(undefined);
          }}
          selectedTrade={selectedTrade}
        />
      )}
      {renderedMarketOffers}
      <Button
        className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full"
        onClick={() => setShowCreateOffer(true)}
        variant="primary"
      >
        + Create new offer
      </Button>
    </div>
  );
};
