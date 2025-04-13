// onload -> fetch single key entities

import { ID, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { getEntities, getEvents } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { Clause, ComparisonOperator, LogicalOperator, Query } from "@dojoengine/torii-wasm";
import {
  debouncedGetBuildingsFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetOwnedArmiesFromTorii,
} from "./debounced-queries";
import { EVENT_QUERY_LIMIT } from "./sync";

export const getStructuresDataFromTorii = async (
  client: ToriiClient,
  components: Component<Schema, Metadata, undefined>[],
  structures: ID[],
) => {
  const playerStructuresModels = [
    "s1_eternum-Structure",
    "s1_eternum-Resource",
    "s1_eternum-StructureBuildings",
    "s1_eternum-ResourceArrival",
  ];

  const query: Query = {
    limit: EVENT_QUERY_LIMIT,
    offset: 0,
    clause:
      structures.length === 1
        ? {
            Keys: {
              keys: [structures[0].toString()],
              pattern_matching: "FixedLen" as PatternMatching,
              models: ["s1_eternum-Structure"],
            },
          }
        : {
            Composite: {
              operator: "And",
              clauses: [
                ...structures.map((structure) => ({
                  Keys: {
                    keys: [structure.toString()],
                    pattern_matching: "FixedLen" as PatternMatching,
                    models: ["s1_eternum-Structure"],
                  },
                })),
              ],
            },
          },
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const structurePositionEntities = await client.getEntities(query);

  // Extract positions from the structure data
  const positions = Object.values(structurePositionEntities || {})
    .filter((model) => model && typeof model === "object" && "s1_eternum-Structure" in model)
    .map((model) => {
      const structure = model["s1_eternum-Structure"] as any;
      if (structure && structure.base && structure.base.value) {
        const baseValue = structure.base.value;
        return {
          x: baseValue.coord_x.value,
          y: baseValue.coord_y.value,
        };
      }
      return null;
    })
    .filter((pos) => pos !== null);

  // Create promises for both queries without awaiting them
  const structuresPromise = debouncedGetEntitiesFromTorii(
    client,
    components as any,
    structures,
    playerStructuresModels,
    () => {},
  );

  const armiesPromise = debouncedGetOwnedArmiesFromTorii(client, components as any, structures, () => {});

  const buildingsPromise = debouncedGetBuildingsFromTorii(client, components as any, positions, () => {});

  // Execute both promises in parallel
  return Promise.all([structuresPromise, armiesPromise, buildingsPromise]);
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

export const getSeasonPrizeFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const models = ["s1_eternum-SeasonPrize"];
  return getEvents(
    client,
    components,
    [],
    models,
    1,
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString()],
        pattern_matching: "FixedLen",
        models,
      },
    },
    false,
    false,
  );
};

export const getAddressNamesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const models = ["s1_eternum-AddressName"];
  const query = {
    Keys: {
      keys: [undefined],
      pattern_matching: "FixedLen" as PatternMatching,
      models,
    },
  };

  return getEntities(client, query, components as any, [], models, EVENT_QUERY_LIMIT, false);
};

export const getGuildsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const singleKeyModels = ["s1_eternum-Guild", "s1_eternum-GuildMember"];
  const twoKeyModels = ["s1_eternum-GuildWhitelist"];
  const models = [...singleKeyModels, ...twoKeyModels];

  const query = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: [
        {
          Keys: {
            keys: [undefined],
            pattern_matching: "FixedLen" as PatternMatching,
            models: singleKeyModels,
          },
        },
        {
          Keys: {
            keys: [undefined, undefined],
            pattern_matching: "FixedLen" as PatternMatching,
            models: twoKeyModels,
          },
        },
      ],
    },
  };

  return getEntities(client, query, components as any, [], models, EVENT_QUERY_LIMIT, false);
};

