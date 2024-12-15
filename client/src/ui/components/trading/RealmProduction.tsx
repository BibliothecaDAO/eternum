import { configManager } from "@/dojo/setup";
import { getRealms } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectResource } from "@/ui/elements/SelectResource";
import { unpackResources } from "@/ui/utils/packedData";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { RealmResourcesIO } from "../resources/RealmResourcesIO";

export const RealmProduction = () => {
  const setSelectedPlayer = useUIStore((state) => state.setSelectedPlayer);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const realms = getRealms();
  const [filterProduced, setFilterProduced] = useState<number | null>(null);
  const [filterConsumed, setFilterConsumed] = useState<number | null>(null);

  const resourcesInputs = useMemo(() => configManager.resourceInputs, []);

  const filteredRealms = useMemo(() => {
    if (!realms) return [];

    return realms.filter((realm) => {
      if (!realm) return false;

      const resourcesProduced = unpackResources(realm.resourceTypesPacked);
      if (filterProduced && !resourcesProduced.includes(filterProduced)) return false;

      if (filterConsumed) {
        const resourcesConsumed = new Set(
          resourcesProduced.flatMap((resourceId) =>
            resourcesInputs[resourceId]
              .filter((input) => input.resource !== ResourcesIds["Wheat"] && input.resource !== ResourcesIds["Fish"])
              .map((input) => input.resource),
          ),
        );

        if (!resourcesConsumed.has(filterConsumed)) return false;
      }

      return true;
    });
  }, [realms, filterProduced, filterConsumed, resourcesInputs]);

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
          <div
            key={index}
            className="mb-5 border border-gold/40 rounded-xl p-3 hover:opacity-70"
            onClick={() => handleRealmClick(realm)}
          >
            <p className="text-md">{realm.ownerName}</p>
            <p className="text-md mb-1 font-bold">{realm.name}</p>
            <hr />
            {realm.realmId && <RealmResourcesIO realmEntityId={realm.entityId} />}
          </div>
        ))}
      </div>
    </div>
  );
};
