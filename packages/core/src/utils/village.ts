import { Entity, getComponentValue } from "@dojoengine/recs";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { Query, ToriiClient } from "@dojoengine/torii-client";
import { getNeighborHexes, Steps, StructureType } from "../constants";
import { ClientComponents } from "../dojo";
import { ID } from "../types";
import { getEntityIdFromKeys } from "./utils";

export const getFreeVillagePositions = (realmEntityId: ID, components: ClientComponents) => {
  const structureBase = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]))?.base;
  if (!structureBase) return [];

  const freePositions = [];

  const neighborHexes = getNeighborHexes(structureBase.coord_x, structureBase.coord_y, Steps.Two);

  for (const hex of neighborHexes) {
    const tile = getComponentValue(components.Tile, getEntityIdFromKeys([BigInt(hex.col), BigInt(hex.row)]));
    if (!tile?.occupier_is_structure) freePositions.push(hex);
  }

  return freePositions;
};

// Function to get a random realm with village slots
export const getRandomRealmWithVillageSlots = async (toriiClient: ToriiClient, components: ClientComponents) => {
  const query: Query = {
    limit: 1,
    offset: 0,
    clause: AndComposeClause([
      MemberClause("s1_eternum-Structure", "metadata.villages_count", "Lte", 5),
      MemberClause("s1_eternum-Structure", "base.category", "Eq", StructureType.Realm),
    ]).build(),
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query);

  // Filter for realms (category = StructureType.Realm)
  const realmEntity = Object.keys(entities)[0];

  if (!realmEntity) {
    return null;
  }

  return getComponentValue(components.Structure, realmEntity as Entity);
};

// Function to check if a specific realm has village slots
export const checkOpenVillageSlot = async (toriiClient: ToriiClient, components: ClientComponents, realmId: ID) => {
  const query: Query = {
    limit: 1,
    offset: 0,
    clause: AndComposeClause([
      MemberClause("s1_eternum-Structure", "metadata.realm_id", "Eq", realmId),
      MemberClause("s1_eternum-Structure", "metadata.villages_count", "Lte", 5),
    ]).build(),
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query);
  const realmEntityId = Object.keys(entities)[0] as Entity;

  if (!realmEntityId) {
    return null;
  }

  const structure = getComponentValue(components.Structure, realmEntityId);

  if (!structure) {
    return null;
  }

  return {
    realmId: structure.metadata.realm_id,
    entityId: structure.entity_id,
    villagesCount: structure.metadata.villages_count,
    hasSlots: structure.metadata.villages_count < 6,
    availableSlots: 6 - structure.metadata.villages_count,
  };
};
