// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";

// on hexception -> fetch below queries based on entityID

// background sync after load ->

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
    [],
    [],
    30_000,
  );
};

export const addToSubscriptionTwoKeyModelbyRealmEntityId = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
) => {
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
    [],
    [],
    30_000,
  );
};

export const addToSubscriptionOneKeyModelbyRealmEntityId = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
) => {
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
              models: ["s0_eternum-ArrivalTime", "s0_eternum-OwnedResourcesTracker"],
            },
          })),
        ],
      },
    },
    components,
    [],
    [],
    30_000,
  );
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
    components as any,
    [],
    [],
    30_000,
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
    [],
    [],
    30_000,
    false,
  );
  const end = performance.now();
  console.log("MarketEnd", end - start);
};
