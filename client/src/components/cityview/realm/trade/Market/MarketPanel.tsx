import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
import { CreateOfferPopup } from "../CreateOffer";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { MarketOffer } from "./MarketOffer";
import { AcceptOfferPopup } from "../AcceptOffer";
import {
  MarketInterface,
  useSyncMarket,
} from "../../../../../hooks/graphql/useGraphQLQueries";
import { useGetMarket } from "../../../../../hooks/helpers/useTrade";

type MarketPanelProps = {};

export const MarketPanel = ({}: MarketPanelProps) => {
  const { realmEntityId } = useRealmStore();

  const [activeFilter, setActiveFilter] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<
    MarketInterface | undefined
  >(undefined);

  const sortingParams = useMemo(() => {
    return [
      { label: "Realm", sortKey: "realm" },
      { label: "Give", sortKey: "give", className: "ml-4" },
      { label: "Exchange rate", sortKey: "ratio", className: "ml-auto mr-4" },
      { label: "Get", sortKey: "get", className: "ml-auto mr-4" },
      { label: "Travel time", sortKey: "time", className: "ml-auto mr-4" },
    ];
  }, []);

  // TODO: find a way to only call this once the first render and not after every render and have a loading when it's querying
  useSyncMarket({ realmId: realmEntityId });

  const { market } = useGetMarket();

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });
  return (
    <div className="flex flex-col min-h-[125px] relative pb-10">
      <FiltersPanel className="px-3 py-2">
        <FilterButton
          active={activeFilter}
          onClick={() => setActiveFilter(!activeFilter)}
        >
          Filter
        </FilterButton>
        <ResourceFilter />
        <OrdersFilter />
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
      {/* // TODO: need to filter on only trades that are relevant (status, not expired, etc) */}
      {showCreateOffer && (
        <CreateOfferPopup
          onClose={() => setShowCreateOffer(false)}
          onCreate={() => {}}
        />
      )}
      {selectedTrade && (
        <AcceptOfferPopup
          onClose={() => {
            setSelectedTrade(undefined);
          }}
          selectedTrade={selectedTrade}
        />
      )}
      {market &&
        market.map((trade) => (
          <div className="flex flex-col p-2" key={trade.tradeId}>
            <MarketOffer
              marketOffer={trade}
              onAccept={() => setSelectedTrade(trade)}
            />
          </div>
        ))}
      <Button
        className="absolute -translate-x-1/2 bottom-3 left-1/2 !rounded-full"
        onClick={() => setShowCreateOffer(true)}
        variant="primary"
      >
        + Create new offer
      </Button>
    </div>
  );
};
