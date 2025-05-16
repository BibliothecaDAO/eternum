import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getEntityIdFromKeys, getRealmInfo, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { Building, BuildingType, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { ResourceChip } from "../resources/resource-chip";

export const BuildingsList = ({
  realm,
  onSelectProduction,
  selectedResource,
  producedResources,
  productionBuildings,
}: {
  realm: RealmInfo;
  onSelectProduction: (resource: number | null) => void;
  selectedResource: number | null;
  producedResources: ResourcesIds[];
  productionBuildings: Building[];
}) => {
  // Guard against invalid realm data to prevent crashes
  if (!realm || !realm.position || !realm.entityId) {
    return (
      <div className="panel-wood p-3 h-[500px] overflow-y-auto">
        <h3 className="text-3xl border-gold/20">Production Buildings</h3>
        <p className="text-gold/70 pb-8 text-lg">Realm data is currently unavailable.</p>
      </div>
    );
  }

  const { setup } = useDojo();

  const resourceManager = useResourceManager(realm.entityId);
  const resources = useComponentValue(setup.components.Resource, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const structureBuildings = useComponentValue(
    setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(realm.entityId)]),
  );

  const realmInfo = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(realm.entityId)]), setup.components),
    [realm.entityId, structureBuildings, resources],
  );

  const storageRemaining = useMemo(() => {
    if (!realmInfo?.storehouses?.capacityKg || !realmInfo?.storehouses?.capacityUsedKg) {
      return 0;
    }
    return realmInfo?.storehouses?.capacityKg - realmInfo?.storehouses?.capacityUsedKg;
  }, [realmInfo?.storehouses?.capacityUsedKg, realmInfo?.storehouses?.capacityKg]);

  const isStorageFull = useMemo(() => {
    return storageRemaining <= 0;
  }, [storageRemaining]);

  const resource = useMemo(() => {
    return resourceManager.getResource();
  }, [resourceManager]);

  const productions = useMemo(() => {
    return producedResources
      .map((resourceId) => {
        const buildingsForResource = productionBuildings.filter(
          (building) => building.produced.resource === resourceId,
        );

        const balance = resourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, resourceId);
        if (!resource) return null;
        const production = ResourceManager.balanceAndProduction(resource, resourceId).production;

        return {
          resource: resourceId,
          balance,
          production,
          buildings: buildingsForResource,
          isLabor: resourceId === ResourcesIds.Labor,
        };
      })
      .filter((production) => production !== null);
  }, [producedResources, productionBuildings, resourceManager, resource]);

  const motionConfig = {
    initial: { opacity: 0, height: 0 },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.3 },
    animateBase: { opacity: 1 },
  };

  return (
    <AnimatePresence mode="wait">
      {selectedResource !== null ? (
        (() => {
          const selectedProduction = productions.find((p) => p.resource === selectedResource);

          if (!selectedProduction) {
            onSelectProduction(null);

            return (
              <motion.div
                key="error-production"
                initial={motionConfig.initial}
                animate={{ ...motionConfig.animateBase, height: "112px" }}
                exit={motionConfig.exit}
                transition={motionConfig.transition}
                className="p-3"
              >
                <p>Error: Selected production not found.</p>
                <button onClick={() => onSelectProduction(null)} className="px-3 py-2 mt-2 text-sm button">
                  Clear Selection
                </button>
              </motion.div>
            );
          }

          let bgImage = "";
          if (selectedProduction.isLabor) {
            bgImage = BUILDING_IMAGES_PATH[BuildingType.ResourceLabor as keyof typeof BUILDING_IMAGES_PATH];
          } else {
            bgImage = selectedProduction.buildings[0]?.category
              ? BUILDING_IMAGES_PATH[selectedProduction.buildings[0].category as keyof typeof BUILDING_IMAGES_PATH]
              : "";
          }

          return (
            <motion.div
              key="selected-production"
              initial={motionConfig.initial}
              animate={{ ...motionConfig.animateBase, height: "112px" }}
              exit={motionConfig.exit}
              transition={motionConfig.transition}
              className="panel-wood p-3 relative min-h-28"
              style={{
                backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.9), rgba(20, 16, 13, 0.9)), url(${bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={ResourcesIds[selectedProduction.resource]} size="xl" />
                  <div>
                    <h4 className="text-xl font-semibold text-gold tracking-wide">
                      {ResourcesIds[selectedProduction.resource]}
                    </h4>
                    <span className="text-base text-gold/70 font-medium">
                      {selectedProduction.buildings.length} building
                      {selectedProduction.buildings.length !== 1 ? "s" : ""} producing
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onSelectProduction(null)}
                  className="px-4 py-2 text-sm button button-ghost hover:button-ghost-hover"
                >
                  Change Resource
                </button>
              </div>
            </motion.div>
          );
        })()
      ) : (
        <motion.div
          key="full-list"
          initial={motionConfig.initial}
          animate={{ ...motionConfig.animateBase, height: "100%", overflow: "scroll" }}
          exit={motionConfig.exit}
          transition={motionConfig.transition}
          className="pt-6 h-[500px] overflow-y-auto"
        >
          <h3>Production Buildings</h3>
          <p className="text-gold/70 pb-2 text-lg">Select a building to start production.</p>
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
                        size="large"
                        showTransfer={false}
                        storageCapacity={realmInfo?.storehouses?.capacityKg}
                        storageCapacityUsed={realmInfo?.storehouses?.capacityUsedKg}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
