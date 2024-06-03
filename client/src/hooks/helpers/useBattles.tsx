import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";

export const useBattles = () => {
  const {
    account: { account },
    setup: {
      components: { Battle },
    },
  } = useDojo();

  const useBattles = () => {
    const entityIds = useEntityQuery([Has(Battle)]);
    return Array.from(entityIds).map((entityId) => {
      const army = getComponentValue(Battle, entityId);
      if (!army) return;
      return army;
    });
  };

  return { useBattles };
};
