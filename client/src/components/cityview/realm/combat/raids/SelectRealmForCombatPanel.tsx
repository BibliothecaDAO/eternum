import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { SelectableRealmInterface, getOrderName } from "@bibliothecadao/eternum";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useTrade } from "../../../../../hooks/helpers/useTrade";
import { useCaravan } from "../../../../../hooks/helpers/useCaravans";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { getRealm } from "../../../../../utils/realms";
import { useDojo } from "../../../../../DojoContext";
import TextInput from "../../../../../elements/TextInput";
import { SortPanel } from "../../../../../elements/SortPanel";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { useLevel } from "../../../../../hooks/helpers/useLevel";

export const SelectRealmForCombatPanel = ({
  selectedEntityId,
  setSelectedEntityId,
  setCanAttack,
}: {
  selectedEntityId: bigint | undefined;
  setSelectedEntityId: (selectedEntityId: bigint) => void;
  setCanAttack: (canAttack: boolean) => void;
}) => {
  const [nameFilter, setNameFilter] = useState("");
  const [originalRealms, setOriginalRealms] = useState<SelectableRealmInterface[]>([]);
  const [sortedRealms, setSortedRealms] = useState<SelectableRealmInterface[]>([]);
  const deferredNameFilter = useDeferredValue(nameFilter);

  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const { realmId, realmEntityId } = useRealmStore();
  const { getDefenceOnRealm } = useCombat();

  const { getRealmEntityIdFromRealmId } = useTrade();
  const { getEntityLevel } = useLevel();

  const { calculateDistance } = useCaravan();

  const sortingParams = useMemo(() => {
    return [
      { label: "Order", sortKey: "order" },
      { label: "Realm ID", sortKey: "id", className: "ml-4" },
      { label: "Name", sortKey: "name", className: "ml-4 mr-4" },
      { label: "Distance", sortKey: "distance", className: "ml-auto" },
      { label: "Level", sortKey: "level", className: "ml-auto" },
      { label: "Defence", sortKey: "defence", className: "ml-auto" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  useEffect(() => {
    const buildSelectableRealms = () => {
      let entityIds = runQuery([Has(Realm)]);
      let realms = Array.from(entityIds)
        .map((entityId) => {
          const realm = getComponentValue(Realm, entityId);
          if (realm) {
            const { name, order, realmId: takerRealmId } = getRealm(realm.realm_id);
            const takerEntityId = getRealmEntityIdFromRealmId(takerRealmId);
            const distance = takerEntityId ? calculateDistance(realmEntityId, BigInt(takerEntityId)) ?? 0 : 0;
            const defence = takerEntityId ? getDefenceOnRealm(BigInt(takerEntityId)) : undefined;
            const level = takerEntityId ? getEntityLevel(BigInt(takerEntityId)) : undefined;
            return {
              entityId: BigInt(entityId),
              realmId: realm.realm_id,
              name,
              order: getOrderName(order),
              distance,
              defence,
              level: level?.level,
            };
          }
        })
        .filter((realm) => realm && realm.realmId !== realmId && realm.realmId !== 1n) as SelectableRealmInterface[];
      setOriginalRealms(realms);
    };
    buildSelectableRealms();
  }, []);

  useEffect(() => {
    const sorted = sortRealms(originalRealms, activeSort);
    if (nameFilter.length > 0) {
      const filtered = sorted.filter(
        (realm) =>
          realm.name.toLowerCase().includes(deferredNameFilter.toLowerCase()) ||
          realm.realmId.toString().includes(deferredNameFilter),
      );
      setSortedRealms(filtered);
      return;
    }
    setSortedRealms(sorted);
  }, [originalRealms, activeSort, deferredNameFilter]);

  return (
    <div className="flex flex-col p-1 rounded border-gold border w-full">
      {realmEntityId.toString() && (
        <div className="flex flex-col">
          <TextInput
            className="border border-gold mx-1 !w-auto !text-light-pink"
            placeholder="Search by ID or name"
            value={nameFilter}
            onChange={setNameFilter}
          />
          <SortPanel className="px-2 py-2 border-b-0">
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
          <div className="flex flex-col px-1 mb-1 space-y-2 max-h-40 overflow-y-auto">
            {sortedRealms.map(
              (
                { order, name, realmId: destinationRealmId, distance, level, entityId: destinationEntityId, defence },
                i,
              ) => {
                return (
                  <div
                    key={i}
                    className={`flex cursor-pointer flex-col p-2 bg-black border border-transparent transition-all duration-200 rounded-md ${
                      selectedEntityId === destinationEntityId ? "!border-order-brilliance" : ""
                    } text-xxs text-gold`}
                    onClick={() => {
                      if (selectedEntityId !== destinationEntityId) {
                        setCanAttack(level ? level >= 3 : false);
                        setSelectedEntityId(destinationEntityId);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between text-xxs">
                      <div className="flex-none mr-10">
                        <OrderIcon order={order} size="xs" />
                      </div>

                      <div className="flex-none w-20">{destinationRealmId.toString()}</div>

                      <div className="flex-grow">{name}</div>

                      <div className="flex-grow">{`${distance.toFixed(0)} km`}</div>

                      <div className="ml-auto">{level}</div>

                      <div className="flex-none w-16 text-right">
                        {/* <Shield className="text-gold" /> */}
                        <div>{defence?.defence ? defence.defence : 0}</div>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * sort realms based on active filters
 */
export function sortRealms(realms: SelectableRealmInterface[], activeSort: SortInterface): SelectableRealmInterface[] {
  const sortedRealms = [...realms]; // Making a copy of the realms array

  if (activeSort.sort !== "none") {
    if (activeSort.sortKey === "id") {
      return sortedRealms.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return Number(a.realmId - b.realmId);
        } else {
          return Number(b.realmId - a.realmId);
        }
      });
    } else if (activeSort.sortKey === "name") {
      return sortedRealms.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.name.localeCompare(b.name);
        } else {
          return b.name.localeCompare(a.name);
        }
      });
    } else if (activeSort.sortKey === "distance") {
      return sortedRealms.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.distance - b.distance;
        } else {
          return b.distance - a.distance;
        }
      });
    } else if (activeSort.sortKey === "order") {
      return sortedRealms.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.order.localeCompare(b.order);
        } else {
          return b.order.localeCompare(a.order);
        }
      });
    } else if (activeSort.sortKey === "level") {
      return sortedRealms.sort((a, b) => {
        if (!a.level || !b.level) return 1;
        if (activeSort.sort === "asc") {
          return a.distance - b.distance;
        } else {
          return b.distance - a.distance;
        }
      });
    } else if (activeSort.sortKey === "defence") {
      return sortedRealms.sort((a, b) => {
        if (!a.defence?.defence || !b.defence?.defence) return 1;
        if (activeSort.sort === "asc") {
          return a.defence.defence - b.defence.defence;
        } else {
          return b.defence.defence - a.defence.defence;
        }
      });
    } else {
      return sortedRealms;
    }
  } else {
    return sortedRealms.sort((a, b) => Number(b.realmId - a.realmId));
  }
}
