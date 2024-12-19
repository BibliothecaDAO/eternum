import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  HYPERSTRUCTURE_CONFIG_ID,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getEntities, getEvents } from "@dojoengine/state";
import { Clause } from "@dojoengine/torii-client";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { ClientConfigManager } from "./modelManager/ConfigManager";
import { setupNetwork } from "./setupNetwork";
import { setupWorker } from "./worker";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export const configManager = ClientConfigManager.instance();

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);

  const configClauses: Clause[] = [
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString()],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString(), undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString(), undefined, undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [BUILDING_CATEGORY_POPULATION_CONFIG_ID.toString(), undefined],
        pattern_matching: "FixedLen",
        models: [],
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

  await getEntities(
    network.toriiClient,
    { Composite: { operator: "Or", clauses: configClauses } },
    network.contractComponents as any,
  );

  // fetch all existing entities from torii
  await getEntities(
    network.toriiClient,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: [
          "s0_eternum-AddressName",
          "s0_eternum-Realm",
          "s0_eternum-PopulationConfig",
          "s0_eternum-CapacityConfig",
          "s0_eternum-ProductionConfig",
          "s0_eternum-RealmLevelConfig",
          "s0_eternum-BankConfig",
          "s0_eternum-Bank",
          "s0_eternum-Trade",
          "s0_eternum-Army",
          "s0_eternum-Structure",
          "s0_eternum-Battle",
          "s0_eternum-EntityOwner",
        ],
      },
    },
    network.contractComponents as any,
    [],
    [],
    40_000,
    false,
  );

  await getEntities(
    network.toriiClient,
    {
      Keys: {
        keys: [undefined, undefined],
        pattern_matching: "FixedLen",
        models: ["s0_eternum-CapacityConfigCategory", "s0_eternum-ResourceCost"],
      },
    },
    network.contractComponents as any,
    [],
    [],
    40_000,
    false,
  );

  const sync = await setupWorker(
    {
      rpcUrl: config.rpcUrl,
      toriiUrl: config.toriiUrl,
      relayUrl: config.relayUrl,
      worldAddress: config.manifest.world.address || "",
    },
    network.contractComponents as any,
    [],
    false,
  );

  configManager.setDojo(components);

  const eventSync = getEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    [],
    [],
    20000,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: [
          "s0_eternum-GameEnded",
          "s0_eternum-HyperstructureFinished",
          "s0_eternum-BattleClaimData",
          "s0_eternum-BattleJoinData",
          "s0_eternum-BattleLeaveData",
          "s0_eternum-BattlePillageData",
          "s0_eternum-BattleStartData",
          "s0_eternum-AcceptOrder",
          "s0_eternum-SwapEvent",
          "s0_eternum-LiquidityEvent",
          "s0_eternum-HyperstructureContribution",
        ],
      },
    },
    false,
    false,
  );

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
