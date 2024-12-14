import { configManager } from "@/dojo/setup";
import { getRealms } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectResource } from "@/ui/elements/SelectResource";
import { unpackResources } from "@/ui/utils/packedData";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useState } from "react";
import { RealmResourcesIO } from "../resources/RealmResourcesIO";

export const RealmProduction = () => {
  const setSelectedPlayer = useUIStore((state) => state.setSelectedPlayer);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const realms = getRealms();
  const [filterProduced, setFilterProduced] = useState<number | null>(null);
  const [filterConsumed, setFilterConsumed] = useState<number | null>(null);

  return (
    <div className="realm-production-selector">
      <div className="flex flex-row justify-evenly my-2 ">
        <div>
          <p>Search produced resource</p>
          <SelectResource
            onSelect={(resourceId) => setFilterProduced(resourceId)}
            className="w-full"
            realmProduction={true}
          />
        </div>
        <div>
          <p>Search consumed resource</p>
          <SelectResource
            onSelect={(resourceId) => setFilterConsumed(resourceId)}
            className="w-full"
            realmProduction={true}
          />
        </div>
      </div>

      <div className="p-5 grid grid-cols-5 gap-4">
        {realms &&
          realms.map((realm, index) => {
            if (!realm) return;

            const resourcesProduced = unpackResources(realm.resourceTypesPacked);
            if (filterProduced && !resourcesProduced.includes(filterProduced)) return;

            const resourcesInputs = configManager.resourceInputs;

            const resourcesConsumed = [
              ...new Set(
                resourcesProduced.flatMap((resourceId) => {
                  return resourcesInputs[resourceId]
                    .filter(
                      (input) => input.resource !== ResourcesIds["Wheat"] && input.resource !== ResourcesIds["Fish"],
                    )
                    .map((input) => input.resource);
                }),
              ),
            ];
            if (filterConsumed && !resourcesConsumed.includes(filterConsumed!)) return;

            return (
              <div
                key={index}
                className="mb-5 border border-gold/40 rounded-xl p-3 hover:opacity-70"
                onClick={() => {
                  toggleModal(null);
                  setSelectedPlayer(realm.owner);
                }}
              >
                <p className="text-md">{realm.ownerName}</p>
                <p className="text-md mb-1 font-bold">{realm.name}</p>
                <hr />
                {realm.realmId && <RealmResourcesIO realmEntityId={realm.entityId} />}
              </div>
            );
          })}
      </div>
    </div>
  );
};
