import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { configManager, getRealmInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { useMemo } from "react";

const StorehouseInfo = ({ storehouseCapacity, storehouseCapacityUsed }: { storehouseCapacity: number, storehouseCapacityUsed: number }) => {
  const capacity = storehouseCapacity;
  // All troops have the same weight now, so we can use any troop type to calculate
  const troopWeight = configManager.getResourceWeightKg(ResourcesIds.Knight);
  const maxTroops = Math.floor(capacity / troopWeight);

  return (
    <div className=" text-gray-200 p-2 max-w-xs z-50 ">
      <p className="font-bold text-gold mb-1">Storage Capacity ({storehouseCapacity.toLocaleString()} kg)</p>
      <p className="font-bold text-gold mb-1">Storage Used ({storehouseCapacityUsed.toLocaleString()} kg)</p>
      <p className="font-bold text-gold mb-1">Storage Left ({(storehouseCapacity - storehouseCapacityUsed).toLocaleString()} kg)</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 my-1">
        <div className="flex items-center bg-white/5 p-1 rounded">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="xs" className="mr-1" />
          <span className="">
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Lords)).toLocaleString()} Lords
          </span>
        </div>
        <div className="flex items-center bg-white/5 p-1 rounded">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="xs" className="mr-1" />
          <span className=" ">
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Wheat)).toLocaleString()} Food
          </span>
        </div>
        <div className="flex items-center bg-white/5 p-1 rounded">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" className="mr-1" />
          <span className=" ">
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Wood)).toLocaleString()} Resources
          </span>
        </div>
        <div className="flex items-center bg-white/5 p-1 rounded">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Labor]} size="xs" className="mr-1" />
          <span className=" ">
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Labor)).toLocaleString()} Labor
          </span>
        </div>
      </div>

      <div className="bg-white/5 p-2 rounded mt-2 mb-2">
        <p className=" text-gold mb-1">Troop Capacity</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="xs" className="mr-1" />
            <span className="  font-semibold">{maxTroops.toLocaleString()} troops</span>
          </div>
          <div className="flex items-center">
            <span className=" text-gray-300 italic px-1 py-0.5 bg-black/30 rounded">Per troop type and tier</span>
          </div>
        </div>
      </div>

      <div className="mt-1 pt-1 border-t border-white/10">
        <p className="italic  flex items-center">
          <span className="text-green mr-1">+</span> Build Storehouses to increase capacity
        </p>
      </div>
    </div>
  );
};

const WorkersHutInfo = () => {
  const capacity = configManager.getBuildingCategoryConfig(BuildingType.WorkersHut).capacity_grant;
  const baseCapacity = configManager.getBasePopulationCapacity();

  return (
    <div className="text-xs text-gray-200 p-2 max-w-xs z-50">
      <p className="font-bold text-gold mb-2">Population Capacity</p>
      <div className="bg-white/5 p-2 rounded mb-2">
        <div className="flex justify-between items-center mb-1">
          <span>Base Capacity:</span>
          <span className="font-semibold ">{baseCapacity}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Per Workers Hut:</span>
          <span className="font-semibold text-green">+{capacity}</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/10">
        <p className="italic text-xs flex items-center">
          <span className="text-green mr-1">+</span> Build Workers Huts to increase population
        </p>
      </div>
    </div>
  );
};

export const CapacityInfo = ({ structureEntityId, className }: { structureEntityId: number; className?: string }) => {
  const { setup } = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);

  // get update when structureBuildings changes
  const structureBuildings = useComponentValue(
    setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(structureEntityId)]),
  );

  const realmInfo = useMemo(() => {
    return getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), setup.components);
  }, [structureEntityId, setup.components, structureBuildings]);

  const populationPercentage = realmInfo?.capacity
    ? Math.min(
        100,
        Math.round(
          ((realmInfo.population || 0) / (realmInfo.capacity + configManager.getBasePopulationCapacity())) * 100,
        ),
      )
    : 0;

  const isPopulationNearCapacity = populationPercentage >= 80;

  return (
    <div className={clsx("flex", className)}>
      {realmInfo?.storehouses && (
        <div
          onMouseEnter={() => {
            setTooltip({
              position: "bottom",
              content: <StorehouseInfo storehouseCapacity={realmInfo.storehouses.capacityKg} storehouseCapacityUsed={realmInfo.storehouses.capacityUsedKg}/>,
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className="storehouse-selector text-lg px-3 py-1 flex gap-2 justify-start items-center   transition-colors duration-200 cursor-help"
        >
          <ResourceIcon withTooltip={false} resource="Silo" size="sm" />
          <div className="self-center font-medium">{realmInfo.storehouses.capacityKg.toLocaleString()} kg</div>
        </div>
      )}

      <div
        onMouseEnter={() => {
          setTooltip({
            position: "bottom",
            content: <WorkersHutInfo />,
          });
        }}
        onMouseLeave={() => {
          setTooltip(null);
        }}
        className={clsx(
          "population-selector px-3 py-1  flex gap-2 justify-start items-center rounded-md transition-colors duration-200 cursor-help text-lg  ",
        )}
      >
        <ResourceIcon withTooltip={false} resource="House" size="sm" />
        <div className="flex flex-col">
          <div className={clsx("self-center", isPopulationNearCapacity && "text-red-400")}>
            {realmInfo?.population || 0} / {(realmInfo?.capacity || 0) + configManager.getBasePopulationCapacity()}
          </div>
          <div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden text-lg ">
            <div
              className={clsx(
                "h-full rounded-full",
                populationPercentage < 60 ? "bg-green-500" : populationPercentage < 80 ? "bg-yellow-500" : "bg-red-500",
              )}
              style={{ width: `${populationPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
