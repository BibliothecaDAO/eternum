import { ResourcesIds } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";

export const blitzHyperstructureConfig: ConfigPatch = {
  hyperstructures: {
    hyperstructureInitializationShardsCost: {
      resource: ResourcesIds.AncientFragment,
      amount: 0,
    },
    hyperstructureConstructionCost: [],
  },
};
