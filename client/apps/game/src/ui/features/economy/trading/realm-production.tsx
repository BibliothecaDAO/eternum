import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SelectResource } from "@/ui/elements/select-resource";
import { configManager, getStructureName, unpackValue } from "@bibliothecadao/eternum";
import { useAllRealms } from "@bibliothecadao/react";
import { ResourcesIds } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

export const RealmProduction = () => {
  const setSelectedPlayer = useUIStore((state) => state.setSelectedPlayer);
  const toggleModal = useUIStore((state) => state.toggleModal);

  // todo: pay attention to expensive query
  const realms = useAllRealms();
  const [filterProduced, setFilterProduced] = useState<number | null>(null);
  const [filterConsumed, setFilterConsumed] = useState<number | null>(null);

  const resourcesInputs = useMemo(() => configManager.complexSystemResourceInputs, []);

  const realmsProduction = useMemo(() => {
    return realms.map((realm) => {
      const resourcesProduced = unpackValue(realm.resources_packed);

      return {
        ...realm,
        resourcesProduced,
      };
    });
  }, [realms]);

  const filteredRealms = useMemo(() => {
    if (!realms) return [];

    return realmsProduction.filter((realm) => {
      if (!realm) return false;

      if (filterProduced && !realm.resourcesProduced.includes(filterProduced)) return false;

      if (filterConsumed) {
        const resourcesConsumed = new Set(
          realm.resourcesProduced.flatMap((resourceId) =>
            resourcesInputs[resourceId]
              .filter((input) => input.resource !== ResourcesIds["Wheat"] && input.resource !== ResourcesIds["Fish"])
              .map((input) => input.resource),
          ),
        );

        if (!resourcesConsumed.has(filterConsumed)) return false;
      }

      return true;
    });
  }, [realmsProduction, filterProduced, filterConsumed, resourcesInputs]);

  const handleRealmClick = (realm: any) => {
    toggleModal(null);
    setSelectedPlayer(realm.owner);
  };

  return (
    <div className="realm-production-selector">
      <div className="flex flex-row justify-evenly my-2 ">
        <div>
          <p>Search produced resource</p>
          <SelectResource onSelect={setFilterProduced} className="w-full" realmProduction={true} />
        </div>
        <div>
          <p>Search consumed resource</p>
          <SelectResource onSelect={setFilterConsumed} className="w-full" realmProduction={true} />
        </div>
      </div>

      <div className="p-5 grid grid-cols-5 gap-4">
        {filteredRealms.map((realm, index) => (
          <div key={index} className="mb-5 panel-wood p-3 hover:opacity-70" onClick={() => handleRealmClick(realm)}>
            <h5>{getStructureName(realm).name}</h5>

            <div className="flex flex-row flex-wrap">
              {realm.resourcesProduced.map((resourceId) => (
                <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" key={resourceId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
