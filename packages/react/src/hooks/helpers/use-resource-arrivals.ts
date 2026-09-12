import { arrivalsByStructureQuery, readResourceArrivals } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../";

export const useArrivalsByStructure = (structureEntityId: ID) => {
  const {
    setup: { components },
  } = useDojo();

  const arrivalEntities = useEntityQuery(arrivalsByStructureQuery(components, structureEntityId));

  return readResourceArrivals(components, arrivalEntities);
};
