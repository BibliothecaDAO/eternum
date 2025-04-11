import { ComponentValue, Entity, getComponentValue } from "@dojoengine/recs";
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
  const entity = Object.keys(entities)[0];
  if (!entity) {
    return null;
  }

  const entityData = entities[entity]["s1_eternum-Structure"] as any;

  return getStructureFromToriiEntity(entityData);
};

export const getStructureFromToriiEntity = (entityData: any) => {
  const structure: ComponentValue<ClientComponents["Structure"]["schema"]> = {
    entity_id: entityData.entity_id?.value,
    owner: entityData.owner?.value,
    category: entityData.category?.value,
    resources_packed: entityData.resources_packed?.value,
    base: {
      troop_guard_count: entityData.base?.value?.troop_guard_count?.value,
      troop_explorer_count: entityData.base?.value?.troop_explorer_count?.value,
      troop_max_guard_count: entityData.base?.value?.troop_max_guard_count?.value,
      troop_max_explorer_count: entityData.base?.value?.troop_max_explorer_count?.value,
      created_at: entityData.base?.value?.created_at?.value,
      category: entityData.base?.value?.category?.value,
      coord_x: entityData.base?.value?.coord_x?.value,
      coord_y: entityData.base?.value?.coord_y?.value,
      level: entityData.base?.value?.level?.value,
    },
    troop_guards: {
      delta: {
        category: entityData.troop_guards?.value?.delta?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.delta?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.delta?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.delta?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.delta?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      charlie: {
        category: entityData.troop_guards?.value?.charlie?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.charlie?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.charlie?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.charlie?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.charlie?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      bravo: {
        category: entityData.troop_guards?.value?.bravo?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.bravo?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.bravo?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.bravo?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.bravo?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      alpha: {
        category: entityData.troop_guards?.value?.alpha?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.alpha?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.alpha?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.alpha?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.alpha?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      delta_destroyed_tick: entityData.troop_guards?.value?.delta_destroyed_tick?.value,
      charlie_destroyed_tick: entityData.troop_guards?.value?.charlie_destroyed_tick?.value,
      bravo_destroyed_tick: entityData.troop_guards?.value?.bravo_destroyed_tick?.value,
      alpha_destroyed_tick: entityData.troop_guards?.value?.alpha_destroyed_tick?.value,
    },
    troop_explorers: entityData.troop_explorers?.value || [],
    metadata: {
      realm_id: entityData.metadata?.value?.realm_id?.value,
      order: entityData.metadata?.value?.order?.value,
      has_wonder: entityData.metadata?.value?.has_wonder?.value,
      villages_count: entityData.metadata?.value?.villages_count?.value,
      village_realm: entityData.metadata?.value?.village_realm?.value,
    },
  };

  console.log({ entityData, structure });

  return structure;
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
