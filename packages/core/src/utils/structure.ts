import { Entity, getComponentValue } from "@dojoengine/recs";
import { Clause, PatternMatching, Query } from "@dojoengine/torii-client";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager, Structure } from "..";
import { MERCENARIES, StructureType } from "../constants";
import { ClientComponents, SetupResult } from "../dojo";
import { ContractAddress, ID, Position, TickIds } from "../types";
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

export const getAllStructures = async (setup: SetupResult, ownedBy?: string) => {
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
    limit: 100,
    offset: 0,
    clause,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await setup.network.toriiClient.getEntities(query);
  const result = Object.keys(entities).map((entity) => {
    const structure = entities[entity]["s1_eternum-Structure"] as any;
    const entityId = structure.entity_id.value;
    const owner = structure.owner.value as string;
    return { entityId, owner };
  });
  return result;
};

export const getFirstStructure = async (setup: SetupResult, ownedBy?: string) => {
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

  const entities = await setup.network.toriiClient.getEntities(query);
  const realmEntity = Object.keys(entities)[0] as Entity;

  if (!realmEntity) {
    return;
  }

  const structure = entities[realmEntity]["s1_eternum-Structure"] as any;
  const entityId = structure.entity_id.value;
  const owner = structure.owner.value as string;

  return { entityId, owner };
};
