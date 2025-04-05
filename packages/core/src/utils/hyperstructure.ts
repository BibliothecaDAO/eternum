import { getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../dojo";
import { getEntityIdFromKeys } from "./utils";

export const getHyperstructureProgress = (hyperstructureId: number, components: ClientComponents) => {
  const hyperstructure = getComponentValue(components.Hyperstructure, getEntityIdFromKeys([BigInt(hyperstructureId)]));

  const hyperstructureRequiredAmounts = getComponentValue(
    components.HyperstructureRequirements,
    getEntityIdFromKeys([BigInt(hyperstructureId)]),
  );
  const percentage = hyperstructureRequiredAmounts?.current_resource_total
    ? Number(
        (hyperstructureRequiredAmounts.current_resource_total * 100n) /
          hyperstructureRequiredAmounts.needed_resource_total,
      )
    : 0;

  return {
    percentage,
    initialized: hyperstructure?.initialized || false,
  };
};
