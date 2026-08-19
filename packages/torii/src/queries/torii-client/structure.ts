import { ID } from "@bibliothecadao/types";
import { PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getStructureFromToriiEntity } from "../../parser/torii-client";
import { getProductionBoostFromToriiEntity } from "../../parser/torii-client/production-boost";
import { getResourcesFromToriiEntity } from "../../parser/torii-client/resources";
import { getSqlGameScope, scopedEntityKeys } from "../../utils/sql";

export const getStructureFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const { namespace } = getSqlGameScope();
  const models = [`${namespace}-Structure`, `${namespace}-Resource`, `${namespace}-ProductionBoostBonus`];
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

  if (!response.items?.[0]?.models) {
    return {
      structure: undefined,
      resources: undefined,
    };
  }

  const entityModels = response.items[0].models;

  const structureData = entityModels[`${namespace}-Structure`];
  const resourceData = entityModels[`${namespace}-Resource`];
  const productionBoostBonusData = entityModels[`${namespace}-ProductionBoostBonus`];

  if (!structureData) {
    return {
      structure: undefined,
      resources: undefined,
    };
  }

  return {
    structure: getStructureFromToriiEntity(structureData),
    resources: resourceData ? getResourcesFromToriiEntity(resourceData) : undefined,
    productionBoostBonus: productionBoostBonusData
      ? getProductionBoostFromToriiEntity(productionBoostBonusData)
      : undefined,
  };
};
