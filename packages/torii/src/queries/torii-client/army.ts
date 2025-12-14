import { ID } from "@bibliothecadao/types";
// import { Entity } from "@dojoengine/recs"; // Will be removed
import { PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getExplorerFromToriiEntity, getResourcesFromToriiEntity } from "../../parser/torii-client";

export const getExplorerFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const query: Query = {
    // world_addresses: [],
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [], // Preserved from original query logic, now in pagination
    },
    no_hashed_keys: false, // Mapped from 'dont_include_hashed_keys'
    models: ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"], // Mapped from 'entity_models'
    historical: false, // Added for consistency with address.ts
    clause: {
      Keys: {
        keys: [entityId.toString()],
        pattern_matching: "FixedLen" as PatternMatching,
        // Models associated with the keys, mirroring the top-level models
        models: ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"],
      },
    },
  };

  const response = await toriiClient.getEntities(query); // Updated call, removed second argument

  if (!response?.items?.[0]?.models) {
    return {
      explorer: undefined,
      resources: undefined,
    };
  }

  const entityModels = response.items[0].models;
  const explorerModelData = entityModels["s1_eternum-ExplorerTroops"];
  const resourceModelData = entityModels["s1_eternum-Resource"];

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
