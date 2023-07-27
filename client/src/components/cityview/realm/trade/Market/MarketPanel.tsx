import React, { useEffect, useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
import { CreateOfferPopup } from "../CreateOffer";
import Button from "../../../../../elements/Button";
import { getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../../../../DojoContext";
import { Utils } from "@dojoengine/core";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { MarketOffer } from "./MarketOffer";
import { AcceptOfferPopup } from "../AcceptOffer";
import { useGetMarket } from "../../../../../hooks/graphql/useGraphQLQueries";

type MarketPanelProps = {};

export const MarketPanel = ({}: MarketPanelProps) => {
  const {
    components: { Trade, Status },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [activeFilter, setActiveFilter] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | undefined>(
    undefined,
  );

  const sortingParams = useMemo(() => {
    return [
      { label: "Realm", sortKey: "realm" },
      { label: "Give", sortKey: "give", className: "ml-4" },
      { label: "Exchange rate", sortKey: "ratio", className: "ml-auto mr-4" },
      { label: "Get", sortKey: "get", className: "ml-auto mr-4" },
      { label: "Travel time", sortKey: "time", className: "ml-auto mr-4" },
    ];
  }, []);

  const { market } = useGetMarket({ realmId: realmEntityId });

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });
  return (
    <div className="flex flex-col">
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
      {selectedTradeId && (
        <AcceptOfferPopup
          onClose={() => {
            setSelectedTradeId(undefined);
          }}
          selectedTradeId={selectedTradeId}
        />
      )}
      {market &&
        market.map((trade) => (
          <div className="flex flex-col p-2">
            <MarketOffer
              marketOffer={trade}
              onAccept={() => setSelectedTradeId(trade.tradeId)}
            />
          </div>
        ))}
      <Button
        className="absolute -translate-x-1/2 bottom-3 left-1/2"
        onClick={() => setShowCreateOffer(true)}
        variant="primary"
      >
        + Create new offer
      </Button>
    </div>
  );
};
