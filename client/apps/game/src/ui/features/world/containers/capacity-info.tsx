import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, getRealmInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { useMemo } from "react";
import { CircularProgress } from "./top-left-navigation/circular-progress";

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

  return (
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
  );
};
