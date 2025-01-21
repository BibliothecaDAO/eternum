// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";

// on hexception -> fetch below queries based on entityID

// background sync after load ->
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
              models: ["s1_eternum-ArrivalTime", "s1_eternum-OwnedResourcesTracker"],
            },
          })),
        ],
      },
    },
    components,
    [],
    [],
    5_000,
  );
};

export const addToSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
  position?: { x: number; y: number }[],
) => {
  const start = performance.now();

  console.log("AddToSubscriptionStart", entityID);
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
    5_000,
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
      Member: {
        model: "s1_eternum-DetachedResource",
        member: "resource_amount",
        operator: "Gt",
        value: { Primitive: { U128: "0" } },
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

export const addHyperstructureSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  const start = performance.now();
  await getEntities(
    client,
    {
      Composite: {
        operator: "Or",
        clauses: [
          {
            Keys: {
              keys: [undefined, undefined],
              pattern_matching: "FixedLen",
              models: ["s1_eternum-Epoch", "s1_eternum-Progress"],
            },
          },
          {
            Keys: {
              keys: [undefined, undefined, undefined],
              pattern_matching: "FixedLen",
              models: ["s1_eternum-Contribution"],
            },
          },
        ],
      },
    },
    components as any,
    [],
    [],
    40_000,
    false,
  );
  const end = performance.now();
  console.log("HyperstructureEnd", end - start);
};

export const addDonkeysAndArmiesSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityIds: number[],
) => {
  const start = performance.now();
  console.log("ArrivalsEnd: starting resource arrivals");
  await getEntities(
    client,
    {
      Composite: {
        operator: "Or",
        clauses: entityIds.map((id) => ({
          Member: {
            model: "s1_eternum-EntityOwner",
            member: "entity_owner_id",
            operator: "Eq",
            value: { Primitive: { U32: id } },
          },
        })),
      },
    },

    components,
    [],
    [
      "s1_eternum-Army",
      "s1_eternum-Position",
      "s1_eternum-Health",
      "s1_eternum-EntityOwner",
      "s1_eternum-Protectee",
      "s1_eternum-Stamina",
      "s1_eternum-Weight",
      "s1_eternum-OwnedResourcesTracker",
      "s1_eternum-ArrivalTime",
      "s1_eternum-Quantity",
    ],
    1000,
    false,
  );
  const end = performance.now();
  console.log("ArrivalsEnd", end - start);
};
