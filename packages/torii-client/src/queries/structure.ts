import { getNeighborHexes, HexPosition, ID, Steps, StructureType } from "@bibliothecadao/types";
import { Entity } from "@dojoengine/recs";
import { AndComposeClause, MemberClause, OrComposeClause } from "@dojoengine/sdk";
import { Clause, PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getStructureFromToriiEntity } from "../parser";
import { getResourcesFromToriiEntity } from "../parser/resources";

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

export const getStructureFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
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
    entity_models: ["s1_eternum-Structure", "s1_eternum-Resource"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const entity = Object.keys(entities)[0] as Entity;

  if (!entity) return;

  return {
    structure: getStructureFromToriiEntity(entities[entity]["s1_eternum-Structure"]),
    resources: getResourcesFromToriiEntity(entities[entity]["s1_eternum-Resource"]),
  };
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

export const getFreeVillagePositionsFromToriiClient = async (
  toriiClient: ToriiClient,
  contractPosition: HexPosition,
) => {
  const neighborHexes = getNeighborHexes(contractPosition.col, contractPosition.row, Steps.Two);
  const freePositions: typeof neighborHexes = [];

  const query: Query = {
    limit: 6,
    offset: 0,
    clause: OrComposeClause(
      neighborHexes.map((hex) =>
        AndComposeClause([
          MemberClause("s1_eternum-Structure", "base.coord_x", "Eq", hex.col),
          MemberClause("s1_eternum-Structure", "base.coord_y", "Eq", hex.row),
        ]),
      ),
    ).build(),
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);

  // Create a set of occupied positions
  const occupiedPositions = new Set<string>();

  Object.keys(entities).forEach((entity) => {
    const structure = getStructureFromToriiEntity(entities[entity]["s1_eternum-Structure"]);
    const posKey = `${structure.base.coord_x},${structure.base.coord_y}`;
    occupiedPositions.add(posKey);
  });

  // Only add positions that are not occupied by structures
  for (const hex of neighborHexes) {
    const posKey = `${hex.col},${hex.row}`;
    if (!occupiedPositions.has(posKey)) {
      freePositions.push(hex);
    }
  }

  return freePositions;
};

// Function to get a random realm with village slots
export const getRandomRealmWithVillageSlotsFromTorii = async (toriiClient: ToriiClient, realmCount: number) => {
  // Generate a random offset
  const randomOffset = Math.floor(Math.random() * realmCount);

  // Query with random offset
  const query: Query = {
    limit: 1,
    offset: randomOffset,
    clause: AndComposeClause([
      MemberClause("s1_eternum-Structure", "metadata.villages_count", "Lte", 5),
      MemberClause("s1_eternum-Structure", "base.category", "Eq", StructureType.Realm),
    ]).build(),
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const entity = Object.keys(entities)[0];
  if (!entity) {
    return null;
  }

  const entityData = entities[entity]["s1_eternum-Structure"] as any;
  return getStructureFromToriiEntity(entityData);
};

// Function to check if a specific realm has village slots
export const checkOpenVillageSlotFromToriiClient = async (toriiClient: ToriiClient, realmId: ID) => {
  const query: Query = {
    limit: 1,
    offset: 0,
    clause: AndComposeClause([MemberClause("s1_eternum-Structure", "metadata.realm_id", "Eq", realmId)]).build(),
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query, false);
  const realmEntityId = Object.keys(entities)[0] as Entity;

  if (!realmEntityId) {
    return null;
  }

  const structure = getStructureFromToriiEntity(entities[realmEntityId]["s1_eternum-Structure"]);

  return {
    realmId: structure.metadata.realm_id,
    entityId: structure.entity_id,
    villagesCount: structure.metadata.villages_count,
    hasSlots: structure.metadata.villages_count < 6,
    availableSlots: 6 - structure.metadata.villages_count,
    position: { col: structure.base.coord_x, row: structure.base.coord_y },
  };
};
