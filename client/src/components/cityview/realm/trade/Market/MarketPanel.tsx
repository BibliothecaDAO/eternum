import { useEffect, useMemo, useRef, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { ReactComponent as Refresh } from "../../../../../assets/icons/common/refresh.svg";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
import { CreateOfferPopup } from "../CreateOffer";
import Button from "../../../../../elements/Button";
import { MarketOffer } from "./MarketOffer";
import { AcceptOfferPopup } from "../AcceptOffer";
import { sortTrades } from "../../../../../hooks/helpers/useTrade";
import { RoadBuildPopup } from "../Roads/RoadBuildPopup";
import { MarketPopup } from "./MarketPopup";
import { MarketInterface } from "@bibliothecadao/eternum";
import useMarketStore from "../../../../../hooks/store/useMarketStore";
import useUIStore from "../../../../../hooks/store/useUIStore";

type MarketPanelProps = {
  directOffers: boolean;
};

export const MarketPanel = ({ directOffers }: MarketPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<MarketInterface | undefined>(undefined);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [buildRoadToEntityId, setBuildRoadToEntityId] = useState<bigint | undefined>(undefined);

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

  const setTooltip = useUIStore((state) => state.setTooltip);

  const market = directOffers
    ? useMarketStore((state) => state.directOffers)
    : useMarketStore((state) => state.generalMarket);

  // const refreshMarket = useMarketStore((state) => state.refreshMarket);

  const [visibleOffersCount, setVisibleOffersCount] = useState(10); // new state to track the number of visible offers

  const loadMoreOffers = () => {
    setVisibleOffersCount((prevCount) => prevCount + 10);
  };

  // Use an intersection observer to detect when the sentinel element is visible
  const sentinelRef = useRef(null);

  const renderedMarketOffers = useMemo(() => {
    if (!market) return null;

    return (
      <div className="flex flex-col p-2 space-y-2">
        {sortTrades(market, activeSort)
          .slice(0, visibleOffersCount) // modify this line to control the number of displayed offers
          .map((trade) => (
            <MarketOffer
              key={trade.tradeId}
              marketOffer={trade}
              onAccept={() => setSelectedTrade(trade)}
              onBuildRoad={() => setBuildRoadToEntityId(trade.makerId)}
            />
          ))}
        <div ref={sentinelRef}></div> {/* sentinel element */}
      </div>
    );
  }, [market, activeSort, visibleOffersCount]); // add visibleOffersCount to dependencies

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMoreOffers();
      }
    });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="fixed top-0 left-0">
        {showCreateOffer && <CreateOfferPopup onClose={() => setShowCreateOffer(false)} onCreate={() => {}} />}
        {showMarketplace && <MarketPopup onClose={() => setShowMarketplace(false)} />}
        {buildRoadToEntityId !== undefined && (
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
      </div>
      <div className="flex flex-col min-h-[125px] relative pb-3">
        <div className="flex justify-between">
          <FiltersPanel className="px-3 py-2">
            <FilterButton active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>
              Filter
            </FilterButton>
            <ResourceFilter selectedResources={selectedResources} setSelectedResources={setSelectedResources} />
            <OrdersFilter selectedOrders={selectedOrders} setSelectedOrders={setSelectedOrders} />
          </FiltersPanel>
          <div className="flex justify-content items-center mr-2">
            {!directOffers && (
              <Refresh
                // onClick={() => refreshMarket()}
                // todo: find a way to refresh asynchronously
                onClick={() => {}}
                onMouseLeave={() => setTooltip(null)}
                onMouseEnter={() =>
                  setTooltip({
                    position: "bottom",
                    content: (
                      <>
                        <p className="whitespace-nowrap">Click here to refresh the marketplace</p>
                      </>
                    ),
                  })
                }
                className="text-gold cursor-pointer"
              ></Refresh>
            )}
          </div>
        </div>
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
        {renderedMarketOffers}
        <div className="flex items-center justify-center sticky w-32 -translate-x-1/2 bottom-2 left-1/2 ">
          <Button className="!rounded-full" onClick={() => setShowCreateOffer(true)} variant="primary">
            + Create new offer
          </Button>
          <Button className="!rounded-full ml-2" onClick={() => setShowMarketplace(true)} variant="primary">
            Open Marketplace
          </Button>
        </div>
      </div>
    </>
  );
};
