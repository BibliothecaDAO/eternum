import { useEffect, useMemo, useRef, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "./ResourceFilter";
import { OrdersFilter } from "./OrdersFilter";
import Button from "../../../../../elements/Button";
import { MarketOffer } from "./MarketOffer";
import { AcceptOfferPopup } from "../AcceptOffer";
import { sortTrades, useTrade } from "../../../../../../hooks/helpers/useTrade";
import { RoadBuildPopup } from "../Roads/RoadBuildPopup";
import { MarketPopup } from "./MarketPopup";
import { MarketInterface } from "@bibliothecadao/eternum";
import useMarketStore from "../../../../../../hooks/store/useMarketStore";
import useUIStore from "../../../../../../hooks/store/useUIStore";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { hasResources } from "../utils";
import { Checkbox } from "../../../../../elements/Checkbox";
import { DirectOffersExplorerPopup } from "../DirectOffers/DirectOffersExplorerPopup";
import { FastCreateOfferPopup } from "../FastCreateOffer";
import { useGetRoads } from "../../../../../../hooks/helpers/useRoads";

type MarketPanelProps = {
  directOffers: boolean;
};

export const MarketPanel = ({ directOffers }: MarketPanelProps) => {
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showDirectOffersExplorer, setShowDirectOffersExplorer] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<MarketInterface | undefined>(undefined);
  const [selectedBuyResources, setSelectedBuyResources] = useState<number[]>([]);
  const [selectedSellResources, setSelectedSellResources] = useState<number[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [canAcceptFilterActive, setCanAcceptFilterActive] = useState(true);
  const [buildRoadToEntityId, setBuildRoadToEntityId] = useState<bigint | undefined>(undefined);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { canAcceptOffer } = useTrade();

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
    : // filter out your own offers
      useMarketStore((state) => state.generalMarket).filter((offer) => offer.makerId !== realmEntityId);

  // const refreshMarket = useMarketStore((state) => state.refreshMarket);

  const [visibleOffersCount, setVisibleOffersCount] = useState(10); // new state to track the number of visible offers

  const loadMoreOffers = () => {
    setVisibleOffersCount((prevCount) => prevCount + 10);
  };

  // Use an intersection observer to detect when the sentinel element is visible
  const sentinelRef = useRef(null);

  // rerender if new roads
  const { roads } = useGetRoads(realmEntityId);

  const renderedMarketOffers = useMemo(() => {
    if (!market) return null;

    return (
      <div className="flex flex-col p-2 space-y-2">
        {sortTrades(market, activeSort)
          .filter((offer) => {
            return canAcceptFilterActive ? canAcceptOffer({ realmEntityId, resourcesGive: offer.makerGets }) : true;
          })
          .filter((offer) => {
            return hasResources(offer.takerGets, selectedBuyResources);
          })
          .filter((offer) => {
            return hasResources(offer.makerGets, selectedSellResources);
          })
          .filter((offer) => {
            return selectedOrders.length === 0 || selectedOrders.includes(offer.makerOrder);
          })
          .slice(0, visibleOffersCount) // modify this line to control the number of displayed offers
          .map((trade) => (
            <MarketOffer
              key={trade.tradeId}
              marketOffer={trade}
              roads={roads}
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
      {showCreateOffer && <FastCreateOfferPopup onClose={() => setShowCreateOffer(false)} onCreate={() => {}} />}
      {showMarketplace && <MarketPopup onClose={() => setShowMarketplace(false)} />}
      {showDirectOffersExplorer && <DirectOffersExplorerPopup onClose={() => setShowDirectOffersExplorer(false)} />}
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
      <div className="flex flex-col min-h-[125px] relative pb-3">
        <div className="flex justify-between">
          <FiltersPanel className="px-3 py-2">
            <ResourceFilter selectedResources={selectedSellResources} setSelectedResources={setSelectedSellResources}>
              Sell Resources
            </ResourceFilter>
            <ResourceFilter selectedResources={selectedBuyResources} setSelectedResources={setSelectedBuyResources}>
              Buy Resources
            </ResourceFilter>
            <OrdersFilter selectedOrders={selectedOrders} setSelectedOrders={setSelectedOrders} />
            {(selectedBuyResources.length > 0 || selectedSellResources.length > 0 || selectedOrders.length > 0) && (
              <button
                onClick={() => {
                  setSelectedBuyResources([]);
                  setSelectedSellResources([]);
                  setSelectedOrders([]);
                }}
                className="items-center border flex rounded border-gold py-0.5 px-1 text-xxs text-gold"
              >
                Clear All
              </button>
            )}
          </FiltersPanel>
          <div className="flex justify-content items-center mr-2">
            <div
              className="flex text-xs text-gray-gold space-x-1 mr-2 items-center cursor-pointer"
              onClick={() => setCanAcceptFilterActive(!canAcceptFilterActive)}
            >
              <Checkbox enabled={canAcceptFilterActive} />
              <div>Accept</div>
            </div>
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
          {!directOffers && (
            <>
              <Button className="!rounded-full" onClick={() => setShowCreateOffer(true)} variant="primary">
                + Create new offer
              </Button>
              <Button className="!rounded-full ml-2" onClick={() => setShowMarketplace(true)} variant="primary">
                Open Marketplace
              </Button>
            </>
          )}
          {directOffers && (
            <Button className="!rounded-full ml-2" onClick={() => setShowDirectOffersExplorer(true)} variant="primary">
              + Create direct offer
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
