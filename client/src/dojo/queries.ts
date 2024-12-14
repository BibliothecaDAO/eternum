import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, PatternMatching, ToriiClient } from "@dojoengine/torii-client";

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

    console.log("entities", entities);

    setEntities(entities, components);

    if (Object.keys(entities).length < limit) {
      continueFetching = false;
    } else {
      offset += limit;
    }
  }
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
      30_000,
      false,
    ));

  await getEntities(
    client,
    {
      Keys: {
        keys: [entityID],
        pattern_matching: "VariableLen",
        models: [],
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
