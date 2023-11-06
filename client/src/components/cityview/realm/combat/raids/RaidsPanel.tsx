import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
import Button from "../../../../../elements/Button";
import { Raid } from "./Raids";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateRaidsPopup } from "./CreateRaidsPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { ManageRaidsPopup } from "./ManageRaidsPopup";
import { AttackRaidsPopup } from "./AttackRaidsPopup";
import { TravelRaidsPopup } from "./TravelRaidsPopup";

type MarketPanelProps = {};

export const RaidsPanel = ({}: MarketPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showBuildRaiders, setShowBuildRaiders] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedRaider, setSelectedRaider] = useState<CombatInfo>(null);

  const [showTravelRaid, setShowTravelRaid] = useState(false);
  const [showAttackRaid, setShowAttackRaid] = useState(false);
  const [showManageRaid, setShowManageRaid] = useState(false);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { useRealmRaiders, getEntitiesCombatInfo } = useCombat();
  const entities = useRealmRaiders(realmEntityId);

  const raiders = useMemo(() => {
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
      {showBuildRaiders && <CreateRaidsPopup onClose={() => setShowBuildRaiders(false)} />}
      {showManageRaid && <ManageRaidsPopup selectedRaiders={selectedRaider} onClose={() => setShowManageRaid(false)} />}
      {showAttackRaid && <AttackRaidsPopup selectedRaider={selectedRaider} onClose={() => setShowAttackRaid(false)} />}
      {showTravelRaid && <TravelRaidsPopup selectedRaiders={selectedRaider} onClose={() => setShowTravelRaid(false)} />}

      <div className="flex flex-col p-2 space-y-2">
        {raiders.map((raider) => (
          <Raid
            key={raider.entityId}
            raider={raider}
            setShowTravelRaid={() => {
              setShowTravelRaid(true);
              setSelectedRaider(raider);
            }}
            setShowAttackRaid={() => {
              setShowAttackRaid(true);
              setSelectedRaider(raider);
            }}
            setShowManageRaid={() => {
              setShowManageRaid(true);
              setSelectedRaider(raider);
            }}
          />
        ))}
      </div>

      <div className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full flex flex-col items-center">
        <Button className="" onClick={() => setShowBuildRaiders(true)} variant="primary">
          + New raiding party
        </Button>
      </div>
    </div>
  );
};
