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
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateBattalionPopup } from "./CreateBattalionPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";

type MarketPanelProps = {};

export const BattalionsPanel = ({}: MarketPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showBuildBattalion, setShowBuildBattalion] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const onClickDetails = () => {
    setShowDetails((prev) => !prev);
  };

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { useRealmBattalions, getEntitiesCombatInfo } = useCombat();
  const entities = useRealmBattalions(realmEntityId);

  const battalions = useMemo(() => {
    return getEntitiesCombatInfo(entities);
  }, [entities]);

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
      {!showDetails && battalions.length > 0 && (
        <div className="flex flex-col p-2 space-y-2">
          <Battalion
            battalion={{
              entityId: undefined,
              health: battalions.reduce((acc, battalion) => acc + battalion.health, 0),
              quantity: battalions.reduce((acc, battalion) => acc + battalion.quantity, 0),
              attack: battalions.reduce((acc, battalion) => acc + battalion.attack, 0),
              defence: battalions.reduce((acc, battalion) => acc + battalion.defence, 0),
              sec_per_km: battalions.reduce((acc, battalion) => acc + battalion.sec_per_km, 0),
              blocked: false,
              capacity: battalions.reduce((acc, battalion) => acc + battalion.capacity, 0),
            }}
          />
        </div>
      )}
      {showDetails && (
        <div className="flex flex-col p-2 space-y-2">
          {battalions.map((battalion) => (
            <Battalion key={battalion.entityId} battalion={battalion} />
          ))}
        </div>
      )}
      <div className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full flex flex-col items-center mt-4 mb-1">
        {battalions.length > 0 && (
          <Button className="mb-2" onClick={onClickDetails} variant="primary">
            {showDetails ? "+ Hide Details" : "+ Show Details"}
          </Button>
        )}
        <Button className="" onClick={() => setShowBuildBattalion(true)} variant="primary">
          + Create new battalions
        </Button>
      </div>
    </div>
  );
};
