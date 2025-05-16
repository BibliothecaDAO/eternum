import { formatArrivals } from "@bibliothecadao/eternum";
import { ClientComponents, ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../";

export const useArrivalsByStructure = (structureEntityId: ID) => {
  const {
    setup: {
      components: { ResourceArrival },
    },
  } = useDojo();

  const arrivalEntities = useEntityQuery([
    Has(ResourceArrival),
    HasValue(ResourceArrival, { structure_id: structureEntityId }),
  ]);

  const arrivals = arrivalEntities
    .map((arrivalsEntityId) => {
      return getComponentValue(ResourceArrival, arrivalsEntityId);
    })
    .filter(Boolean) as ComponentValue<ClientComponents["ResourceArrival"]["schema"]>[];

  return formatArrivals(arrivals);
};
