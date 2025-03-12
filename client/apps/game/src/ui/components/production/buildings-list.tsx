import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  BuildingType,
  getEntityIdFromKeys,
  getProducedResource,
  RealmInfo,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useBuildings, useDojo, useResourceManager } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
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

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const producedResources = Array.from(new Set(productionBuildings.map((building) => building.produced.resource)));

  const resourceManager = useResourceManager(realm.entityId);

  const productions = useMemo(() => {
    return producedResources
      .map((resourceId) => {
        const resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(realm.entityId), BigInt(resourceId)]));

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
    <div className="bg-dark-brown/90 backdrop-blur-sm p-6 rounded-xl border border-gold/20 shadow-lg h-[400px] overflow-y-auto">
      <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4">Production Buildings</h3>
      <div className="space-y-4 min-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
              className={`relative group cursor-pointer transition-all duration-200 border-2
                  ${selectedResource === production.resource ? "border-gold/30" : "border-transparent"} 
                  rounded-lg p-4`}
              style={{
                backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.9), rgba(20, 16, 13, 0.9)), url(${bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex items-start justify-between space-x-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <ResourceIcon resource={ResourcesIds[production.resource]} size="lg" />
                    <div>
                      <h4 className="text-lg font-semibold text-gold">{ResourcesIds[production.resource]}</h4>
                      <span className="text-sm text-gold/60">
                        {production.buildings.length} building{production.buildings.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-[280px] flex-shrink-0">
                  <ResourceChip
                    resourceId={production.resource}
                    resourceManager={resourceManager}
                    maxStorehouseCapacityKg={realm.capacity || 0}
                    tick={0}
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
