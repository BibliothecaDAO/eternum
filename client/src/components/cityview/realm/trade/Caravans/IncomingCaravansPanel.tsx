import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { IncomingOrder } from "./IncomingOrder";
import { Order } from "../../RealmTradeComponent";
import { useGetIncomingOrders } from "../../../../../hooks/useGraphQLQueries";
import useRealmStore from "../../../../../hooks/store/useRealmStore";

type IncomingOrdersPanelProps = {
  orders: Order[];
};

export const IncomingOrdersPanel = ({ orders }: IncomingOrdersPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const { realmEntityId } = useRealmStore();

  const { incomingOrders } = useGetIncomingOrders(realmEntityId);

  const sortingParams = useMemo(() => {
    return [
      { label: "Number", sortKey: "number" },
      { label: "Health-bar", sortKey: "health", className: "ml-4" },
      { label: "Items", sortKey: "items", className: "ml-auto mr-4" },
      { label: "Time-left", sortKey: "time", className: "" },
    ];
  }, []);

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
      {incomingOrders.map((incomingOrder) => (
        <div className="flex flex-col p-2">
          <IncomingOrder incomingOrder={incomingOrder} />
        </div>
      ))}
    </div>
  );
};
