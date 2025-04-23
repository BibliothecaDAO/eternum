// onload -> fetch single key entities

import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { LogicalOperator } from "@dojoengine/torii-wasm";

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
              // Gets the buildings inside the structure
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
        model: "s1_eternum-ResourceList",
        member: "amount",
        operator: "Gt",
        value: { Primitive: { U128: "0" } },
      },
    },
    components,
    [],
    ["s1_eternum-ResourceList"],
    30_000,
    false,
  );
  let end = performance.now();
  console.log("[sync] detached resource query", end - start);

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
    ["s1_eternum-Market", "s1_eternum-Liquidity", "s1_eternum-Trade"],
    30_000,
    false,
  );
  await Promise.all([resourcePromise, marketPromise]);
  end = performance.now();
  console.log("[sync] market query", end - start);
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
            model: "s1_eternum-ExplorerTroops",
            member: "owner",
            operator: "Eq",
            value: { Primitive: { U32: id } },
          },
        })),
      },
    },
    components,
    [],
    ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"],
    1000,
    false,
  );
};
