import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectResource } from "@/ui/design-system/molecules/select-resource";
import { configManager, unpackValue } from "@bibliothecadao/eternum";
import { useAllRealms } from "@bibliothecadao/react";
import { ResourcesIds } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

export const RealmProduction = () => {
  const mode = useGameModeConfig();
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
            <h5>{mode.structure.getName(realm).name}</h5>

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
