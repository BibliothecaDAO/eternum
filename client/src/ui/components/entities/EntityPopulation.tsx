import { useDojo } from "@/hooks/context/DojoContext";
import { BASE_POPULATION_CAPACITY } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export const EntityPopulation = ({ entityId }: { entityId: any }) => {
  const {
    setup: {
      components: { Population },
    },
  } = useDojo();

  const population = useComponentValue(Population, getEntityIdFromKeys([entityId]));

  return (
    <div className="p-2">
      <div>Population: {population?.population}</div>
      <div>Capacity: {(population?.capacity || 0) + BASE_POPULATION_CAPACITY}</div>
    </div>
  );
};
