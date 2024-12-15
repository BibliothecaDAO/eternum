// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities } from "@dojoengine/state";
import { EntityKeysClause, PatternMatching, ToriiClient } from "@dojoengine/torii-client";

export const syncByPosition = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  position: { x: number; y: number },
  db: IDBDatabase,
) => {
  const positionClause: EntityKeysClause = {
    Keys: {
      keys: [String(position.x), String(position.y), undefined, undefined],
      pattern_matching: "FixedLen" as PatternMatching,
      models: [],
    },
  };

  await getEntities(
    client,
    {
      ...positionClause,
    },
    components,
    [],
    [],
    10_000,
    false,
    { dbConnection: db, timestampCacheKey: `position_${position.x}_${position.y}_query` },
  );
};

export const syncByEntityId = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityId: string,
  db: IDBDatabase,
) => {
  await getEntities(
    client,
    {
      Keys: {
        keys: [entityId],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
    components,
    [],
    [],
    30_000,
    false,
    { dbConnection: db, timestampCacheKey: `entity_${entityId}_query` },
  );
};

export const syncStructure = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string,
  position: { x: number; y: number },
  db: IDBDatabase,
) => {
  await syncByPosition(client, components, position, db);
  await syncByEntityId(client, components, entityID, db);
};

export const syncMarket = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  db: IDBDatabase,
) => {
  await getEntities(
    client,
    {
      Keys: {
        keys: [undefined, undefined],
        pattern_matching: "FixedLen",
        models: ["s0_eternum-DetachedResource"],
      },
    },
    components as any,
    [],
    ["s0_eternum-DetachedResource"],
    30_000,
    false,
    { dbConnection: db, timestampCacheKey: "market_query" },
  );
};
