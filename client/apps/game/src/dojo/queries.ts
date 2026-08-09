// onload -> fetch single key entities

import { HexPosition, ID, StructureType } from "@bibliothecadao/types";
import { Component, Metadata, Schema, getComponentValue } from "@dojoengine/recs";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { getEntities, setEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { Clause, LogicalOperator } from "@dojoengine/torii-wasm";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { env } from "../../env";
import {
  debouncedGetBuildingsFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetOwnedArmiesFromTorii,
} from "./debounced-queries";
import { gameIdKey, gameModel, getScopedGameId, isGameScoped } from "./game-scope";
import { EVENT_QUERY_LIMIT } from "./sync";

const CONFIG_FETCH_CACHE_PREFIX = "eternum:config-fetched";

const getConfigCacheKey = () =>
  `${CONFIG_FETCH_CACHE_PREFIX}:${env.VITE_PUBLIC_CHAIN}:${env.VITE_PUBLIC_TORII}:${getScopedGameId()}`;

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

export const getTilesForPositionsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  positions: HexPosition[],
) => {
  if (positions.length === 0) {
    return Promise.resolve([]);
  }

  const tileModel = gameModel("TileOpt") as `${string}-${string}`;
  const tileClauses = positions.map((pos) =>
    AndComposeClause([
      MemberClause(tileModel, "col", "Eq", pos.col),
      MemberClause(tileModel, "row", "Eq", pos.row),
      ...(isGameScoped() ? [MemberClause(tileModel, "game_id", "Eq", getScopedGameId())] : []),
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
    [tileModel],
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

  const playerStructuresModels = [
    gameModel("Structure"),
    gameModel("Resource"),
    // no villages on the s2 blitz world — never reference the model there
    ...(isGameScoped() ? [] : [gameModel("VillageTroop")]),
    gameModel("StructureBuildings"),
    gameModel("ResourceArrival"),
    gameModel("ProductionBoostBonus"),
    // needed to check for hyperstructure shareholders 100% in blitz mode
    gameModel("HyperstructureShareholders"),
    gameModel("Hyperstructure"),
  ];

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
  const structuresPromise = debouncedGetEntitiesFromTorii(
    client,
    components as any,
    structuresToSync.map((structure) => structure.entityId),
    playerStructuresModels,
    runOnComplete,
  );

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
  onBackgroundRefresh?: () => void,
) => {
  let configModels: string[];
  let configClauses: Clause[];

  if (isGameScoped()) {
    // s2 single world: per-game rows take the active game id as key[0]; the
    // rulebook (preset tables) and chain singletons are keyed without it.
    const gameScopedModels = [
      "WorldConfig",
      "HyperstructureGlobals",
      "SeasonPrize",
      "PlayerRegisteredPoints",
      "BlitzSettlement",
      "BlitzEntryTokenRegister",
      "PlayersRankTrial",
      "MMRGameMeta",
      "PlayerRank",
      "RankPrize",
      "GameRegistry",
    ].map(gameModel);
    const chainGlobalModels = [
      "HyperstrtConstructConfig",
      "WeightConfig",
      "ResourceFactoryConfig",
      "BuildingCategoryConfig",
      "ResourceBridgeWtlConfig",
      "StructureLevelConfig",
      "AddressName",
      "ResourceList",
      "ChainConfig",
      "PresetConfig",
    ].map(gameModel);

    configModels = [...gameScopedModels, ...chainGlobalModels];
    configClauses = [
      {
        Keys: {
          keys: [gameIdKey()],
          pattern_matching: "VariableLen",
          models: gameScopedModels,
        },
      },
      {
        Keys: {
          keys: [undefined],
          pattern_matching: "VariableLen",
          models: chainGlobalModels,
        },
      },
    ];
  } else {
    const oneKeyConfigModels = [
      "WorldConfig",
      "HyperstrtConstructConfig",
      "HyperstructureGlobals",
      "WeightConfig",
      "ResourceFactoryConfig",
      "BuildingCategoryConfig",
      "ResourceBridgeWtlConfig",
      "StructureLevelConfig",
      "SeasonPrize",
      "SeasonEnded",
      "QuestLevels",
      "AddressName",
      "PlayerRegisteredPoints",
      "BlitzSettlement",
      "BlitzEntryTokenRegister",
      // Blitz prize models (single key)
      "PlayersRankTrial",
      "PlayersRankFinal",
      "MMRGameMeta",
    ].map(gameModel);

    const twoKeyConfigModels = [
      "ResourceList",
      // Blitz prize models (two keys)
      "PlayerRank",
      "RankPrize",
    ].map(gameModel);

    configModels = [...oneKeyConfigModels, ...twoKeyConfigModels];
    configClauses = [
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
  }

  // NOT @dojoengine/state's getEntities: that helper fires its RECS writes
  // without awaiting them, so its promise resolves before any entity lands
  // (verified live: 0 config entities at resolve time, all present seconds
  // later). configManager snapshots RECS immediately after this fetch, so the
  // writes must be awaited — page manually and await setEntities per page.
  const fetchConfig = async () => {
    let cursor: string | undefined;
    for (;;) {
      const page = await client.getEntities({
        pagination: { limit: EVENT_QUERY_LIMIT, cursor, direction: "Forward", order_by: [] },
        clause: { Composite: { operator: "Or", clauses: configClauses } },
        no_hashed_keys: false,
        models: configModels,
        historical: false,
      });
      await setEntities(page.items, components, false);
      const count = Array.isArray(page.items) ? page.items.length : Object.keys(page.items ?? {}).length;
      if (count < EVENT_QUERY_LIMIT || !page.next_cursor) break;
      cursor = page.next_cursor;
    }
  };

  // Per issue #4653: config data is static within a chain/world deployment and
  // most config models are also covered by GLOBAL_STREAM_CLAUSE's initial state
  // flush. On reloads within the same tab session, skip blocking on the fetch —
  // fire it in the background so RECS still revalidates. Clear the marker on
  // failure so the next boot falls back to a blocking fetch.
  //
  // configManager snapshots RECS once at setDojo time, so when this fast path
  // wins the race against the background fetch the cost tables are built from
  // empty state ("No construction cost is configured"). onBackgroundRefresh
  // lets the caller re-run that snapshot once the config entities land.
  if (hasFreshConfigCache()) {
    fetchConfig()
      // One retry: a transient failure here would otherwise leave the whole
      // session without building/upgrade costs.
      .catch(() => fetchConfig())
      .then(() => onBackgroundRefresh?.())
      .catch((error) => {
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
  // AddressName is player identity — chain-global on both arms (1 key).
  const models = [gameModel("AddressName")];
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
  const singleKeyModels = [gameModel("Guild"), gameModel("GuildMember")];
  const twoKeyModels = [gameModel("GuildWhitelist")];
  const models = [...singleKeyModels, ...twoKeyModels];

  // Guild identity is per-game on s2: one game-prefixed clause covers every arity.
  const query = isGameScoped()
    ? {
        Keys: {
          keys: [gameIdKey()],
          pattern_matching: "VariableLen" as PatternMatching,
          models,
        },
      }
    : {
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

  const structureModel = gameModel("Structure");
  const structureQuery = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: validIds.map((id) => ({
        Keys: {
          // s2 Structure is keyed (game_id, entity_id)
          keys: isGameScoped() ? [gameIdKey(), id.toString()] : [id.toString()],
          pattern_matching: "FixedLen" as PatternMatching,
          models: [structureModel],
        },
      })),
    },
  };

  const structurePromise = getEntities(
    client,
    structureQuery,
    components as any,
    [],
    [structureModel],
    EVENT_QUERY_LIMIT,
    false,
  );

  const hyperstructureModels = [
    "HyperstructureGlobals",
    "Hyperstructure",
    "HyperstructureShareholders",
    "HyperstructureRequirements",
    "PlayerRegisteredPoints",
  ].map(gameModel);

  // On s2 every hyperstructure model is game-prefixed, so one VariableLen
  // clause replaces the legacy per-arity fanout.
  const hyperstructureQuery = isGameScoped()
    ? {
        Keys: {
          keys: [gameIdKey()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: hyperstructureModels,
        },
      }
    : {
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

  // s2 per-game models key entities as (game_id, entity_id, ...).
  const entityKeys = (id: ID): string[] => (isGameScoped() ? [gameIdKey(), id.toString()] : [id.toString()]);

  const query =
    validEntityIDs.length === 1
      ? {
          Keys: {
            keys: entityKeys(validEntityIDs[0]),
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
                  keys: entityKeys(id),
                  pattern_matching: "VariableLen" as PatternMatching,
                  models: [],
                },
              })),
            ],
          },
        };

  return getEntities(client, query, components as any, [], entityModels, 40_000, false);
};

// Market/Liquidity/Trade are s1-only models (no AMM on the s2 blitz world) —
// this is a legacy-arm query and keeps its literal names.
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
  const structureModel = gameModel("Structure") as `${string}-${string}`;
  const clause = isGameScoped()
    ? AndComposeClause([
        MemberClause(structureModel, "category", "Eq", StructureType.Bank),
        MemberClause(structureModel, "game_id", "Eq", getScopedGameId()),
      ]).build()
    : MemberClause(structureModel, "category", "Eq", StructureType.Bank).build();

  return getEntities(client, clause, components, [], [structureModel], EVENT_QUERY_LIMIT, false);
};

export const getOwnedArmiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  owners: number[],
) => {
  const explorerModel = gameModel("ExplorerTroops");
  const ownersClause: Clause = {
    Composite: {
      operator: "Or",
      clauses: owners.map((owner) => ({
        Member: {
          model: explorerModel,
          member: "owner",
          operator: "Eq",
          value: { Primitive: { U32: owner } },
        },
      })),
    },
  };
  const clause: Clause = isGameScoped()
    ? {
        Composite: {
          operator: "And",
          clauses: [
            {
              Member: {
                model: explorerModel,
                member: "game_id",
                operator: "Eq",
                value: { Primitive: { U32: getScopedGameId() } },
              },
            },
            ownersClause,
          ],
        },
      }
    : ownersClause;

  return getEntities(client, clause, components, [], [explorerModel, gameModel("Resource")], EVENT_QUERY_LIMIT, false);
};

export const getBuildingsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  structurePositions: HexPosition[],
) => {
  const buildingModel = gameModel("Building");
  const query = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: structurePositions.map((position) => ({
        Keys: {
          // s2 Building is keyed (game_id, alt, outer_col, outer_row, ...) —
          // the alt slot stays a wildcard.
          keys: isGameScoped()
            ? [gameIdKey(), undefined, position.col.toString(), position.row.toString()]
            : [position.col.toString(), position.row.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: [buildingModel],
        },
      })),
    },
  };

  return getEntities(client, query, components as any, [], [buildingModel], EVENT_QUERY_LIMIT, false);
};

const getMapFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  startCol: number,
  startRow: number,
  range: number,
) => {
  const tileModel = gameModel("TileOpt") as `${string}-${string}`;
  return getEntities(
    client,
    AndComposeClause([
      MemberClause(tileModel, "col", "Gte", startCol - range),
      MemberClause(tileModel, "col", "Lte", startCol + range),
      MemberClause(tileModel, "row", "Gte", startRow - range),
      MemberClause(tileModel, "row", "Lte", startRow + range),
      ...(isGameScoped() ? [MemberClause(tileModel, "game_id", "Eq", getScopedGameId())] : []),
    ]).build(),
    components as any,
    [],
    [tileModel],
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
) => {
  const tileModel = gameModel("TileOpt") as `${string}-${string}`;
  return getEntities(
    client,
    AndComposeClause([
      MemberClause(tileModel, "col", "Gte", minCol),
      MemberClause(tileModel, "col", "Lte", maxCol),
      MemberClause(tileModel, "row", "Gte", minRow),
      MemberClause(tileModel, "row", "Lte", maxRow),
      ...(isGameScoped() ? [MemberClause(tileModel, "game_id", "Eq", getScopedGameId())] : []),
    ]).build(),
    components as any,
    [],
    [tileModel],
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
  const structureModel = gameModel("Structure") as `${string}-${string}`;
  const structureBuildingsModel = gameModel("StructureBuildings") as `${string}-${string}`;

  const structureBoundsClause = AndComposeClause([
    MemberClause(structureModel, "base.coord_x", "Gte", minCol),
    MemberClause(structureModel, "base.coord_x", "Lte", maxCol),
    MemberClause(structureModel, "base.coord_y", "Gte", minRow),
    MemberClause(structureModel, "base.coord_y", "Lte", maxRow),
    ...(isGameScoped() ? [MemberClause(structureModel, "game_id", "Eq", getScopedGameId())] : []),
  ]).build();

  const structureBuildingsBoundsClause = AndComposeClause([
    MemberClause(structureBuildingsModel, "coord.x", "Gte", minCol),
    MemberClause(structureBuildingsModel, "coord.x", "Lte", maxCol),
    MemberClause(structureBuildingsModel, "coord.y", "Gte", minRow),
    MemberClause(structureBuildingsModel, "coord.y", "Lte", maxRow),
    ...(isGameScoped() ? [MemberClause(structureBuildingsModel, "game_id", "Eq", getScopedGameId())] : []),
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
    [structureModel, structureBuildingsModel],
    EVENT_QUERY_LIMIT,
    false,
  );
};

// Quest is an s1-only model (quests are off on the s2 blitz world) — this is a
// legacy-arm query and keeps its literal names.
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
