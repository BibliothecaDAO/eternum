import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { Clause, PatternMatching, ToriiClient } from "@dojoengine/torii-client";

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
  let retries = 0;
  const maxRetries = 3;

  while (continueFetching) {
    try {
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

      // Reset retries on successful request
      retries = 0;
    } catch (error) {
      console.error(`Error fetching entities: ${error}`);
      retries++;

      if (retries >= maxRetries) {
        throw new Error(`Failed to fetch entities after ${maxRetries} retries`);
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 1000));

      // Continue the loop to retry
      continue;
    }
  }
};

export const addToSubscription = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
  position?: { x: number; y: number }[],
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
    30_000,
    false,
  );
};
