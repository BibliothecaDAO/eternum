import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { configManager, getRealmInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { useMemo } from "react";

const StorehouseInfo = ({
  storehouseCapacity,
  storehouseCapacityUsed,
}: {
  storehouseCapacity: number;
  storehouseCapacityUsed: number;
}) => {
  const capacity = storehouseCapacity;
  // All troops have the same weight now, so we can use any troop type to calculate
  const troopWeight = configManager.getResourceWeightKg(ResourcesIds.Knight);
  const maxTroops = Math.floor(capacity / troopWeight);

  return (
    <div className="max-w-xs z-50 space-y-3">
      {/* Storage summary */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm pt-4">
        <p className="font-bold text-gold text-right">Capacity:</p>
        <p className="font-bold text-white">{storehouseCapacity.toLocaleString()} kg</p>

        <p className="font-bold text-gold text-right">Used:</p>
        <p className="font-bold text-white">{storehouseCapacityUsed.toLocaleString()} kg</p>

        <p className="font-bold text-gold text-right">Left:</p>
        <p className="font-bold text-white">{(storehouseCapacity - storehouseCapacityUsed).toLocaleString()} kg</p>
      </div>

      {/* Example capacities */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center bg-white/5 rounded p-1">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="xs" className="mr-1" />
          <span>{(capacity / configManager.getResourceWeightKg(ResourcesIds.Lords)).toLocaleString()} Lords</span>
        </div>
        <div className="flex items-center bg-white/5 rounded p-1">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="xs" className="mr-1" />
          <span>{(capacity / configManager.getResourceWeightKg(ResourcesIds.Wheat)).toLocaleString()} Food</span>
        </div>
        <div className="flex items-center bg-white/5 rounded p-1">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" className="mr-1" />
          <span>{(capacity / configManager.getResourceWeightKg(ResourcesIds.Wood)).toLocaleString()} Resources</span>
        </div>
        <div className="flex items-center bg-white/5 rounded p-1">
          <ResourceIcon resource={ResourcesIds[ResourcesIds.Labor]} size="xs" className="mr-1" />
          <span>{(capacity / configManager.getResourceWeightKg(ResourcesIds.Labor)).toLocaleString()} Labor</span>
        </div>
      </div>

      {/* Troop capacity */}
      <div className="bg-white/5 rounded p-2 space-y-1">
        <p className="text-gold">Troop Capacity</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="xs" className="mr-1" />
            <span className="font-semibold">{maxTroops.toLocaleString()} troops</span>
          </div>
          <span className="text-gray-300 italic bg-black/30 rounded px-1 py-0.5">Per troop type and tier</span>
        </div>
      </div>

      {/* Hint */}
      <p className="pt-2 border-t border-white/10 italic flex items-center">
        <span className="text-green mr-1">+</span> Build Storehouses to increase capacity
      </p>
    </div>
  );
};

const WorkersHutInfo = () => {
  const capacity = configManager.getBuildingCategoryConfig(BuildingType.WorkersHut).capacity_grant;
  const baseCapacity = configManager.getBasePopulationCapacity();

  return (
    <div className="max-w-xs text-xs space-y-1">
      {/* Heading */}
      <p className="font-bold text-gold">Population Capacity</p>

      {/* Base + Per Hut */}
      <div className="">
        <div className="flex items-center justify-between">
          <span>Base Capacity</span>
          <span className="font-semibold">{baseCapacity}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Per Workers Hut</span>
          <span className="font-semibold text-green">+{capacity}</span>
        </div>
      </div>

      {/* Hint */}
      <p className="flex items-center border-t border-white/10 pt-2 italic">
        Build Workers Huts to increase population
      </p>
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
              content: (
                <StorehouseInfo
                  storehouseCapacity={realmInfo.storehouses.capacityKg}
                  storehouseCapacityUsed={realmInfo.storehouses.capacityUsedKg}
                />
              ),
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className="storehouse-selector text-lg px-3 py-1 flex gap-2 justify-start items-center   transition-colors duration-200 cursor-help"
        >
          <ResourceIcon withTooltip={false} resource="Silo" size="sm" />
          <div className="self-center text-xs">
            {realmInfo.storehouses.capacityUsedKg.toLocaleString()} /{" "}
            {realmInfo.storehouses.capacityKg.toLocaleString()} kg
          </div>
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
          "population-selector p-1  flex gap-2 justify-start items-center rounded-md transition-colors duration-200 cursor-help text-lg  ",
        )}
      >
        <ResourceIcon withTooltip={false} resource="House" size="sm" />
        <div className="flex flex-col self-center">
          <div className={clsx("self-center", isPopulationNearCapacity && "text-red")}>
            {realmInfo?.population || 0} / {(realmInfo?.capacity || 0) + configManager.getBasePopulationCapacity()}
          </div>
          <div className="w-full bg-gray-700 rounded-full overflow-hidden text-lg ">
            <div
              className={clsx(
                "h-full rounded-full",
                populationPercentage < 60 ? "bg-green" : populationPercentage < 80 ? "bg-yellow" : "bg-red",
              )}
              style={{ width: `${populationPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
