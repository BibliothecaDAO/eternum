import { WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities, getSyncEvents } from "@dojoengine/state";
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
      models: [
        "s0_eternum-AddressName",
        "s0_eternum-Army",
        "s0_eternum-ArrivalTime",
        "s0_eternum-Bank",
        "s0_eternum-BankConfig",
        "s0_eternum-Battle",
        "s0_eternum-BattleConfig",
        "s0_eternum-Building",
        "s0_eternum-BuildingCategoryPopConfig",
        "s0_eternum-BuildingConfig",
        "s0_eternum-BuildingGeneralConfig",
        "s0_eternum-BuildingQuantityv2",
        "s0_eternum-CapacityCategory",
        "s0_eternum-CapacityConfig",
        "s0_eternum-Contribution",
        "s0_eternum-DetachedResource",
        "s0_eternum-EntityName",
        "s0_eternum-EntityOwner",
        "s0_eternum-Epoch",
        "s0_eternum-Guild",
        "s0_eternum-GuildMember",
        "s0_eternum-GuildWhitelist",
        "s0_eternum-Health",
        "s0_eternum-Hyperstructure",
        "s0_eternum-HyperstructureConfig",
        "s0_eternum-HyperstructureResourceConfig",
        "s0_eternum-Leaderboard",
        "s0_eternum-LeaderboardEntry",
        "s0_eternum-LeaderboardRegistered",
        "s0_eternum-LeaderboardRewardClaimed",
        "s0_eternum-LevelingConfig",
        "s0_eternum-Liquidity",
        "s0_eternum-MapConfig",

        "s0_eternum-MercenariesConfig",
        "s0_eternum-Message",
        "s0_eternum-Movable",
        "s0_eternum-Orders",
        "s0_eternum-OwnedResourcesTracker",
        "s0_eternum-Owner",
        "s0_eternum-Population",
        "s0_eternum-PopulationConfig",
        "s0_eternum-Position",
        "s0_eternum-ProductionConfig",
        "s0_eternum-ProductionDeadline",
        "s0_eternum-ProductionInput",
        "s0_eternum-ProductionOutput",

        "s0_eternum-Protectee",
        "s0_eternum-Protector",
        "s0_eternum-Quantity",
        "s0_eternum-QuantityTracker",

        "s0_eternum-QuestConfig",
        "s0_eternum-QuestRewardConfig",
        // "s0_eternum-Realm",
      ],
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
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString(), undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString()],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
  ];

  // fetch all existing entities from torii
  const sync = await getSyncEntities(
    network.toriiClient,
    network.contractComponents as any,
    { Composite: { operator: "Or", clauses: [...clauses] } },
    [],
    5000,
    true,
  );

  const syncObject = {
    sync,
    clauses: [...clauses],
  };

  const eventSync = getSyncEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    undefined,
    [],
    20_000,
    false,
    false,
  );

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    syncObject,
    eventSync,
  };
}
