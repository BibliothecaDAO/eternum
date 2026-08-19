import { ID } from "@bibliothecadao/types";
import { PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getExplorerFromToriiEntity, getResourcesFromToriiEntity } from "../../parser/torii-client";
import { getSqlGameScope, scopedEntityKeys } from "../../utils/sql";

export const getExplorerFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const { namespace } = getSqlGameScope();
  const models = [`${namespace}-ExplorerTroops`, `${namespace}-Resource`];
  const query: Query = {
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    no_hashed_keys: false,
    models,
    historical: false,
    clause: {
      Keys: {
        // s2 per-game models key entities as (game_id, entity_id); keys must be hex.
        keys: scopedEntityKeys(entityId),
        pattern_matching: "FixedLen" as PatternMatching,
        models,
      },
    },
  };

  const response = await toriiClient.getEntities(query);

  if (!response?.items?.[0]?.models) {
    return {
      explorer: undefined,
      resources: undefined,
    };
  }

  const entityModels = response.items[0].models;
  const explorerModelData = entityModels[`${namespace}-ExplorerTroops`];
  const resourceModelData = entityModels[`${namespace}-Resource`];

  if (!explorerModelData) {
    return {
      explorer: undefined,
      resources: undefined,
    };
  }

  return {
    explorer: getExplorerFromToriiEntity(explorerModelData),
    resources: resourceModelData ? getResourcesFromToriiEntity(resourceModelData) : undefined,
  };
};
