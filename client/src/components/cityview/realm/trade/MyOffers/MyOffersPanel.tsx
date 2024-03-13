import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import Button from "../../../../../elements/Button";
import { MyOffer } from "./MyOffer";
import { sortTrades, useGetMyOffers } from "../../../../../hooks/helpers/useTrade";
import { IncomingOrder } from "../Caravans/IncomingOrder";
import { useResources } from "../../../../../hooks/helpers/useResources";
import { RoadBuildPopup } from "../Roads/RoadBuildPopup";
import { FastCreateOfferPopup } from "../FastCreateOffer";
import { useGetRoads } from "../../../../../hooks/helpers/useRoads";
import useRealmStore from "../../../../../hooks/store/useRealmStore";

type MarketPanelProps = {};

export const MyOffersPanel = ({}: MarketPanelProps) => {
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [buildRoadToEntityId, setBuildRoadToEntityId] = useState<bigint | undefined>(undefined);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const myOffers = useGetMyOffers();

  const { roads } = useGetRoads(realmEntityId);

  const { getCaravansWithResourcesChest } = useResources();
  const caravanIds = getCaravansWithResourcesChest();

  const sortingParams = useMemo(() => {
    return [
      { label: "Realm", sortKey: "realm" },
      { label: "Give", sortKey: "give", className: "ml-4" },
      { label: "Exchange rate", sortKey: "ratio", className: "ml-auto mr-4" },
      { label: "Get", sortKey: "get", className: "ml-auto mr-4" },
      { label: "Travel time", sortKey: "time", className: "ml-auto mr-4" },
    ];
  }, []);

  return (
    <div className="relative flex flex-col pb-3 min-h-[120px]">
      <FiltersPanel className="px-3 py-2"></FiltersPanel>
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
      {/* // TODO: need to filter on only trades that are relevant (status, not expired, etc) */}
      {showCreateOffer && <FastCreateOfferPopup onClose={() => setShowCreateOffer(false)} onCreate={() => {}} />}
      {buildRoadToEntityId !== undefined && (
        <RoadBuildPopup onClose={() => setBuildRoadToEntityId(undefined)} toEntityId={buildRoadToEntityId} />
      )}
      <div className="flex flex-col p-2 space-y-2">
        {caravanIds.map((caravanId) => (
          <IncomingOrder key={caravanId} caravanId={caravanId} />
        ))}
        {myOffers.length > 0 &&
          sortTrades(myOffers, activeSort).map((myOffer) => (
            <MyOffer
              key={myOffer.tradeId}
              myOffer={myOffer}
              roads={roads}
              onBuildRoad={() => setBuildRoadToEntityId(myOffer.takerId)}
            />
          ))}
      </div>
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
