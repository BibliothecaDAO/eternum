import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { BuildingType, configManager, getRealmInfo, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

const StorehouseInfo = ({ storehouseCapacity }: { storehouseCapacity: number }) => {
  const capacity = storehouseCapacity;
  return (
    <div className="text-xs text-gray-200 p-1 max-w-xs z-50">
      <p className="font-semibold">Max Storage Capacity ({storehouseCapacity.toLocaleString()} kg)</p>
      <div className="grid grid-cols-2 gap-x-4 my-1">
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Lords)).toLocaleString()} Lords
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Wheat)).toLocaleString()} Food
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Wood)).toLocaleString()} Other
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Labor]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Labor)).toLocaleString()} Labor
          </li>
        </ul>
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Knight)).toLocaleString()} Knights
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Crossbowman)).toLocaleString()} Crossbowmen
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="xs" className="mr-1" />
            {(capacity / configManager.getResourceWeightKg(ResourcesIds.Paladin)).toLocaleString()} Paladins
          </li>
        </ul>
      </div>
      <p className="italic text-xs">Build Storehouses to increase capacity.</p>
    </div>
  );
};

const WorkersHutInfo = () => {
  const capacity = configManager.getBuildingCategoryConfig(BuildingType.WorkersHut).capacity_grant;
  return (
    <div className="text-xs text-gray-200 p-1 max-w-xs z-50">
      <p className="font-semibold">Population Capacity</p>
      <ul className="list-disc list-inside my-1">
        <li>{configManager.getBasePopulationCapacity()} Base Capacity</li>
        <li>+{capacity} per Workers Hut</li>
      </ul>
      <p className="italic text-xs">Build Workers Huts to increase population capacity.</p>
    </div>
  );
};

export const CapacityInfo = ({
  structureEntityId,
  structureCategory,
  className,
}: {
  structureEntityId: number;
  structureCategory?: StructureType;
  className?: string;
}) => {
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

  return (
    <div className={className}>
      {realmInfo?.storehouses && (
        <div
          onMouseEnter={() => {
            setTooltip({
              position: "bottom",
              content: <StorehouseInfo storehouseCapacity={realmInfo.storehouses.capacityKg} />,
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className="storehouse-selector px-3 flex gap-2 justify-start items-center text-xxs md:text-sm"
        >
          <ResourceIcon withTooltip={false} resource="Silo" size="sm" />
          {structureCategory !== StructureType.Realm ? (
            <div className="self-center">∞</div>
          ) : (
            <div className="self-center">{realmInfo.storehouses.capacityKg.toLocaleString()} kg</div>
          )}
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
        className="population-selector px-3 flex gap-2 justify-start items-center text-xs md:text-sm"
      >
        <ResourceIcon withTooltip={false} resource="House" size="sm" />
        <div className="self-center">
          {realmInfo?.population || 0} / {(realmInfo?.capacity || 0) + configManager.getBasePopulationCapacity()}
        </div>
      </div>
    </div>
  );
};
