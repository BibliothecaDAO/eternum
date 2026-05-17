// onload -> fetch single key entities

import { HexPosition, ID, StructureType } from "@bibliothecadao/types";
import { Component, Metadata, Schema, getComponentValue } from "@dojoengine/recs";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { getEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { LogicalOperator } from "@dojoengine/torii-wasm";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { env } from "../../env";
import {
  debouncedGetBuildingsFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetOwnedArmiesFromTorii,
} from "./debounced-queries";
import { EVENT_QUERY_LIMIT } from "./sync";

const CONFIG_FETCH_CACHE_PREFIX = "eternum:config-fetched";

const getConfigCacheKey = () => `${CONFIG_FETCH_CACHE_PREFIX}:${env.VITE_PUBLIC_CHAIN}:${env.VITE_PUBLIC_TORII}`;

const hasSessionStorage = () => {
  try {
    return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
  } catch {
    return false;
  }
};

const hasFreshConfigCache = () => {
  if (!hasSessionStorage()) return false;
  try {
    return window.sessionStorage.getItem(getConfigCacheKey()) !== null;
  } catch {
    return false;
  }
};

const markConfigCacheFresh = () => {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(getConfigCacheKey(), Date.now().toString());
  } catch {
    /* storage quota / disabled — ignore */
  }
};

const clearConfigFetchCache = () => {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(getConfigCacheKey());
  } catch {
    /* ignore */
  }
};

const isValidId = (id: unknown): id is ID => typeof id === "number" && Number.isFinite(id);
const hasValidPosition = (position: HexPosition | undefined): position is HexPosition =>
  !!position && Number.isFinite(position.col) && Number.isFinite(position.row);

const STRUCTURE_BASE_MODELS = ["s1_eternum-Structure"];
const OPTIONAL_STRUCTURE_MODEL_GROUPS = [
  ["s1_eternum-Resource", "s1_eternum-StructureBuildings"],
  ["s1_eternum-ResourceArrival"],
  ["s1_eternum-ProductionBoostBonus"],
  ["s1_eternum-VillageTroop"],
  // Needed to inspect hyperstructure shareholder distribution in Blitz worlds.
  ["s1_eternum-HyperstructureShareholders", "s1_eternum-Hyperstructure"],
] as const;

const isIgnorableOptionalStructureSyncError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("no such table") ||
    message.includes("no such column") ||
    message.includes("no rows returned by a query that expected to return at least one row")
  );
};

const syncStructureEntityModels = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  structureEntityIds: ID[],
) => {
  await debouncedGetEntitiesFromTorii(client, components, structureEntityIds, STRUCTURE_BASE_MODELS);

  await Promise.all(
    OPTIONAL_STRUCTURE_MODEL_GROUPS.map(async (modelGroup) => {
      try {
        await debouncedGetEntitiesFromTorii(client, components, structureEntityIds, [...modelGroup]);
      } catch (error) {
        if (!isIgnorableOptionalStructureSyncError(error)) {
          throw error;
        }

        console.warn("[torii] Skipping optional structure model sync for unsupported schema", {
          error,
          modelGroup,
        });
      }
    }),
  );
};

type ConfigModelGroup = {
  keys: Array<string | undefined>;
  models: string[];
  optional?: boolean;
};

const CORE_CONFIG_MODEL_GROUPS: ConfigModelGroup[] = [{ keys: [undefined], models: ["s1_eternum-WorldConfig"] }];

