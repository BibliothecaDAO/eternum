import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";

export const useArmies = ({ entity_id }: { entity_id: bigint }) => {
  const {
    setup: {
      components: { Army, EntityOwner },
    },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

  return {
    entityArmies: () => {
      return armies.map((id) => {
        const army = getComponentValue(Army, id);
        return { ...army, name: "Army" };
      });
    },
  };
};
