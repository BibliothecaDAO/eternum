// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, Subscription, ToriiClient } from "@dojoengine/torii-client";

// on hexception -> fetch below queries based on entityID

// background sync after load -> 

export const getEntities = async <S extends Schema>(
    client: ToriiClient,
    clause: Clause | undefined,
    components: Component<S, Metadata, undefined>[],
    limit: number = 100,
    logging: boolean = false
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
        });

        console.log("entities", entities);

        if (logging) console.log(`Fetched ${entities} entities`);

        setEntities(entities, components, logging);

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
    logging: boolean = true
) => {
    if (logging) console.log("Starting syncEntities");
    return await client.onEntityUpdated(
        entityKeyClause,
        (fetchedEntities: any, data: any) => {
            if (logging) console.log("Entity updated", fetchedEntities);

            setEntities({ [fetchedEntities]: data }, components, logging);
        }
    );
};

export const addToSubscription = async <S extends Schema>(client: ToriiClient, subscription: Subscription, components: Component<S, Metadata, undefined>[], entityID: string, position?: {x: number, y: number}) => {

    console.log("position", subscription);

    await getEntities(client, { ...entityQueryOneKey(entityID), Keys: { ...entityQueryOneKey(entityID).Keys, pattern_matching: "FixedLen" } }, components, 1000, false);
    
    await getEntities(client, { ...entityQueryTwoKey(entityID), Keys: { ...entityQueryTwoKey(entityID).Keys, pattern_matching: "FixedLen" } }, components, 1000, false);
    
    await getEntities(client, { ...entityQueryThreeKey(entityID), Keys: { ...entityQueryThreeKey(entityID).Keys, pattern_matching: "FixedLen" } }, components, 1000, false);

    
    await getEntities(client, {
        Keys: {
          keys: [String(position?.x || 0), String(position?.y || 0), undefined, undefined],
          pattern_matching: 'FixedLen',
          models: [
          ],
        },
    }, components, 1000, false);

    // await client.updateEntitySubscription(subscription, [
    //     { ...entityQueryOneKey(entityID), Keys: { ...entityQueryOneKey(entityID).Keys, pattern_matching: "FixedLen" } },
    // ]);

    // await client.updateEntitySubscription(subscription, [
    //     { ...entityQueryTwoKey(entityID), Keys: { ...entityQueryTwoKey(entityID).Keys, pattern_matching: "FixedLen" } },
    // ]);

    // await client.updateEntitySubscription(subscription, [
    //     { ...entityQueryThreeKey(entityID), Keys: { ...entityQueryThreeKey(entityID).Keys, pattern_matching: "FixedLen" } },
    // ]);

    try {
      await client.updateEntitySubscription(subscription, [
          { ...entityQueryOneKey(entityID), Keys: { ...entityQueryOneKey(entityID).Keys, pattern_matching: "FixedLen" } },
          { ...entityQueryTwoKey(entityID), Keys: { ...entityQueryTwoKey(entityID).Keys, pattern_matching: "FixedLen" } },
          { ...entityQueryThreeKey(entityID), Keys: { ...entityQueryThreeKey(entityID).Keys, pattern_matching: "FixedLen" } },
          {
              Keys: {
                keys: [String(position?.x || 0), String(position?.y || 0), undefined, undefined],
                pattern_matching: 'FixedLen',
                models: [
                ],
              },
            },
      ]); 
    } catch (error) {
      console.error("Error updating entity subscription:", error);
    }
}

const entityQueryOneKey = (entityID: string) => {
    return {
        Keys: {
          keys: [entityID],
          pattern_matching: 'FixedLen',
          models: [],
        },
      }
}

const entityQueryTwoKey = (entityID: string) => {
    return {
        Keys: {
          keys: [entityID, undefined],
          pattern_matching: 'FixedLen',
          models: [
          ],
        },
      }
}

const entityQueryThreeKey = (entityID: string) => {
    return {
        Keys: {
          keys: [entityID, undefined, undefined],
          pattern_matching: 'FixedLen',
          models: [
          ],
        },
      }
}

const entityQueryFourKey = ( x: number, y: number) => {
    return {
        Keys: {
          keys: [String(x), String(y), undefined, undefined],
          pattern_matching: 'FixedLen',
          models: [
          ],
        },
      }
}




