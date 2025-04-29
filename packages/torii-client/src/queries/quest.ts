import { PatternMatching } from "@dojoengine/torii-wasm";

import { ID } from "@bibliothecadao/types";
import { ToriiClient } from "@dojoengine/torii-wasm";

import { Entity } from "@dojoengine/recs";
import { Query } from "@dojoengine/torii-wasm";
import { getQuestFromToriiEntity } from "../parser/quest";

export const getQuestFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
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
    entity_models: ["s1_eternum-QuestTile"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const entity = Object.keys(entities)[0] as Entity;

  if (!entity) return;

  return getQuestFromToriiEntity(entities[entity]["s1_eternum-QuestTile"]);
};
