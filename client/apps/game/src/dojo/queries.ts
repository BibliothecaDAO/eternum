// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { LogicalOperator } from "@dojoengine/torii-wasm";
// on hexception -> fetch below queries based on entityID

export const getTwoKeyModelbyRealmEntityIdFromTorii = async <S extends Schema>(
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
              models: ["s1_eternum-BuildingQuantityv2"],
            },
          })),
        ],
      },
    },
    components,
    [],
    ["s1_eternum-BuildingQuantityv2"],
    20_000,
  );
};

export const getOneKeyModelbyRealmEntityIdFromTorii = async <S extends Schema>(
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
              models: [],
            },
          })),
        ],
      },
    },
    components,
    [],
    ["s1_eternum-ArrivalTime", "s1_eternum-OwnedResourcesTracker"],
    20_000,
  );
};

export const getEntitiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityIDs: string[],
  entityModels: string[],
  positions?: { x: number; y: number }[],
) => {
  const query =
    !positions && entityIDs.length === 1
      ? {
          Keys: {
            keys: [entityIDs[0]],
            pattern_matching: "VariableLen" as PatternMatching,
            models: [],
          },
        }
      : {
          Composite: {
            operator: "Or" as LogicalOperator,
            clauses: [
              ...entityIDs.map((id) => ({
                Keys: {
                  keys: [id],
                  pattern_matching: "VariableLen" as PatternMatching,
                  models: [],
                },
              })),
              ...(positions
                ? positions.map((position) => ({
                    Keys: {
                      keys: [String(position?.x || 0), String(position?.y || 0), undefined, undefined],
                      pattern_matching: "FixedLen" as PatternMatching,
                      models: [],
                    },
                  }))
                : []),
            ],
          },
        };
  await getEntities(client, query, components as any, [], entityModels, 40_000);
};

export const getMarketFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
) => {
  let start = performance.now();
  const resourcePromise = await getEntities(
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
    ["s1_eternum-DetachedResource"],
    30_000,
    false,
  );
  let end = performance.now();
  console.log("[keys] detached resource query", end - start);

  start = performance.now();
  const marketPromise = await getEntities(
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
    ["s1_eternum-Market", "s1_eternum-Liquidity"],
    30_000,
    false,
  );
  await Promise.all([resourcePromise, marketPromise]);
  end = performance.now();
  console.log("[keys] market query", end - start);
};

export const addDonkeysAndArmiesSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityIds: number[],
) => {
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
};