export const getHyperstructureFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const query = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: [
        {
          Keys: {
            keys: [undefined],
            pattern_matching: "FixedLen" as PatternMatching,
            models: [],
          },
        },
        {
          Keys: {
            keys: [undefined, undefined],
            pattern_matching: "FixedLen" as PatternMatching,
            models: [],
          },
        },
        {
          Keys: {
            keys: [undefined, undefined, undefined],
            pattern_matching: "FixedLen" as PatternMatching,
            models: [],
          },
        },
      ],
    },
  };

  const hyperstructureModels = [
    "s1_eternum-HyperstructureGlobals",
    "s1_eternum-Hyperstructure",
    "s1_eternum-HyperstructureShareholders",
    "s1_eternum-HyperstructureRequirements",
    "s1_eternum-PlayerRegisteredPoints",
    "s1_eternum-PlayerConstructionPoints",
  ];

  return getEntities(client, query, components as any, [], hyperstructureModels, EVENT_QUERY_LIMIT, false);
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
  return getEntities(client, query, components as any, [], entityModels, 40_000);
};

export const getMarketFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const promiseResourceList = getEntities(
    client,
    {
      Member: {
        model: "s1_eternum-ResourceList",
        member: "amount",
        operator: "Gt",
        value: { Primitive: { U128: "0" } },
      },
    },
    components,
    [],
    ["s1_eternum-ResourceList"],
    EVENT_QUERY_LIMIT,
    false,
  );

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
    ["s1_eternum-Market", "s1_eternum-Liquidity"],
    EVENT_QUERY_LIMIT,
    false,
  );
  return Promise.all([promiseResourceList, promiseMarket]);
};

export const getMarketEventsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const marketEventModels = ["s1_eternum-AcceptOrder", "s1_eternum-SwapEvent", "s1_eternum-LiquidityEvent"];
  return getEvents(
    client,
    components,
    [],
    marketEventModels,
    EVENT_QUERY_LIMIT,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
    false,
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
  structurePositions: { x: number; y: number }[],
) => {
  const query = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: structurePositions.map((position) => ({
        Member: {
          model: "s1_eternum-Building",
          member: "outer_col",
          operator: "Eq" as ComparisonOperator,
          value: { Primitive: { U32: position.x } },
        },
      })),
    },
  };

  return getEntities(client, query, components as any, [], ["s1_eternum-Building"], EVENT_QUERY_LIMIT, false);
};

export const getMapFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  startCol: number,
  startRow: number,
  range: number,
) => {
  const promiseTiles = getEntities(
    client,
    AndComposeClause([
      MemberClause("s1_eternum-Tile", "col", "Gte", startCol - range),
      MemberClause("s1_eternum-Tile", "col", "Lte", startCol + range),
      MemberClause("s1_eternum-Tile", "row", "Gte", startRow - range),
      MemberClause("s1_eternum-Tile", "row", "Lte", startRow + range),
    ]).build(),
    components as any,
    [],
    ["s1_eternum-Tile"],
    EVENT_QUERY_LIMIT,
    false,
  );
  // todo: verify that this works with nested struct
  const promiseExplorers = getEntities(
    client,
    AndComposeClause([
      MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Gte", startCol - range),
      MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Lte", startCol + range),
      MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Gte", startRow - range),
      MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Lte", startRow + range),
    ]).build(),
    components as any,
    [],
    ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"],
    EVENT_QUERY_LIMIT,
    false,
  );

  const promiseStructures = getEntities(
    client,
    AndComposeClause([
      MemberClause("s1_eternum-Structure", "base.coord_x", "Gte", startCol - range),
      MemberClause("s1_eternum-Structure", "base.coord_x", "Lte", startCol + range),
      MemberClause("s1_eternum-Structure", "base.coord_y", "Gte", startRow - range),
      MemberClause("s1_eternum-Structure", "base.coord_y", "Lte", startRow + range),
    ]).build(),
    components as any,
    [],
    ["s1_eternum-Structure", "s1_eternum-Resource"],
    EVENT_QUERY_LIMIT,
    false,
  );

  return Promise.all([promiseTiles, promiseExplorers, promiseStructures]);
};
