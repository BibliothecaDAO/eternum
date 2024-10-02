import { getRealms } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectResource } from "@/ui/elements/SelectResource";
import { unpackResources } from "@/ui/utils/packedData";
import { RESOURCE_INPUTS_SCALED, ResourcesIds } from "@bibliothecadao/eternum";
import { useState } from "react";
import { RealmResourcesIO } from "../resources/RealmResourcesIO";

export const RealmProduction = () => {
  const setSelectedPlayer = useUIStore((state) => state.setSelectedPlayer);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const realms = getRealms();
  const [filterProduced, setFilterProduced] = useState<number | null>(null);
  const [filterConsumed, setFilterConsumed] = useState<number | null>(null);

  return (
    <>
      <div className="flex flex-row justify-evenly my-2 ">
        <div className="border">
          <p>Search produced resource</p>
          <SelectResource onSelect={(resourceId) => setFilterProduced(resourceId)} className="w-full" />
        </div>
        <div className="border">
          <p>Search consumed resource</p>
          <SelectResource onSelect={(resourceId) => setFilterConsumed(resourceId)} className="w-full" />
        </div>
      </div>

      <div className="p-5 grid grid-cols-5 gap-4">
        {realms &&
          realms.map((realm, index) => {
            if (!realm) return;
            console.log("Realm prod", realm);

            const resourcesProduced = unpackResources(realm.resourceTypesPacked, realm.resourceTypesCount);
            if (filterProduced && !resourcesProduced.includes(filterProduced)) return;

            const resourcesConsumed = [
              ...new Set(
                resourcesProduced.flatMap((resourceId) => {
                  return RESOURCE_INPUTS_SCALED[resourceId]
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
                className="mb-5 border p-1 hover:opacity-70"
                onClick={() => {
                  toggleModal(null);
                  setSelectedPlayer(realm.owner);
                }}
              >
                <p className="text-md font-bold">{realm.ownerName}</p>
                <p className="text-sm mb-1">{realm.name}</p>
                {realm.realmId && <RealmResourcesIO structureEntityId={realm.structure.entity_id} />}
              </div>
            );
          })}
      </div>
    </>
  );
};
