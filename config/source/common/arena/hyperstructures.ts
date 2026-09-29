import { ResourcesIds } from "../../../../packages/types/src/constants";
import type { ConfigPatch } from "../merge-config";

export const arenaHyperstructureConfig: ConfigPatch = {
  hyperstructures: {
    hyperstructureInitializationShardsCost: {
      resource: ResourcesIds.AncientFragment,
      amount: 0,
    },
    hyperstructureConstructionCost: [],
  },
};
