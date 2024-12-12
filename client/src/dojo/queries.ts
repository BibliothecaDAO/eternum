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

    // console.log("entities", entities);

    if (logging) console.log(`Fetched ${entities} entities`);

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
  // await getEntities(client, { ...(entityQueryOneKey(entityID) as Clause) }, components, 1000, false);

  // await getEntities(client, { ...(entityQueryTwoKey(entityID) as Clause) }, components, 1000, false);

  // await getEntities(client, { ...(entityQueryThreeKey(entityID) as Clause) }, components, 1000, false);

  const positionClause: EntityKeysClause = {
    Keys: {
      keys: [String(position?.x || 0), String(position?.y || 0), undefined, undefined],
      pattern_matching: "FixedLen" as PatternMatching,
      models: [],
    },
  };

  await getEntities(client, {
    Composite: {
      operator: "Or",
      clauses: [
        positionClause,
        {
          Keys: {
            keys: [entityID],
            pattern_matching: "FixedLen",
            models: []
          }
        },
        {
          Keys: {
            keys: [entityID, undefined], 
            pattern_matching: "FixedLen",
            models: []
          }
        },
        {
          Keys: {
            keys: [entityID, undefined, undefined],
            pattern_matching: "FixedLen", 
            models: []
          }
        }

      ]
    }
  }, components, 1000, false);

  //   const newSubscriptions = [
  //     { ...entityQueryOneKey(entityID) },
  //     { ...entityQueryTwoKey(entityID) },
  //     { ...entityQueryThreeKey(entityID) },
  //     { ...entityQueryFourKey(position?.x || 0, position?.y || 0) },
  //     positionClause,
  //     ...syncObject.clauses,
  //   ];

  //   try {
  //     await client.updateEntitySubscription(syncObject.sync, newSubscriptions);
  //   } catch (error) {
  //     console.log("error", error);
  //   }
  //   console.log("subscriptions succeeded");

  //   syncObject.clauses = newSubscriptions;
};

const entityQueryOneKey = (entityID: string) => {
  return {
    Keys: {
      keys: [entityID],
      pattern_matching: "FixedLen",
      models: [],
    },
  } as EntityKeysClause;
};

const entityQueryTwoKey = (entityID: string) => {
  return {
    Keys: {
      keys: [entityID, undefined],
      pattern_matching: "FixedLen",
      models: [],
    },
  } as EntityKeysClause;
};

const entityQueryThreeKey = (entityID: string) => {
  return {
    Keys: {
      keys: [entityID, undefined, undefined],
      pattern_matching: "FixedLen",
      models: [],
    },
  } as EntityKeysClause;
};

const entityQueryFourKey = (x: number, y: number) => {
  return {
    Keys: {
      keys: [String(x), String(y), undefined, undefined],
      pattern_matching: "FixedLen",
      models: [],
    },
  } as EntityKeysClause;
};
