import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { SelectableRealmInterface, getOrderName } from "@bibliothecadao/eternum";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { useTrade } from "../../../../../../hooks/helpers/useTrade";
import { useCaravan } from "../../../../../../hooks/helpers/useCaravans";
import { SortButton, SortInterface } from "../../../../../../elements/SortButton";
import { getRealm } from "../../../../../../utils/realms";
import { useDojo } from "../../../../../../DojoContext";
import TextInput from "../../../../../../elements/TextInput";
import { SortPanel } from "../../../../../../elements/SortPanel";
import { OrderIcon } from "../../../../../../elements/OrderIcon";
import { useLevel } from "../../../../../../hooks/helpers/useLevel";
import { useRealm } from "../../../../../../hooks/helpers/useRealm";

export const SelectNpcForTravelPanel = ({
  selectedEntityId,
  setSelectedEntityId,
  setCanTravel,
}: {
  selectedEntityId: bigint | undefined;
  setSelectedEntityId: (selectedEntityId: bigint) => void;
  setCanTravel: (canTravel: boolean) => void;
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

  const { getRealmEntityIdFromRealmId } = useTrade();
  const { getEntityLevel } = useLevel();
  const { getRealmAddressName } = useRealm();

  const { calculateDistance } = useCaravan();

  const sortingParams = useMemo(() => {
    return [
      { label: "Order", sortKey: "order" },
      { label: "Owner", sortKey: "addressName", className: "ml-4 mr-4" },
      { label: "Realm", sortKey: "name", className: "ml-4 mr-4" },
      { label: "Distance", sortKey: "distance", className: "ml-auto" },
      { label: "Level", sortKey: "level", className: "ml-auto" },
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
            const realmData = getRealm(realm.realm_id);
            if (!realmData) return undefined;
            const { name, order, realmId: takerRealmId } = realmData;
            const takerEntityId = getRealmEntityIdFromRealmId(takerRealmId);
            const distance = takerEntityId ? calculateDistance(realmEntityId, BigInt(takerEntityId)) ?? 0 : 0;
            const level = takerEntityId ? getEntityLevel(BigInt(takerEntityId)) : undefined;
            const addressName = takerEntityId ? getRealmAddressName(takerEntityId) : "";
            return {
              entityId: realm.entity_id,
              realmId: realm.realm_id,
              name,
              order: getOrderName(order),
              distance,
              level: level?.level,
              addressName,
            };
          }
        })
        .filter((realm) => realm && realm.realmId !== realmId) as SelectableRealmInterface[];
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
            className="border border-gold mt-2 mb-2 mx-1 !w-auto !text-light-pink"
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
                {
                  order,
                  name,
                  addressName,
                  realmId: destinationRealmId,
                  distance,
                  level,
                  entityId: destinationEntityId,
                },
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
                        setSelectedEntityId(destinationEntityId);
                        setCanTravel(true);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between text-xxs">
                      <div className="flex-none w-12">
                        <OrderIcon order={order} size="xs" />
                      </div>
                      <div className="flex-none w-16 text-left">{addressName}</div>
                      <div className="flex-none w-20 text-left">{name}</div>
                      <div className="flex-none w-20 text-center">{`${distance.toFixed(0)} km`}</div>
                      <div className="flex-none w-16 text-center">{level}</div>
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
    } else if (activeSort.sortKey === "addressName") {
      return sortedRealms.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.addressName.localeCompare(b.addressName);
        } else {
          return b.addressName.localeCompare(a.addressName);
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
        if (activeSort.sort === "asc") {
          return (a?.level || 0) - (b?.level || 0);
        } else {
          return (b?.level || 0) - (a?.level || 0);
        }
      });
    } else {
      return sortedRealms;
    }
  } else {
    return sortedRealms.sort((a, b) => Number(b.realmId - a.realmId));
  }
}
