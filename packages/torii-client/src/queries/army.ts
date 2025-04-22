import { ID } from "@bibliothecadao/types";
import { Entity } from "@dojoengine/recs";
import { PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getExplorerFromToriiEntity, getResourcesFromToriiEntity } from "../parser";

export const getExplorerFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const query: Query = {
    limit: 1,
    offset: 0,
    clause: {
      Keys: {
        keys: [entityId.toString()],
        pattern_matching: "FixedLen" as PatternMatching,
        models: [],
      },
    },
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const entity = Object.keys(entities)[0] as Entity;
  return {
    explorer: getExplorerFromToriiEntity(entities[entity]["s1_eternum-ExplorerTroops"]),
    resources: getResourcesFromToriiEntity(entities[entity]["s1_eternum-Resource"]),
  };
};
