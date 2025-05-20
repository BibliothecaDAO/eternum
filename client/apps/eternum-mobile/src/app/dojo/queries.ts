// onload -> fetch single key entities

import { HexPosition, ID, StructureType } from "@bibliothecadao/types";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { getEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { Clause, LogicalOperator } from "@dojoengine/torii-wasm";
import {
  debouncedGetBuildingsFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetOwnedArmiesFromTorii,
  debouncedGetTilesForPositionsFromTorii,
} from "./debounced-queries";
import { EVENT_QUERY_LIMIT } from "./sync";

export const getTilesForPositionsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  positions: HexPosition[],
) => {
  if (positions.length === 0) {
    return Promise.resolve([]);
  }

  const tileClauses = positions.map((pos) =>
    AndComposeClause([
      MemberClause("s1_eternum-Tile", "col", "Eq", pos.col),
      MemberClause("s1_eternum-Tile", "row", "Eq", pos.row),
    ]).build(),
  );

  return getEntities(
    client,
    {
      Composite: {
        operator: "Or" as LogicalOperator,
        clauses: tileClauses,
      },
    },
    components as any,
    [],
    ["s1_eternum-Tile"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getStructuresDataFromTorii = async (
  client: ToriiClient,
  components: Component<Schema, Metadata, undefined>[],
  structures: { entityId: ID; position: HexPosition }[],
) => {
  const playerStructuresModels = [
    "s1_eternum-Structure",
    "s1_eternum-Resource",
    "s1_eternum-StructureBuildings",
    "s1_eternum-ResourceArrival",
    "s1_eternum-ProductionWonderBonus",
  ];

  // Create promises for all queries without awaiting them
  const structuresPromise = debouncedGetEntitiesFromTorii(
    client,
    components as any,
    structures.map((structure) => structure.entityId),
    playerStructuresModels,
    () => {},
  );

  const armiesPromise = debouncedGetOwnedArmiesFromTorii(
    client,
    components as any,
    structures.map((structure) => structure.entityId),
    () => {},
  );

  const buildingsPromise = debouncedGetBuildingsFromTorii(
    client,
    components as any,
    structures.map((structure) => structure.position),
    () => {},
  );

  // Query tile components for the structure positions
  const tilePositions = structures.map((structure) => structure.position);
  const tilePromise = debouncedGetTilesForPositionsFromTorii(client, components as any, tilePositions, () => {});

  // Execute all promises in parallel
  return Promise.all([structuresPromise, armiesPromise, buildingsPromise, tilePromise]);
};

export const getConfigFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const oneKeyConfigModels = [
    "s1_eternum-WorldConfig",
    "s1_eternum-HyperstructureConstructConfig",
    "s1_eternum-WeightConfig",
    "s1_eternum-ResourceFactoryConfig",
    "s1_eternum-BuildingCategoryConfig",
    "s1_eternum-ResourceBridgeWhitelistConfig",
    "s1_eternum-StructureLevelConfig",
    "s1_eternum-SeasonPrize",
    "s1_eternum-QuestLevels",
    "s1_eternum-AddressName",
  ];

  const twoKeyConfigModels = ["s1_eternum-ResourceList"];

  const configModels = [...oneKeyConfigModels, ...twoKeyConfigModels];
  // todo: only 1 undefined clause variable len
  const configClauses: Clause[] = [
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: oneKeyConfigModels,
      },
    },
    {
      Keys: {
        keys: [undefined, undefined],
        pattern_matching: "FixedLen",
        models: twoKeyConfigModels,
      },
    },
  ];
  return getEntities(
    client,
    { Composite: { operator: "Or", clauses: configClauses } },
    components,
    [],
    configModels,
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getEntitiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityIDs: ID[],
  entityModels: string[],
) => {
  const query =
    entityIDs.length === 1
      ? {
          Keys: {
            keys: [entityIDs[0].toString()],
            pattern_matching: "VariableLen" as PatternMatching,
            models: [],
          },
        }
      : {
          Composite: {
            operator: "Or" as LogicalOperator,
            clauses: [
              ...entityIDs.map((id) => ({
                Keys: {
                  keys: [id.toString()],
                  pattern_matching: "VariableLen" as PatternMatching,
                  models: [],
                },
              })),
            ],
          },
        };

  return getEntities(client, query, components as any, [], entityModels, 40_000, true);
};

export const getMarketFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const promiseMarket = getEntities(
    client,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
    components,
    [],
    ["s1_eternum-Market", "s1_eternum-Liquidity", "s1_eternum-Trade"],
    EVENT_QUERY_LIMIT,
    false,
  );
  return Promise.all([promiseMarket]);
};

export const getBankStructuresFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  return getEntities(
    client,
    MemberClause("s1_eternum-Structure", "category", "Eq", StructureType.Bank).build(),
    components,
    [],
    ["s1_eternum-Structure"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getOwnedArmiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  owners: number[],
) => {
  return getEntities(
    client,
    {
      Composite: {
        operator: "Or",
        clauses: owners.map((owner) => ({
          Member: {
            model: "s1_eternum-ExplorerTroops",
            member: "owner",
            operator: "Eq",
            value: { Primitive: { U32: owner } },
          },
        })),
      },
    },
    components,
    [],
    ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getBuildingsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  structurePositions: HexPosition[],
) => {
  const query = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: structurePositions.map((position) => ({
        Keys: {
          keys: [position.col.toString(), position.row.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: ["s1_eternum-Building"],
        },
      })),
    },
  };

  return getEntities(client, query, components as any, [], ["s1_eternum-Building"], EVENT_QUERY_LIMIT, false);
};
