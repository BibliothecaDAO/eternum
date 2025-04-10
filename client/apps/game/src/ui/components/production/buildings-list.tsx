import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import { BuildingType, getProducedResource, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useBuildings, useResourceManager } from "@bibliothecadao/react";
import { useMemo } from "react";
import { ResourceChip } from "../resources/resource-chip";

export const BuildingsList = ({
  realm,
  onSelectProduction,
  selectedResource,
}: {
  realm: RealmInfo;
  onSelectProduction: (resource: number) => void;
  selectedResource: number | null;
}) => {
  const buildings = useBuildings(realm.position.x, realm.position.y);

  const productionBuildings = buildings.filter((building) => getProducedResource(building.category));

  const producedResources = Array.from(new Set(productionBuildings.map((building) => building.produced.resource)));

  const resourceManager = useResourceManager(realm.entityId);

  const storeCapacityKg = useMemo(() => {
    return resourceManager.getStoreCapacityKg();
  }, [resourceManager]);

  const productions = useMemo(() => {
    return producedResources
      .map((resourceId) => {
        const buildingsForResource = productionBuildings.filter(
          (building) => building.produced.resource === resourceId,
        );

        const balance = resourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, resourceId);
        const production = resourceManager.getProduction(resourceId);

        return {
          resource: resourceId,
          balance: balance,
          production,
          buildings: buildingsForResource,
          isLabor: resourceId === ResourcesIds.Labor,
        };
      })
      .filter((production) => production !== null);
  }, [producedResources]);

  return (
    <div className="bg-dark-brown panel-wood p-3 h-[400px] overflow-y-auto">
      <h3 className="text-3xl border-gold/20">Production Buildings</h3>
      <p className=" text-gold/70  pb-4 text-lg">Select a building to start production.</p>
      <div className="space-y-2 min-h-[300px] overflow-y-auto custom-scrollbar">
        {productions.map((production) => {
          let bgImage = "";
          if (production.isLabor) {
            bgImage = BUILDING_IMAGES_PATH[BuildingType.ResourceLabor as keyof typeof BUILDING_IMAGES_PATH];
          } else {
            bgImage = production.buildings[0]?.category
              ? BUILDING_IMAGES_PATH[production.buildings[0].category as keyof typeof BUILDING_IMAGES_PATH]
              : "";
          }

          return (
            <div
              key={production.resource}
              onClick={() => onSelectProduction(production.resource)}
              className={`relative group cursor-pointer transition-all duration-200 
                  ${selectedResource === production.resource ? "button-gold" : "border-transparent"} 
                   p-4`}
              style={{
                backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.9), rgba(20, 16, 13, 0.9)), url(${bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex items-start justify-between space-x-2">
                <div className="flex-1 self-center">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resource={ResourcesIds[production.resource]} size="xl" />
                    <div>
                      <h4 className="text-xl font-semibold text-gold tracking-wide">
                        {ResourcesIds[production.resource]}
                      </h4>
                      <span className="text-base text-gold/70 font-medium">
                        {production.buildings.length} building{production.buildings.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-[480px] flex-shrink-0 self-center">
                  <ResourceChip
                    resourceId={production.resource}
                    resourceManager={resourceManager}
                    maxCapacityKg={storeCapacityKg.capacityKg}
                    size="large"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
