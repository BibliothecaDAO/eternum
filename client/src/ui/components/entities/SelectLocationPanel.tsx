import { useDojo } from "@/hooks/context/DojoContext";
import { useCaravan } from "@/hooks/helpers/useCaravans";
import { useRealm } from "@/hooks/helpers/useRealm";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import TextInput from "@/ui/elements/TextInput";
import { getRealm } from "@/ui/utils/realms";
import { SelectableLocationInterface, getOrderName } from "@bibliothecadao/eternum";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

export const SelectLocationPanel = ({
  travelingEntityId,
  entityIds,
  selectedEntityId,
  setSelectedEntityId,
}: {
  travelingEntityId: bigint;
  entityIds: Entity[];
  selectedEntityId: bigint | undefined;
  setSelectedEntityId: (selectedEntityId: bigint) => void;
}) => {
  const [nameFilter, setNameFilter] = useState("");
  const [originalLocations, setOriginalLocations] = useState<SelectableLocationInterface[]>([]);
  const [sortedLocations, setSortedLocations] = useState<SelectableLocationInterface[]>([]);
  const deferredNameFilter = useDeferredValue(nameFilter);

  const {
    setup: {
      components: { Realm, Bank, EntityOwner },
    },
  } = useDojo();

  const { getRealmAddressName } = useRealm();

  const { calculateDistance } = useCaravan();

  const sortingParams = useMemo(() => {
    return [
      { label: "ID", sortKey: "id", className: "ml-4" },
      { label: "Order", sortKey: "order" },
      { label: "Owner", sortKey: "addressName", className: "ml-4 mr-4" },
      // { label: "Realm ID", sortKey: "id", className: "ml-4" },
      { label: "Realm", sortKey: "name", className: "ml-4 mr-4" },
      { label: "Distance", sortKey: "distance", className: "ml-auto" },
      { label: "Level", sortKey: "level", className: "ml-auto" },
      { label: "🗡️", sortKey: "attack", className: "ml-auto" },
      { label: "🛡️", sortKey: "defence", className: "ml-auto" },
      { label: "🩸", sortKey: "health", className: "ml-auto" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  useEffect(() => {
    const buildSelectableLocations = () => {
      const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([travelingEntityId]));
      let locations = Array.from(entityIds)
        .map((entity) => {
          const realm = getComponentValue(Realm, entity);
          const bank = getComponentValue(Bank, entity);
          let name = undefined;
          let order = undefined;
          let takerRealmId = undefined;
          if (realm) {
            const realmData = getRealm(realm.realm_id);
            if (!realmData) return;
            const { name: realmName, order: realmOrder, realmId } = realmData;
            name = realmName;
            order = realmOrder;
            takerRealmId = realmId;
          }
          const entityId = realm?.entity_id || bank?.entity_id;
          const distance = entityId ? (calculateDistance(travelingEntityId, BigInt(entityId)) ?? 0) : 0;
          const addressName = entityId ? getRealmAddressName(entityId) : "";
          return {
            entityId,
            home: entityId === entityOwner?.entity_owner_id,
            realmId: realm?.realm_id,
            name,
            order: order ? getOrderName(order) : "",
            distance,
            undefined, // defence,
            addressName,
          };
        })
        .filter(Boolean) as SelectableLocationInterface[];
      setOriginalLocations(locations);
    };
    buildSelectableLocations();
  }, []);

  useEffect(() => {
    const sorted = sortLocations(originalLocations, activeSort);
    if (nameFilter.length > 0) {
      const filtered = sorted.filter(
        (realm) =>
          realm.name.toLowerCase().includes(deferredNameFilter.toLowerCase()) ||
          realm.realmId.toString().includes(deferredNameFilter),
      );
      setSortedLocations(filtered);
      return;
    }
    setSortedLocations(sorted);
  }, [originalLocations, activeSort, deferredNameFilter]);

  return (
    <div className="flex flex-col p-1 rounded border-gold border w-full">
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
          {sortedLocations.map(
            (
              { home, entityId, order, name, addressName, distance, level, entityId: destinationEntityId, defence },
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
                    }
                  }}
                >
                  <div className="flex items-center justify-between text-xxs">
                    <div>{entityId.toString()}</div>
                    <div className="flex-none w-12">
                      <OrderIcon order={order} size="xs" />
                    </div>
                    <div className="flex-none w-16 text-left">{addressName}</div>
                    <div className="flex-none w-20 text-left">{home ? "👑 " + name : name}</div>
                    <div className="flex-none w-20 text-center">{`${distance.toFixed(0)} km`}</div>
                    <div className="flex-none w-16 text-center">{level}</div>
                    <div className="flex-none w-10 text-center">{defence?.attack || 0}</div>
                    <div className="flex-none w-10 text-center">{defence?.defence || 0}</div>
                    <div className="flex-none w-10 text-right">
                      {((defence?.health || 0) / (defence?.quantity || 1)) * 10}%
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * sort realms based on active filters
 */
export function sortLocations(
  locations: SelectableLocationInterface[],
  activeSort: SortInterface,
): SelectableLocationInterface[] {
  const sortedLocations = [...locations]; // Making a copy of the realms array

  if (activeSort.sort !== "none") {
    if (activeSort.sortKey === "id") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return Number(a.realmId - b.realmId);
        } else {
          return Number(b.realmId - a.realmId);
        }
      });
    } else if (activeSort.sortKey === "name") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.name.localeCompare(b.name);
        } else {
          return b.name.localeCompare(a.name);
        }
      });
    } else if (activeSort.sortKey === "addressName") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.addressName.localeCompare(b.addressName);
        } else {
          return b.addressName.localeCompare(a.addressName);
        }
      });
    } else if (activeSort.sortKey === "distance") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.distance - b.distance;
        } else {
          return b.distance - a.distance;
        }
      });
    } else if (activeSort.sortKey === "order") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.order.localeCompare(b.order);
        } else {
          return b.order.localeCompare(a.order);
        }
      });
    } else if (activeSort.sortKey === "level") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return (a?.level || 0) - (b?.level || 0);
        } else {
          return (b?.level || 0) - (a?.level || 0);
        }
      });
    } else if (activeSort.sortKey === "defence") {
      return sortedLocations.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return (a?.defence?.defence || 0) - (b?.defence?.defence || 0);
        } else {
          return (b?.defence?.defence || 0) - (a?.defence?.defence || 0);
        }
      });
    } else {
      return sortedLocations;
    }
  } else {
    return sortedLocations.sort((a, b) => Number(b.realmId - a.realmId));
  }
}
