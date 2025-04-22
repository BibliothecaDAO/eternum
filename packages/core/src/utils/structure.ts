import {
  ClientComponents,
  ContractAddress,
  ID,
  MERCENARIES,
  Position,
  Structure,
  StructureType,
  TickIds,
} from "@bibliothecadao/types";
import { ComponentValue, Entity, getComponentValue } from "@dojoengine/recs";
import { Clause, PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager } from "../managers";
import { getEntityName } from "./entities";
import { currentTickCount } from "./utils";

export const getStructureAtPosition = (
  { x, y }: Position,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const tile = getComponentValue(components.Tile, getEntityIdFromKeys([BigInt(x), BigInt(y)]));
  const structureEntity = getEntityIdFromKeys([BigInt(tile?.occupier_id || 0n)]);

  if (!structureEntity) return;

  return getStructureInfo(structureEntity, playerAddress, components);
};

export const getStructure = (
  entityId: Entity | ID,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const structureEntity = typeof entityId === "string" ? entityId : getEntityIdFromKeys([BigInt(entityId)]);
  return getStructureInfo(structureEntity, playerAddress, components);
};

const getStructureInfo = (
  entity: Entity,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const structure = getComponentValue(components.Structure, entity);
  if (!structure) return;

  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([structure.owner]));
  const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : MERCENARIES;

  const name = getEntityName(structure.entity_id, components);

  return {
    entityId: structure.entity_id,
    structure,
    owner: structure.owner,
    name,
    position: { x: structure.base.coord_x, y: structure.base.coord_y },
    isMine: ContractAddress(structure.owner) === playerAddress,
    isMercenary: structure.owner === 0n,
    ownerName,
    category: structure.base.category,
  };
};

export const isStructureImmune = (
  structure: { category: number; created_at: number } | undefined,
  currentTimestamp: number,
): boolean => {
  const structureType = structure?.category as StructureType;

  const tickCount = currentTickCount(currentTimestamp);
  const allowAttackTick =
    currentTickCount(Number(structure?.created_at || 0)) + configManager.getBattleGraceTickCount(structureType);

  if (tickCount < allowAttackTick) {
    return true;
  }
  return false;
};

export const getStructureImmunityTimer = (structure: Structure | undefined, currentBlockTimestamp: number) => {
  const structureType = structure?.structure.base.category as StructureType;

  const immunityEndTimestamp =
    Number(structure?.structure.base.created_at || 0) +
    (structure ? configManager.getBattleGraceTickCount(structureType) * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};

export const getStructureTypeName = (structureType: StructureType) => {
  switch (structureType) {
    case StructureType.Bank:
      return "Bank";
    case StructureType.Hyperstructure:
      return "Hyperstructure";
    case StructureType.FragmentMine:
      return "Fragment Mine";
    case StructureType.Village:
      return "Village";
    case StructureType.Realm:
      return "Realm";
    default:
      return "Unknown";
  }
};

export const getAllStructuresFromToriiClient = async (toriiClient: ToriiClient, ownedBy?: string) => {
  const clause: Clause = !ownedBy
    ? {
      Keys: {
        keys: [undefined], // matches any key
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s1_eternum-Structure"], // specify the model you want to query
      },
    }
    : {
      Member: {
        model: "s1_eternum-Structure",
        member: "owner",
        operator: "Eq",
        value: { Primitive: { ContractAddress: ownedBy } },
      },
    };

  const query: Query = {
    limit: 1000,
    offset: 0,
    clause,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const result = Object.keys(entities).map((entity) => {
    const structure = getStructureFromToriiEntity(entities[entity]["s1_eternum-Structure"]);
    return {
      entityId: structure.entity_id,
      owner: structure.owner,
      position: { col: structure.base.coord_x, row: structure.base.coord_y },
    };
  });
  return result;
};

export const getFirstStructureFromToriiClient = async (toriiClient: ToriiClient, ownedBy?: string) => {
  const clause: Clause = !ownedBy
    ? {
      Keys: {
        keys: [undefined], // matches any key
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s1_eternum-Structure"], // specify the model you want to query
      },
    }
    : {
      Composite: {
        operator: "And",
        clauses: [
          {
            Keys: {
              keys: [undefined], // matches any key
              pattern_matching: "FixedLen" as PatternMatching,
              models: ["s1_eternum-Structure"], // specify the model you want to query
            },
          },
          {
            Member: {
              model: "s1_eternum-Structure",
              member: "owner",
              operator: "Eq",
              value: { Primitive: { ContractAddress: ownedBy } },
            },
          },
        ],
      },
    };

  const query: Query = {
    limit: 1,
    offset: 0,
    clause,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const realmEntity = Object.keys(entities)[0] as Entity;

  if (!realmEntity) {
    return;
  }

  const structure = getStructureFromToriiEntity(entities[realmEntity]["s1_eternum-Structure"]);

  return {
    entityId: structure.entity_id,
    owner: structure.owner,
    position: { col: structure.base.coord_x, row: structure.base.coord_y },
  };
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

  return structure;
};
