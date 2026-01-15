import { ID } from "@bibliothecadao/types";
import { PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getStructureFromToriiEntity } from "../../parser/torii-client";
import { getProductionBoostFromToriiEntity } from "../../parser/torii-client/production-boost";
import { getResourcesFromToriiEntity } from "../../parser/torii-client/resources";

export const getStructureFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const query: Query = {
    // world_addresses: [],
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    no_hashed_keys: false,
    models: ["s1_eternum-Structure", "s1_eternum-Resource", "s1_eternum-ProductionBoostBonus"],
    historical: false,
    clause: {
      Keys: {
        keys: [entityId.toString()],
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s1_eternum-Structure", "s1_eternum-Resource", "s1_eternum-ProductionBoostBonus"], // Ensure models list here matches top-level if keys are specific to them
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

  const structureData = entityModels["s1_eternum-Structure"];
  const resourceData = entityModels["s1_eternum-Resource"];
  const productionBoostBonusData = entityModels["s1_eternum-ProductionBoostBonus"];

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