const OPTIONAL_CONFIG_MODEL_GROUPS: ConfigModelGroup[] = [
  { keys: [undefined], models: ["s1_eternum-HyperstructureGlobals"], optional: true },
  { keys: [undefined], models: ["s1_eternum-WeightConfig"], optional: true },
  { keys: [undefined], models: ["s1_eternum-ResourceFactoryConfig"], optional: true },
  { keys: [undefined], models: ["s1_eternum-BuildingCategoryConfig"], optional: true },
  { keys: [undefined], models: ["s1_eternum-StructureLevelConfig"], optional: true },
  { keys: [undefined], models: ["s1_eternum-QuestLevels"], optional: true },
  { keys: [undefined], models: ["s1_eternum-MMRGameMeta"], optional: true },
  { keys: [undefined, undefined], models: ["s1_eternum-ResourceList"], optional: true },
  { keys: [undefined], models: ["s1_eternum-HyperstrtConstructConfig"], optional: true },
  { keys: [undefined], models: ["s1_eternum-ResourceBridgeWtlConfig"], optional: true },
  { keys: [undefined], models: ["s1_eternum-SeasonPrize"], optional: true },
  { keys: [undefined], models: ["s1_eternum-SeasonEnded"], optional: true },
  { keys: [undefined], models: ["s1_eternum-AddressName"], optional: true },
  { keys: [undefined], models: ["s1_eternum-PlayerRegisteredPoints"], optional: true },
  { keys: [undefined], models: ["s1_eternum-BlitzSettlement"], optional: true },
  { keys: [undefined], models: ["s1_eternum-BlitzRealmPlayerRegister"], optional: true },
  { keys: [undefined], models: ["s1_eternum-BlitzEntryTokenRegister"], optional: true },
  { keys: [undefined], models: ["s1_eternum-BlitzRealmSettleFinish"], optional: true },
  { keys: [undefined], models: ["s1_eternum-PlayersRankTrial"], optional: true },
  { keys: [undefined], models: ["s1_eternum-PlayersRankFinal"], optional: true },
  { keys: [undefined, undefined], models: ["s1_eternum-PlayerRank"], optional: true },
  { keys: [undefined, undefined], models: ["s1_eternum-RankPrize"], optional: true },
];

