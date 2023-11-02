import { useDeferredValue, useEffect, useMemo, useState } from "react";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useTrade } from "../../../hooks/helpers/useTrade";
import { useCaravan } from "../../../hooks/helpers/useCaravans";
import { getRealm } from "../../../utils/realms";
import { getOrderName } from "@bibliothecadao/eternum";
import { OrderIcon } from "../../../elements/OrderIcon";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { Has, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../../DojoContext";
import { ReactComponent as CaretDownFill } from "../../../assets/icons/common/caret-down-fill.svg";
import TextInput from "../../../elements/TextInput";

export interface SelectRealmInterface {
  entityId: number;
  realmId: number;
  name: string;
  order: string;
  distance: number;
}

export const SelectRealmPanel = ({
  selectedRealmId,
  setSelectedRealmId,
}: {
  selectedRealmId: number | undefined;
  setSelectedRealmId: (selectedRealmId: number) => void;
}) => {
  const [specifyRealmId, setSpecifyRealmId] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [originalRealms, setOriginalRealms] = useState<SelectRealmInterface[]>([]);
  const [sortedRealms, setSortedRealms] = useState<SelectRealmInterface[]>([]);
  const deferredNameFilter = useDeferredValue(nameFilter);

  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const { realmId, realmEntityId } = useRealmStore();

  const { getRealmEntityIdFromRealmId } = useTrade();

  const { calculateDistance } = useCaravan();

  const sortingParams = useMemo(() => {
    return [
      { label: "Order", sortKey: "order" },
      { label: "Realm ID", sortKey: "id", className: "ml-4" },
      { label: "Name", sortKey: "name", className: "ml-4 mr-4" },
      { label: "Distance", sortKey: "distance", className: "ml-auto" },
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
            const { name, order, realm_id: takerRealmId } = getRealm(realm.realm_id);
            const takerEntityId = getRealmEntityIdFromRealmId(takerRealmId);
            const distance = takerEntityId ? calculateDistance(realmEntityId, takerEntityId) ?? 0 : 0;
            return {
              entityId,
              realmId: realm.realm_id,
              name,
              order: getOrderName(order),
              distance,
            };
          }
        })
        .filter((realm) => realm && realm.realmId !== realmId && realm.realmId !== 1) as SelectRealmInterface[];
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
    <div className="flex flex-col items-center w-full p-2">
      {!specifyRealmId && (
        <div
          onClick={() => setSpecifyRealmId(true)}
          className="w-full mx-4 h-8 py-[7px] bg-dark-brown cursor-pointer rounded justify-center items-center"
        >
          <div className="text-xs text-center text-gold"> + Make Direct Offer</div>
        </div>
      )}
      {specifyRealmId && (
        <div className="flex flex-col p-1 rounded border-gold border w-full">
          <div
            onClick={() => setSpecifyRealmId(false)}
            className="w-full p-2 mb-1 -mt-1 relative cursor-pointer rounded justify-center items-center"
          >
            <div className="text-xs text-center text-gold">Make Direct Offer</div>
            <CaretDownFill className="ml-1 fill-gold absolute top-1/2 right-2 -translate-y-1/2 rotate-180" />
          </div>
          {realmEntityId && (
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
                {sortedRealms.map(({ order, name, realmId: takerRealmId, distance }, i) => {
                  return (
                    <div
                      key={i}
                      className={`flex cursor-pointer flex-col p-2 bg-black border border-transparent transition-all duration-200 rounded-md ${
                        selectedRealmId === takerRealmId ? "!border-order-brilliance" : ""
                      } text-xxs text-gold`}
                      onClick={() => {
                        if (selectedRealmId !== takerRealmId) {
                          setSelectedRealmId(takerRealmId);
                        } else {
                          setSelectedRealmId(0);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between text-xxs">
                        <div className="flex-none mr-10">
                          <OrderIcon order={order} size="xs" />
                        </div>

                        <div className="flex-none w-20">{takerRealmId}</div>

                        <div className="flex-grow">{name}</div>

                        <div className="flex-none w-16 text-right">{`${distance.toFixed(0)} km`}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * sort realms based on active filters
 */
export function sortRealms(realms: SelectRealmInterface[], activeSort: SortInterface): SelectRealmInterface[] {
  const sortedRealms = [...realms]; // Making a copy of the realms array

  if (activeSort.sort !== "none") {
    if (activeSort.sortKey === "id") {
      return sortedRealms.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.realmId - b.realmId;
        } else {
          return b.realmId - a.realmId;
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
    } else {
      return sortedRealms;
    }
  } else {
    return sortedRealms.sort((a, b) => b.realmId - a.realmId);
  }
}
