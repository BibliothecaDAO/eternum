import { useDojo } from "@/hooks/context/DojoContext";
import { ConfigManager } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export const EntityPopulation = ({ entityId }: { entityId: any }) => {
  const {
    setup: {
      components: { Population },
    },
  } = useDojo();
  const basePopulationCapacity = ConfigManager.instance().getConfig().basePopulationCapacity;

  const population = useComponentValue(Population, getEntityIdFromKeys([entityId]));

  return (
    <div className="p-2">
      <div>Population: {population?.population}</div>
      <div>Capacity: {(population?.capacity || 0) + basePopulationCapacity}</div>
    </div>
  );
};