const fetchConfigModelGroup = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  group: ConfigModelGroup,
) => {
  const query = {
    Keys: {
      keys: group.keys,
      pattern_matching: "FixedLen" as PatternMatching,
      models: group.models,
    },
  };

  try {
    return await getEntities(client, query, components, [], group.models, EVENT_QUERY_LIMIT, false);
  } catch (error) {
    if (!group.optional || !isIgnorableOptionalStructureSyncError(error)) {
      console.warn("[torii] Required config model sync failed", {
        error,
        models: group.models,
      });
      throw error;
    }

    console.warn("[torii] Skipping optional config model sync for unsupported schema", {
      error,
      models: group.models,
    });
    return [];
  }
};

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
      MemberClause("s1_eternum-TileOpt", "col", "Eq", pos.col),
      MemberClause("s1_eternum-TileOpt", "row", "Eq", pos.row),
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
    ["s1_eternum-TileOpt"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getStructuresDataFromTorii = async (
  client: ToriiClient,
  components: Component<Schema, Metadata, undefined>[],
  structures: { entityId: ID; position: HexPosition }[],
  onComplete?: () => void,
) => {
  const structuresToSync = structures.filter((structure) => {
    const valid = isValidId(structure.entityId) && hasValidPosition(structure.position);

    if (!valid && import.meta.env.DEV) {
      console.warn("[torii] Skipping structure sync for invalid payload", structure);
    }

    return valid;
  });

  if (structuresToSync.length === 0) {
    if (import.meta.env.DEV) {
      console.warn("[torii] No valid structures to sync", structures);
    }
    onComplete?.();
    return;
  }

  const runOnComplete = onComplete
    ? (() => {
        let completedQueries = 0;
        return () => {
          completedQueries += 1;
          if (completedQueries >= 3) {
            onComplete();
          }
        };
      })()
    : undefined;

  // Create promises for all queries without awaiting them
  const structuresPromise = syncStructureEntityModels(
    client,
    components as any,
    structuresToSync.map((structure) => structure.entityId),
  ).finally(runOnComplete);

  const armiesPromise = debouncedGetOwnedArmiesFromTorii(
    client,
    components as any,
    structuresToSync.map((structure) => structure.entityId),
    runOnComplete,
  );

  const buildingsPromise = debouncedGetBuildingsFromTorii(
    client,
    components as any,
    structuresToSync.map((structure) => structure.position),
    runOnComplete,
  );

  // Execute all promises in parallel
  return Promise.all([structuresPromise, armiesPromise, buildingsPromise]);
};

// For own structures, usePlayerStructureSync keeps data fresh so we only fetch if missing.
// For non-owned structures, always re-fetch since no subscription covers them and data may be stale.
export const ensureStructureSynced = async (
  components: { Structure?: Component<any, any, any> },
  toriiClient: ToriiClient,
  contractComponents: Component<Schema, Metadata, undefined>[],
  structureEntityId: ID,
  position: { col: number; row: number },
  accountAddress?: string,
): Promise<void> => {
  if (!components?.Structure || !toriiClient || !contractComponents) {
    return;
  }

  const entityKey = getEntityIdFromKeys([BigInt(structureEntityId)]);

  const existing = getComponentValue(components.Structure, entityKey);
  if (existing && accountAddress) {
    if (BigInt(existing.owner) === BigInt(accountAddress)) {
      return;
    }
  }

  const numericId = Number(structureEntityId);
  if (!Number.isFinite(numericId) || !Number.isFinite(position.col) || !Number.isFinite(position.row)) {
    return;
  }

  await getStructuresDataFromTorii(toriiClient, contractComponents, [{ entityId: numericId, position }]);
};

export const getConfigFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const fetchConfig = async () => {
    const configGroups = [...CORE_CONFIG_MODEL_GROUPS, ...OPTIONAL_CONFIG_MODEL_GROUPS];
    const groupResults = await Promise.all(
      configGroups.map((group) => fetchConfigModelGroup(client, components, group)),
    );
    return groupResults.flat();
  };

  // Per issue #4653: config data is static within a chain/world deployment and
  // most config models are also covered by GLOBAL_STREAM_CLAUSE's initial state
  // flush. On reloads within the same tab session, skip blocking on the fetch —
  // fire it in the background so RECS still revalidates. Clear the marker on
  // failure so the next boot falls back to a blocking fetch.
  if (hasFreshConfigCache()) {
    fetchConfig().catch((error) => {
      console.warn("[torii] Background config revalidation failed", error);
      clearConfigFetchCache();
    });
    return;
  }

  const result = await fetchConfig();
  markConfigCacheFresh();
  return result;
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
  hyperstructureIds: ID[],
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const validIds = hyperstructureIds.filter((id) => {
    const valid = isValidId(id);

    if (!valid && import.meta.env.DEV) {
      console.warn("[torii] Skipping hyperstructure sync for invalid id", id);
    }

    return valid;
  });

  if (validIds.length === 0) {
    if (import.meta.env.DEV) {
      console.warn("[torii] No valid hyperstructure ids to sync", hyperstructureIds);
    }
    return;
  }

  const structureQuery = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: validIds.map((id) => ({
        Keys: {
          keys: [id.toString()],
          pattern_matching: "FixedLen" as PatternMatching,
          models: ["s1_eternum-Structure"],
        },
      })),
    },
  };

  const structurePromise = getEntities(
    client,
    structureQuery,
    components as any,
    [],
    ["s1_eternum-Structure"],
    EVENT_QUERY_LIMIT,
    false,
  );

  const hyperstructureQuery = {
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
  ];

  const hyperstructurePromise = getEntities(
    client,
    hyperstructureQuery,
    components as any,
    [],
    hyperstructureModels,
    EVENT_QUERY_LIMIT,
    false,
  );

  return Promise.all([hyperstructurePromise, structurePromise]);
};

