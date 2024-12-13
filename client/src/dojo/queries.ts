// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, PatternMatching, ToriiClient } from "@dojoengine/torii-client";

// on hexception -> fetch below queries based on entityID

// background sync after load ->

export const getEntities = async <S extends Schema>(
  client: ToriiClient,
  clause: Clause | undefined,
  components: Component<S, Metadata, undefined>[],
  limit: number = 100,
  logging: boolean = false,
) => {
  if (logging) console.log("Starting getEntities");
  let offset = 0;
  let continueFetching = true;

  while (continueFetching) {
    const entities = await client.getEntities({
      limit,
      offset,
      clause,
      dont_include_hashed_keys: false,
      order_by: [],
    });

    setEntities(entities, components);

    if (Object.keys(entities).length < limit) {
      continueFetching = false;
    } else {
      offset += limit;
    }
  }
};

export const syncEntitiesEternum = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityKeyClause: EntityKeysClause[],
  logging: boolean = false,
) => {
  // if (logging) console.log("Starting syncEntities");
  return await client.onEntityUpdated(entityKeyClause, (fetchedEntities: any, data: any) => {
    // if (logging) console.log("Entity updated", fetchedEntities);

    setEntities({ [fetchedEntities]: data }, components);
  });
};

export const addToSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string,
  position?: { x: number; y: number },
) => {
  const positionClause: EntityKeysClause = {
    Keys: {
      keys: [String(position?.x || 0), String(position?.y || 0), undefined, undefined],
      pattern_matching: "FixedLen" as PatternMatching,
      models: [],
    },
  };

  position &&
    (await getEntities(
      client,
      {
        ...positionClause,
      },
      components,
      10_000,
      false,
    ));

  const cache = getCache();

  let time = cache ? cache : new Date().toISOString();

  // cache this
  // from then on only get future
  await getEntities(
    client,
    {
      Composite: {
        operator: "And",
        clauses: [
          {
            Keys: {
              keys: [entityID],
              pattern_matching: "VariableLen",
              models: [],
            },
          },
          {
            Member: {
              model: "s0_eternum-Realm",
              member: "internal_updated_at",
              operator: "Gte",
              value: { String: time },
            },
          },
        ],
      },
    },
    components,
    20_000,
    false,
  );

  console.log("cache", cache);

  setCache(time);
};

export const addMarketSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
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
    components,
    50_000,
    false,
  );
};

const setCache = (time: string) => {
  localStorage.setItem("eternum_cache", time);
};

const getCache = () => {
  return localStorage.getItem("eternum_cache");
};
