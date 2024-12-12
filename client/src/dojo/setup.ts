import { HYPERSTRUCTURE_CONFIG_ID } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities } from "@dojoengine/state";
import { Clause } from "@dojoengine/torii-client";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { ClientConfigManager } from "./modelManager/ConfigManager";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export const configManager = ClientConfigManager.instance();

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);

  const singleKeyQuery = {
    Keys: {
      keys: [undefined],
      pattern_matching: "FixedLen",
      models: ["s0_eternum-AddressName"],
    },
  };

  const twoKeyQuery = {
    Keys: {
      keys: ["763", undefined],
      pattern_matching: "FixedLen",
      models: [
        // 's0_eternum-Tile', - done
        // 's0_eternum-BuildingQuantityv2', - done with Realm
        // // 's0_eternum-Resource', - done with Realm
        // // 's0_eternum-Production',  - done with Realm
        // 's0_eternum-GuildWhitelist', - add to subscription from somewhere
        // 's0_eternum-Progress', - done
        // 's0_eternum-HyperstructureContribution', - done
        // 's0_eternum-Epoch', - done
        // // 's0_eternum-QuestBonus', - done
        // // "s0_eternum-Progress", - done
        // // "s0_eternum-Market",
        // 's0_eternum-Quest',
        // 's0_eternum-Position',
      ],
    },
  };

  const threeKeyQuery = {
    Keys: {
      keys: [undefined, undefined, undefined],
      pattern_matching: "FixedLen",
      models: ["s0_eternum-BuildingConfig", "s0_eternum-Liquidity"],
    },
  };

  const fourKeyQuery = {
    Keys: {
      keys: [undefined, undefined, undefined, undefined],
      pattern_matching: "FixedLen",
      models: ["s0_eternum-Building"],
    },
  };

  const clauses: Clause[] = [
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: ["s0_eternum-AddressName"],
      },
    },
    {
      Keys: {
        keys: [HYPERSTRUCTURE_CONFIG_ID.toString(), undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
  ];

  network.toriiClient
    .getEntities({
      limit: 4000,
      offset: 0,
      clause: {
        Composite: {
          operator: "Or",
          clauses: [
            {
              Keys: {
                keys: [undefined],
                pattern_matching: "FixedLen",
                models: ["s0_eternum-AddressName"],
              },
            },
          ],
        },
      },
      dont_include_hashed_keys: false,
      order_by: [],
    })
    .then((entities: any) => {
      console.log(entities);
    });
  // fetch all existing entities from torii
  const sync = await getSyncEntities(
    network.toriiClient,
    network.contractComponents as any,
    {
      Composite: {
        operator: "Or",
        clauses: [
          {
            Keys: {
              keys: [undefined],
              pattern_matching: "FixedLen",
              models: ["s0_eternum-AddressName"],
            },
          },
        ],
      },
    },
    [],
    40000,
    true,
  );

  const syncObject = {
    sync,
    clauses: [...clauses],
  };

  //   const eventSync = getSyncEvents(
  //     network.toriiClient,
  //     network.contractComponents.events as any,
  //     undefined,
  //     [],
  //     20_000,
  //     false,
  //     false,
  //   );

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    syncObject,
    sync,
    // eventSync,
  };
}