export const getEntitiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityIDs: ID[],
  entityModels: string[],
) => {
  const validEntityIDs = entityIDs.filter((id) => {
    const valid = isValidId(id);

    if (!valid && import.meta.env.DEV) {
      console.warn("[torii] Skipping entity sync for invalid id", id);
    }

    return valid;
  });

  if (validEntityIDs.length === 0) {
    if (import.meta.env.DEV) {
      console.warn("[torii] No valid entity ids to sync", entityIDs);
    }
    return;
  }

  const query =
    validEntityIDs.length === 1
      ? {
          Keys: {
            keys: [validEntityIDs[0].toString()],
            pattern_matching: "VariableLen" as PatternMatching,
            models: [],
          },
        }
      : {
          Composite: {
            operator: "Or" as LogicalOperator,
            clauses: [
              ...validEntityIDs.map((id) => ({
                Keys: {
                  keys: [id.toString()],
                  pattern_matching: "VariableLen" as PatternMatching,
                  models: [],
                },
              })),
            ],
          },
        };

  return getEntities(client, query, components as any, [], entityModels, 40_000, false);
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

const getMapFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  startCol: number,
  startRow: number,
  range: number,
) => {
  return getEntities(
    client,
    AndComposeClause([
      MemberClause("s1_eternum-TileOpt", "col", "Gte", startCol - range),
      MemberClause("s1_eternum-TileOpt", "col", "Lte", startCol + range),
      MemberClause("s1_eternum-TileOpt", "row", "Gte", startRow - range),
      MemberClause("s1_eternum-TileOpt", "row", "Lte", startRow + range),
    ]).build(),
    components as any,
    [],
    ["s1_eternum-TileOpt"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getMapFromToriiExact = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  minCol: number,
  maxCol: number,
  minRow: number,
  maxRow: number,
  alt = false,
) => {
  return getEntities(
    client,
    AndComposeClause([
      MemberClause("s1_eternum-TileOpt", "alt", "Eq", alt),
      MemberClause("s1_eternum-TileOpt", "col", "Gte", minCol),
      MemberClause("s1_eternum-TileOpt", "col", "Lte", maxCol),
      MemberClause("s1_eternum-TileOpt", "row", "Gte", minRow),
      MemberClause("s1_eternum-TileOpt", "row", "Lte", maxRow),
    ]).build(),
    components as any,
    [],
    ["s1_eternum-TileOpt"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getExplorerTroopsFromToriiExact = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  minCol: number,
  maxCol: number,
  minRow: number,
  maxRow: number,
  alt = false,
) => {
  return getEntities(
    client,
    AndComposeClause([
      MemberClause("s1_eternum-ExplorerTroops", "coord.alt", "Eq", alt),
      MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Gte", minCol),
      MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Lte", maxCol),
      MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Gte", minRow),
      MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Lte", maxRow),
    ]).build(),
    components as any,
    [],
    ["s1_eternum-ExplorerTroops"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getStructuresFromToriiExact = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  minCol: number,
  maxCol: number,
  minRow: number,
  maxRow: number,
) => {
  const structureBoundsClause = AndComposeClause([
    MemberClause("s1_eternum-Structure", "base.coord_x", "Gte", minCol),
    MemberClause("s1_eternum-Structure", "base.coord_x", "Lte", maxCol),
    MemberClause("s1_eternum-Structure", "base.coord_y", "Gte", minRow),
    MemberClause("s1_eternum-Structure", "base.coord_y", "Lte", maxRow),
  ]).build();

  const structureBuildingsBoundsClause = AndComposeClause([
    MemberClause("s1_eternum-StructureBuildings", "coord.x", "Gte", minCol),
    MemberClause("s1_eternum-StructureBuildings", "coord.x", "Lte", maxCol),
    MemberClause("s1_eternum-StructureBuildings", "coord.y", "Gte", minRow),
    MemberClause("s1_eternum-StructureBuildings", "coord.y", "Lte", maxRow),
  ]).build();

  return getEntities(
    client,
    {
      Composite: {
        operator: "Or" as LogicalOperator,
        clauses: [structureBoundsClause, structureBuildingsBoundsClause],
      },
    },
    components as any,
    [],
    ["s1_eternum-Structure", "s1_eternum-StructureBuildings"],
    EVENT_QUERY_LIMIT,
    false,
  );
};

export const getQuestsFromTorii = async (client: ToriiClient, components: Component<Schema, Metadata, undefined>[]) => {
  const query = {
    Keys: {
      keys: [undefined, undefined],
      pattern_matching: "VariableLen" as PatternMatching,
      models: ["s1_eternum-Quest"],
    },
  };

  return getEntities(client, query, components as any, [], ["s1_eternum-Quest"], EVENT_QUERY_LIMIT, false);
};
