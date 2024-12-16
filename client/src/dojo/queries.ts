// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { Clause, PatternMatching, ToriiClient } from "@dojoengine/torii-client";

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
    const start = performance.now();
    const entities = await client.getEntities({
      limit,
      offset,
      clause,
      dont_include_hashed_keys: false,
      order_by: [],
    });

    setEntities(entities, components);
    const end = performance.now();
    console.log("GetEntitiesEnd", end - start);

    if (Object.keys(entities).length < limit) {
      continueFetching = false;
    } else {
      offset += limit;
    }
  }
};

export const syncPosition = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string,
) => {
  await getEntities(
    client,
    {
      Keys: {
        keys: [entityID],
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s0_eternum-Position"],
      },
    },
    components,
    30_000,
    false,
  );
};
export const syncBuildingQty = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string,
) => {
  await getEntities(
    client,
    {
      Keys: {
        keys: [entityID, undefined],
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s0_eternum-BuildingQuantityv2"],
      },
    },
    components,
    30_000,
    false,
  );
};

export const addToSubscriptionBuildingQty = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
) => {
  const start = performance.now();
  await getEntities(
    client,
    {
      Composite: {
        operator: "Or",
        clauses: [
          ...entityID.map((id) => ({
            Keys: {
              keys: [id, undefined],
              pattern_matching: "VariableLen" as PatternMatching,
              models: ["s0_eternum-BuildingQuantityv2"],
            },
          })),
        ],
      },
    },
    components,
    30_000,
    false,
  );
  const end = performance.now();
  console.log("AddToSubscription Building qty", end - start);
};

export const addToSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
  position?: { x: number; y: number }[],
) => {
  const start = performance.now();
  await getEntities(
    client,
    {
      Composite: {
        operator: "Or",
        clauses: [
          ...entityID.map((id) => ({
            Keys: {
              keys: [id],
              pattern_matching: "VariableLen" as PatternMatching,
              models: [],
            },
          })),
          ...(position
            ? position.map((position) => ({
                Keys: {
                  keys: [String(position?.x || 0), String(position?.y || 0), undefined, undefined],
                  pattern_matching: "FixedLen" as PatternMatching,
                  models: [],
                },
              }))
            : []),
        ],
      },
    },
    components,
    30_000,
    false,
  );
  const end = performance.now();
  console.log("AddToSubscriptionEnd", end - start);
};

export const addMarketSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const start = performance.now();
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
    30_000,
    false,
  );
  const end = performance.now();
  console.log("MarketEnd", end - start);
};
