// onload -> fetch single key entities

import { HexPosition, ID, StructureType } from "@bibliothecadao/types";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { Clause, LogicalOperator } from "@dojoengine/torii-wasm";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { env } from "../../env";
import {
  debouncedGetBuildingsFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetOwnedArmiesFromTorii,
} from "./debounced-queries";
import { fetchEntitiesIntoGameSync } from "./gamewide-sync-adapter";
import { gameIdKey, gameModel, getScopedGameId, hexKey, isGameScoped } from "./game-scope";

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

// Integer guards double as hexKey's precondition: BigInt() throws on a
// fractional number, and one bad value must skip its own entity, not abort
// the whole batched clause.
const isValidId = (id: unknown): id is ID => typeof id === "number" && Number.isInteger(id) && id > 0;
const hasValidPosition = (position: HexPosition | undefined): position is HexPosition =>
  !!position && Number.isInteger(position.col) && Number.isInteger(position.row);

export const getStructuresDataFromTorii = async (
  client: ToriiClient,
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
    gameModel("VillageTroop"),
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
    structuresToSync.map((structure) => structure.entityId),
    playerStructuresModels,
    runOnComplete,
  );

  const armiesPromise = debouncedGetOwnedArmiesFromTorii(
    client,
    structuresToSync.map((structure) => structure.entityId),
    runOnComplete,
  );

  const buildingsPromise = debouncedGetBuildingsFromTorii(
    client,
    structuresToSync.map((structure) => structure.position),
    runOnComplete,
  );

  // Execute all promises in parallel
  return Promise.all([structuresPromise, armiesPromise, buildingsPromise]);
};

export const getConfigFromTorii = async (client: ToriiClient, onBackgroundRefresh?: () => void) => {
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
      "PlayersRankFinal",
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

  // Config must land through the runtime before configManager snapshots RECS.
  // This also keeps every in-session Torii query visible to provisional reconciliation.
  const fetchConfig = () =>
    fetchEntitiesIntoGameSync(client, { Composite: { operator: "Or", clauses: configClauses } }, configModels);

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

export const getAddressNamesFromTorii = async (client: ToriiClient) => {
  // AddressName is player identity — chain-global on both arms (1 key).
  const models = [gameModel("AddressName")];
  const query = {
    Keys: {
      keys: [undefined],
      pattern_matching: "FixedLen" as PatternMatching,
      models,
    },
  };

  return fetchEntitiesIntoGameSync(client, query, models);
};

export const getGuildsFromTorii = async (client: ToriiClient) => {
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

  return fetchEntitiesIntoGameSync(client, query, models);
};

export const getEntitiesFromTorii = async (client: ToriiClient, entityIDs: ID[], entityModels: string[]) => {
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

  // s2 per-game models key entities as (game_id, entity_id, ...). Keys must be
  // hex — a decimal id string matches nothing (see hexKey).
  const entityKeys = (id: ID): string[] => (isGameScoped() ? [gameIdKey(), hexKey(id)] : [hexKey(id)]);

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

  return fetchEntitiesIntoGameSync(client, query, entityModels);
};

// Market/Liquidity/Trade are game_id-keyed on s2 (W3): prefix the key clause
// with the active game on the scoped arm.
export const getMarketFromTorii = async (client: ToriiClient) => {
  const marketModels = [gameModel("Market"), gameModel("Liquidity"), gameModel("Trade")];
  return fetchEntitiesIntoGameSync(
    client,
    {
      Keys: {
        keys: isGameScoped() ? [gameIdKey()] : [undefined],
        pattern_matching: "VariableLen",
        models: marketModels,
      },
    },
    marketModels,
  );
};

export const getBankStructuresFromTorii = async (client: ToriiClient) => {
  const structureModel = gameModel("Structure") as `${string}-${string}`;
  const clause = isGameScoped()
    ? AndComposeClause([
        MemberClause(structureModel, "category", "Eq", StructureType.Bank),
        MemberClause(structureModel, "game_id", "Eq", getScopedGameId()),
      ]).build()
    : MemberClause(structureModel, "category", "Eq", StructureType.Bank).build();

  return fetchEntitiesIntoGameSync(client, clause, [structureModel]);
};

export const getOwnedArmiesFromTorii = async (client: ToriiClient, owners: number[]) => {
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

  return fetchEntitiesIntoGameSync(client, clause, [explorerModel, gameModel("Resource")]);
};

export const getBuildingsFromTorii = async (client: ToriiClient, structurePositions: HexPosition[]) => {
  const buildingModel = gameModel("Building");
  // One malformed position must not abort the whole batched clause (hexKey
  // throws on non-integers).
  const validPositions = structurePositions.filter(hasValidPosition);
  if (validPositions.length === 0) {
    return;
  }
  const query = {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: validPositions.map((position) => ({
        Keys: {
          // s2 Building is keyed (game_id, alt, outer_col, outer_row, ...) —
          // structures never sit on the alt plane (Cairo pins alt to false),
          // so match it exactly: a mid-pattern undefined wildcard does not
          // survive the grpc key encoding and matches nothing.
          keys: isGameScoped()
            ? [gameIdKey(), hexKey(0), hexKey(position.col), hexKey(position.row)]
            : [hexKey(position.col), hexKey(position.row)],
          pattern_matching: "VariableLen" as PatternMatching,
          models: [buildingModel],
        },
      })),
    },
  };

  return fetchEntitiesIntoGameSync(client, query, [buildingModel]);
};
