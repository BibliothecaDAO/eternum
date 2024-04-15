import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, getComponentValue } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";

export const useGetBanks = () => {
  const {
    setup: {
      components: { Bank, Position },
    },
  } = useDojo();

  const entityIds = useEntityQuery([Has(Bank)]);

  return entityIds
    .map((entityId) => {
      const position = getComponentValue(Position, entityId);
      if (!position) return;

      return {
        entityId: position.entity_id,
        position,
      };
    })
    .filter(Boolean) as { entityId: bigint; position: Position }[];
};
