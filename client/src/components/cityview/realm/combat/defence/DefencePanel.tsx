import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { ResourceFilter } from "../../../../ResourceFilterComponent";
import { OrdersFilter } from "../../../../OrdersFilterComponent";
// import { CreateOfferPopup } from "../CreateOffer";
import Button from "../../../../../elements/Button";
// import { Raid } from "./Raids";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateDefencePopup } from "./CreateDefencePopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
// import { ManageRaidsPopup } from "./ManageRaidsPopup";
// import { AttackRaidsPopup } from "./AttackRaidsPopup";
// import { TravelRaidsPopup } from "./TravelRaidsPopup";
import { getEntityIdFromKeys, getPosition } from "../../../../../utils/utils";
import { EnnemyRaid } from "./EnnemyRaid";
import { Defence } from "./Defence";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../../../DojoContext";

type MarketPanelProps = {};

export const DefencePanel = ({}: MarketPanelProps) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const [activeFilter, setActiveFilter] = useState(false);
  const [showBuildDefence, setShowBuildDefence] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  // const [selectedRaiders, setSelectedRaiders] = useState<CombatInfo>(null);

  // const [showTravelRaid, setShowTravelRaid] = useState(false);
  // const [showAttackRaid, setShowAttackRaid] = useState(false);
  // const [showManageRaid, setShowManageRaid] = useState(false);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const { realmId, realmEntityId } = useRealmStore();
  const realmPosition = getPosition(realmId);

  const { useEnemyRaidersOnPosition, getEntitiesCombatInfo, getRealmWatchTower } = useCombat();
  const attackingEntities = useEnemyRaidersOnPosition(realmPosition);

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities);
  }, [attackingEntities]);

  const watchTowerId = getRealmWatchTower(realmEntityId);
  const watchTowerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTowerId)]));

  const watchTower = useMemo(() => {
    const info = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;
    if (info?.length === 1) {
      return info[0];
    } else {
      return undefined;
    }
  }, [watchTowerId, watchTowerHealth]);

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
      {showBuildDefence && <CreateDefencePopup onClose={() => setShowBuildDefence(false)} />}
      {/* {showManageRaid && (
        <ManageRaidsPopup selectedRaiders={selectedRaiders} onClose={() => setShowManageRaid(false)} />
      )}
      {showAttackRaid && (
        <AttackRaidsPopup selectedRaiders={selectedRaiders} onClose={() => setShowAttackRaid(false)} />
      )}
      {showTravelRaid && (
        <TravelRaidsPopup selectedRaiders={selectedRaiders} onClose={() => setShowTravelRaid(false)} />
      )} */}
      {watchTower.health && (
        <div className="flex flex-col p-2 space-y-2">
          <Defence watchTower={watchTower} />
        </div>
      )}

      <div className="flex flex-col p-2 space-y-2">
        <div className="font-bold text-white text-xs ml-1">Raid Attacks</div>
        {attackingRaiders.map((raider) => (
          <EnnemyRaid key={raider.entityId} raider={raider} />
        ))}
      </div>

      <div className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full flex flex-col items-center">
        <Button className="" onClick={() => setShowBuildDefence(true)} variant="primary">
          + Reinforce City Tower
        </Button>
      </div>
    </div>
  );
};
