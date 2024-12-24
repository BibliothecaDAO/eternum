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
    5_000,
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
    5_000,
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
        model: "s0_eternum-DetachedResource",
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
              models: ["s0_eternum-Epoch", "s0_eternum-Progress"],
            },
          },
          {
            Keys: {
              keys: [undefined, undefined, undefined],
              pattern_matching: "FixedLen",
              models: ["s0_eternum-Contribution"],
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
            model: "s0_eternum-EntityOwner",
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
      "s0_eternum-Army",
      "s0_eternum-Position",
      "s0_eternum-Health",
      "s0_eternum-EntityOwner",
      "s0_eternum-Protectee",
      "s0_eternum-Stamina",
      "s0_eternum-Weight",
      "s0_eternum-OwnedResourcesTracker",
      "s0_eternum-ArrivalTime",
      "s0_eternum-Quantity",
    ],
    1000,
    false,
  );
  const end = performance.now();
  console.log("ArrivalsEnd", end - start);
};
