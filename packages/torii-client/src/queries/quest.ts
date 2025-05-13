import { PatternMatching } from "@dojoengine/torii-wasm";

import { ID } from "@bibliothecadao/types";
import { ToriiClient } from "@dojoengine/torii-wasm";

import { Query } from "@dojoengine/torii-wasm";
import { getQuestFromToriiEntity } from "../parser/quest";

export const getQuestFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const query: Query = {
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [], // Preserved from original query logic, now in pagination
    },
    no_hashed_keys: false,
    models: ["s1_eternum-QuestTile"],
    historical: false, // Added for consistency with address.ts
    clause: {
      Keys: {
        keys: [entityId.toString()],
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s1_eternum-QuestTile"],
      },
    },
  };

  const response = await toriiClient.getEntities(query);

  if (!response?.items?.[0]?.models) {
    return null;
  }

  const entityModels = response.items[0].models;
  const questModelData = entityModels["s1_eternum-QuestTile"];

  if (!questModelData) {
    return null;
  }

  return getQuestFromToriiEntity(questModelData);
};
