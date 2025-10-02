import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourceWeight } from "@/ui/features/economy/resources";
import { formatStorageValue } from "@/ui/utils/storage-utils";
import { configManager, getRealmInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { useMemo } from "react";
import { CircularProgress } from "./top-left-navigation/circular-progress";

const StorehouseInfo = ({
  storehouseCapacity,
  storehouseCapacityUsed,
}: {
  storehouseCapacity: number;
  storehouseCapacityUsed: number;
}) => {
  const capacity = formatStorageValue(storehouseCapacity);
  const used = formatStorageValue(storehouseCapacityUsed);
  const remaining = formatStorageValue(Math.max(0, storehouseCapacity - storehouseCapacityUsed), {
    forceInfinite: capacity.isInfinite,
  });

  const renderWithUnit = (formatted: { display: string; isInfinite: boolean }) =>
    formatted.isInfinite ? formatted.display : `${formatted.display} kg`;

  return (
    <div className="max-w-xs z-50 space-y-3">
      {/* Storage summary */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm pt-4">
        <p className="font-bold text-gold text-right">Capacity:</p>
        <p className="font-bold text-white">{renderWithUnit(capacity)}</p>

        <p className="font-bold text-gold text-right">Used:</p>
        <p className="font-bold text-white">{renderWithUnit(used)}</p>

        <p className="font-bold text-gold text-right">Left:</p>
        <p className="font-bold text-white">{renderWithUnit(remaining)}</p>
      </div>

      <ResourceWeight />

      {/* Hint */}
      <p className="pt-2 border-t border-white/10 italic flex items-center">
        <span className="text-green mr-1">+</span> Build Storehouses to increase capacity
      </p>
      <p className="italic text-red/80 flex items-center">
        <span className="mr-1">⚠️</span> At max capacity, you risk losing materials
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

  // use this to trigger new realm info computation
  const resources = useComponentValue(setup.components.Resource, getEntityIdFromKeys([BigInt(structureEntityId)]));
  const structureBuildings = useComponentValue(
    setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(structureEntityId)]),
  );

  const realmInfo = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), setup.components),
    [structureEntityId, resources, structureBuildings],
  );

  const populationPercentage = realmInfo?.capacity
    ? Math.min(
        100,
        Math.round(
          ((realmInfo.population || 0) / (realmInfo.capacity + configManager.getBasePopulationCapacity())) * 100,
        ),
      )
    : 0;

  const isPopulationNearCapacity = populationPercentage >= 80;

  // Calculate storage capacity percentage
  const storagePercentage = realmInfo?.storehouses
    ? Math.min(100, Math.round((realmInfo.storehouses.capacityUsedKg / realmInfo.storehouses.capacityKg) * 100))
    : 0;

  const isStorageNearCapacity = storagePercentage >= 80;
  const formattedStorehouseCapacity = realmInfo?.storehouses
    ? formatStorageValue(realmInfo.storehouses.capacityKg)
    : null;
  const formattedStorehouseCapacityUsed = realmInfo?.storehouses
    ? formatStorageValue(realmInfo.storehouses.capacityUsedKg)
    : null;

  return (
    <div className={clsx("flex gap-4", className)}>
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
          className="storehouse-selector text-lg flex gap-2 justify-start items-center transition-colors duration-200 cursor-help"
        >
          <CircularProgress progress={storagePercentage} size="sm" color={isStorageNearCapacity ? "red" : "gold"}>
            <ResourceIcon withTooltip={false} resource="Silo" size="xs" className="self-center" />
          </CircularProgress>
          <div className="flex flex-col">
            <div className={clsx("text-xs", isStorageNearCapacity && "text-red")}>
              {formattedStorehouseCapacity?.isInfinite ? (
                <span>∞</span>
              ) : (
                <>
                  {formattedStorehouseCapacityUsed?.display} / {formattedStorehouseCapacity?.display} kg
                </>
              )}
            </div>
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
        className="population-selector flex gap-2 justify-start items-center cursor-help text-lg"
      >
        <CircularProgress progress={populationPercentage} size="sm" color={isPopulationNearCapacity ? "red" : "gold"}>
          <ResourceIcon withTooltip={false} resource="House" size="xs" className="self-center" />
        </CircularProgress>
        <div className="flex flex-col">
          <div className={clsx("text-xs", isPopulationNearCapacity && "text-red")}>
            {realmInfo?.population || 0} / {(realmInfo?.capacity || 0) + configManager.getBasePopulationCapacity()}
          </div>
        </div>
      </div>
    </div>
  );
};
