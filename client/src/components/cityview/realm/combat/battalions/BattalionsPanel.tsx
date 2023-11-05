import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
// import { CreateOfferPopup } from "../CreateOffer";
import Button from "../../../../../elements/Button";
import { Battalion } from "./Battalion";
import { useGetCaravansWithResourcesChest } from "../../../../../hooks/helpers/useResources";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateBattalionPopup } from "./CreateBattalionPopup";

type MarketPanelProps = {};

export const BattalionsPanel = ({}: MarketPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showBuildBattalion, setShowBuildBattalion] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const { getBattalionsOnPosition } = useCombat();

  const { caravansAtPositionWithInventory: caravanIds } = useGetCaravansWithResourcesChest();

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
      {/* // TODO: need to filter on only trades that are relevant (status, not expired, etc) */}
      {showBuildBattalion && <CreateBattalionPopup onClose={() => setShowBuildBattalion(false)} />}
      <div className="flex flex-col p-2 space-y-2">
        {caravanIds.map((caravanId) => (
          <Battalion key={caravanId} caravanId={caravanId} />
        ))}
      </div>
      <Button
        className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full"
        onClick={() => setShowBuildBattalion(true)}
        variant="primary"
      >
        + Create new battalions
      </Button>
    </div>
  );
};
