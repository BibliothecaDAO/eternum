import { frontierSeasonOnePreset } from "../../../../config/source/frontier/season-one";
import {
  FRONTIER_FIXTURE_PRESET_ID,
  FRONTIER_S1_PRESET_ID,
} from "../../../../config/source/common/native-preset-modes";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { NativeFactStore } from "../../../../packages/core/src/client/native-fact-store";
import {
  BuildingType,
  RESOURCE_PRECISION,
  ResourcesIds,
  TroopTier,
  TroopType,
  type Troops,
} from "@bibliothecadao/types";
import { ClientConfigManager } from "../../../../packages/core/src/managers/config-manager";
import { affordableAt, musterStamina, staminaAt } from "../../../../packages/core/src/managers/troop-stamina";
import { describe, expect, it, vi } from "vitest";
import { CairoOption, CairoOptionVariant } from "starknet";
import type { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { LiveWorld } from "../live-world";
import type { MadaraRpc } from "../madara-rpc";
import { WorldFold } from "../world-fold";
import type { RpcEvent } from "../types";
import { gameRegistryEvent, manifest, receipt, rowEvent, schema, setup } from "./fixtures";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { loadNativeWorld } from "./load";
import { releaseLine } from "../../../../packages/core/src/test-support/releases";
import { presetRelease } from "./preset-fixtures";
import { readReleaseDefinitions, releaseDefinitionText } from "./release-definition";

const registration = (presetId = 5, amend?: (definition: ReturnType<typeof buildNativePreset>) => void) =>
  presetRelease(presetId, 1, amend);

function launch(preset: ReturnType<typeof registration>, gameId = 1, overrideMap = true): RpcEvent[] {
  const overrides = {
    registration_start: 1234,
    biome_climate: preset.definition.rules.biome_climate_config,
    map: new CairoOption(overrideMap ? CairoOptionVariant.Some : CairoOptionVariant.None, {
      ...preset.definition.rules.map_config,
      shards_mines_win_probability: 987,
    }),
    map_center_offset: 4321,
  };
  return [
    gameRegistryEvent({
      game_id: gameId,
      name: "0x123",
      start_settling_at: "1800",
      start_main_at: "1800",
      scheduled_end_at: "999999",
      end_at: "999999",
    }),
    rowEvent("GameOverrides", [String(gameId)], overrides),
    rowEvent("GameRelease", [String(gameId)], {
      release_id: preset.release,
      created_release_id: preset.release,
    }),
  ];
}

describe("a release's rule rows", () => {
  it("publishes the S1 Order mapping and leaves earlier presets without Aspect rules", () => {
    for (const presetId of [5, 7]) {
      const preset = registration(presetId);
      const world = setup(preset.definitions);
      world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
      const store = new NativeFactStore();
      store.applyFacts(
        world.fold.gameRows("AspectRules", "1").map(({ key, value }) => ({ model: "AspectRules", key, value })),
      );
      expect(store.get("AspectRules", { game_id: 1 })).toEqual(
        presetId === 7 ? { game_id: 1, orders: preset.definition.settlement.order_aspects } : undefined,
      );
    }
  });

  it("projects both beast strength ranges and renamed discovery odds into client facts", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const store = new NativeFactStore();
    for (const model of ["DepthRules", "FrontierDiscoveryRules"] as const) {
      store.applyFacts(world.fold.gameRows(model, "1").map(({ key, value }) => ({ model, key, value })));
    }
    const { game_id, ...discovery } = store.require("FrontierDiscoveryRules", { game_id: 1 });
    expect(game_id).toBe(1);
    expect(discovery).toEqual(preset.definition.economy.discovery.unwrap());
    for (const [depth, expected] of preset.definition.settlement.depths.entries()) {
      expect(store.require("DepthRules", { game_id: 1, depth })).toMatchObject({
        beast_weak_lower: expected.beast_weak_lower,
        beast_weak_upper: expected.beast_weak_upper,
        beast_strong_lower: expected.beast_strong_lower,
        beast_strong_upper: expected.beast_strong_upper,
      });
    }
  });

  it("carries Frontier stamina from registration through facts to client costs and Logistics bars", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const store = new NativeFactStore();
    store.applyFacts(
      world.fold.gameRows("SliceRules", "1").map(({ key, value }) => ({ model: "SliceRules", key, value })),
    );
    const manager = new ClientConfigManager();
    manager.setActiveGame(1);
    manager.setStore(store);
    const rules = store.require("SliceRules", { game_id: 1 });
    const stamina = rules.troop_stamina_config;
    const tick = Number(rules.tick_config.armies_tick_in_seconds);
    expect(manager.getExploreStaminaCost(TroopType.Knight, 0)).toBe(20);
    expect(manager.getCombatConfig().stamina_attack_req).toBe(30);
    const troop = { category: TroopType.Knight, tier: TroopTier.T1 };
    const empty: Troops = {
      ...troop,
      count: 1n,
      stamina: { amount: 0n, settled_at: 100, remainder: 0 },
      boosts: {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_at: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_at: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_seconds_left: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_at: 0,
      },
      battle_cooldown_end: 0,
    };
    expect(staminaAt(empty, 3700, stamina, tick).amount).toBe(30n);
    expect(affordableAt(empty, 100, stamina, tick, manager.getExploreStaminaCost(TroopType.Knight, 0))).toBe(2500);
    expect(affordableAt(empty, 100, stamina, tick, manager.getCombatConfig().stamina_attack_req)).toBe(3700);
    for (const [trained, maximum, explores, attacks] of [
      [0, 120, 6, 4],
      [1, 140, 7, 4],
      [2, 165, 8, 5],
      [3, 195, 9, 6],
      [4, 230, 11, 7],
      [5, 270, 13, 9],
    ] as const) {
      const bar = musterStamina({ slot: 0, inherited: null }, troop, 100, stamina, trained, tick);
      expect(bar).toEqual({ amount: maximum, max: maximum });
      expect(Math.floor(bar.amount / manager.getExploreStaminaCost(TroopType.Knight, 0))).toBe(explores);
      expect(Math.floor(bar.amount / manager.getCombatConfig().stamina_attack_req)).toBe(attacks);
    }
  });

  it("projects each depth's five ruin tier odds", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const tiers = ["common", "uncommon", "rare", "epic", "legendary"];
    const odds = world.fold
      .gameRows("DepthRules", "1")
      .map(({ value }) => value.chest as Record<string, unknown>)
      .map((chest) => tiers.reduce((sum, tier) => sum + Number(chest[tier]), 0));
    expect(odds).toEqual([10000, 10000, 10000, 10000]);
  });

  it("derives the complete launch config, preserving the chain's overrides", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    expect(world.fold.gameRows("ResourceRule", "1")).toHaveLength(58);
    expect(world.fold.gameRows("ProductionRecipe", "1")).toHaveLength(58);
    expect(world.fold.gameRows("BuildingRule", "1")).toHaveLength(44);
    const depths = world.fold.gameRows("DepthRules", "1").map(({ value }) => value);
    const expectedDepths = preset.definition.settlement.depths;
    expect(depths.map((row) => Number(row.guard_step))).toEqual(expectedDepths.map((row) => row.guard_step));
    expect(depths.map((row) => Number(row.reveal_percent))).toEqual(expectedDepths.map((row) => row.reveal_percent));
    expect(depths.every((row) => !Object.hasOwn(row, "supply_multiplier"))).toBe(true);
    const { game_id, ...discovery } = world.fold.gameRows("FrontierDiscoveryRules", "1")[0]!.value;
    expect(Number(game_id)).toBe(1);
    expect(Object.fromEntries(Object.entries(discovery).map(([key, value]) => [key, Number(value)]))).toEqual(
      preset.definition.economy.discovery.unwrap(),
    );

    expect(world.fold.gameRows("GameOverrides", "1")).toHaveLength(1);
    for (const scope of [undefined, {}, world.fold.subscriptionScope("1", "0x123", 1234)]) {
      const snapshot = world.fold.snapshot(1, 11, undefined, scope);
      expect(snapshot.models.map(({ model }) => model)).not.toContain("GameOverrides");
    }
    expect(() => world.fold.snapshot(1, 11, ["GameOverrides"])).toThrow("Unknown snapshot models");
    for (const name of ["ProductionReady", "BuildingRulesReady", "ResourceRulesReady"])
      expect(schema.models.map(({ name }) => name)).not.toContain(name);
    const rules = world.fold.gameRows("SliceRules", "1")[0]!.value;
    expect(BigInt(rules.map_center_offset as string)).toBe(4321n);
    expect(BigInt((rules.map_config as Record<string, string>).shards_mines_win_probability)).toBe(987n);
    const settlement = world.fold.gameRows("SettlementRules", "1")[0]!.value;
    expect(BigInt(settlement.registration_start as string)).toBe(1234n);
    expect(BigInt(settlement.registration_limit as string)).toBe(0n);
  });

  it("refuses a launch whose release has no rule definition, without partial state", () => {
    const preset = registration();
    const world = setup(presetRelease(5, 2).definitions);
    const before = world.fold.checkpoint();
    expect(() => world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0)).toThrow(
      "No rule definition for release 1",
    );
    expect(world.fold.checkpoint()).toEqual(before);
  });

  it("derives the same launch on an overlay and after a checkpoint restore", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    const restored = WorldFold.restore(world.decoder.registry, world.fold.checkpoint());
    const overlay = restored.overlay();
    world.native.applyReceipt(overlay, receipt(launch(preset)), null, 0);
    expect(restored.gameRows("ResourceRule", "1")).toHaveLength(0);
    world.native.applyReceipt(restored, receipt(launch(preset)), 11, 0);
    expect(restored.snapshot(1, 11)).toEqual(overlay.snapshot(1, 11));
  });

  it("publishes a pre-confirmed launch with all its rule rows in one diff", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    const live = new LiveWorld({
      native: world.native,
      registry: world.decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: vi.fn() },
      confirmedBlock: 9,
      confirmedFold: world.fold,
      rpc: {} as MadaraRpc,
    });
    const messages: Record<string, unknown>[] = [];
    const session = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) });
    live.resume(session, { epoch: "previous", seq: 0, type: "resume" });
    messages.length = 0;
    live.acceptReceipt({ ...receipt(launch(preset), "0x100"), finality_status: "PRE_CONFIRMED" });
    expect(world.native.receiptFailures).toBe(0);
    const diffs = messages.filter((message) => message.type === "diff");
    expect(diffs).toHaveLength(1);
    expect((diffs[0]!.set as { model: string }[]).filter(({ model }) => model === "ResourceRule")).toHaveLength(58);
    expect(world.fold.gameRows("ResourceRule", "1")).toHaveLength(0);
  });

  it("rolls a replay back whole when a later block fails", async () => {
    const preset = registration();
    const world = setup(preset.definitions);
    const before = world.fold.checkpoint();
    const launched = {
      block_number: 10,
      timestamp: 1800,
      transactions: [{ receipt: receipt(launch(preset)), transaction: { type: "INVOKE" } }],
    };
    await expect(
      world.native.replay({
        fold: world.fold,
        rpc: {
          readBlock: async (number) => {
            if (number === 11) throw new Error("block unavailable");
            return launched;
          },
        },
        fromBlock: 10,
        toBlock: 11,
      }),
    ).rejects.toThrow("block unavailable");
    expect(world.fold.checkpoint()).toEqual(before);
  });

  it("reads back exactly the definition the generator writes, and refuses a file that names no release", () => {
    const { definition } = registration(7);
    const written = releaseDefinitionText(11, definition);
    const read = readReleaseDefinitions(JSON.parse(written));
    expect([...read.keys()]).toEqual([11]);
    expect(releaseDefinitionText(11, read.get(11))).toBe(written);
    expect(() => readReleaseDefinitions({ definition: JSON.parse(written).definition })).toThrow(
      "A release definition names no release",
    );
  });

  it("uses the preset map only when the chain explicitly records no map override", () => {
    const preset = registration();
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset, 1, false)), 11, 0);
    const rules = world.fold.gameRows("SliceRules", "1")[0]!.value;
    expect(BigInt((rules.map_config as Record<string, string>).shards_mines_win_probability)).toBe(
      BigInt(preset.definition.rules.map_config.shards_mines_win_probability),
    );
  });
});

it("projects optional Deep rules from verified registration and publishes no row for None", () => {
  const deep = {
    gate_distance: 4,
    rings: [{ radius: 5, realms: 0 }],
    beasts: [
      { count: 10_000_000_000_000n, bow: false },
      { count: 10_000_000_000_000n, bow: true },
      { count: 10_000_000_000_000n, bow: false },
      { count: 10_000_000_000_000n, bow: true },
    ],
    loss_per_tick: BigInt(frontierSeasonOnePreset.deep.lossPerTick) * BigInt(RESOURCE_PRECISION),
    core_per_tick: 500_000_000_000n,
    mine_per_tick: 500_000_000_000n,
    building_pay: { alone: 6, pair: 3, crowd: 2 },
    altar_threshold: 1_500,
  };
  for (const enabled of [false, true]) {
    const preset = registration(FRONTIER_FIXTURE_PRESET_ID, (definition) => {
      if (enabled) {
        definition.economy.deep = new CairoOption(CairoOptionVariant.Some, deep);
      } else {
        definition.economy.deep = new CairoOption(CairoOptionVariant.None);
        definition.economy.race = new CairoOption(CairoOptionVariant.None);
      }
    });
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const store = new NativeFactStore();
    store.applyFacts(
      world.fold.gameRows("DeepRules", "1").map(({ key, value }) => ({ model: "DeepRules", key, value })),
    );
    expect(store.get("DeepRules", { game_id: 1 })).toEqual(enabled ? { game_id: 1, ...deep } : undefined);
  }
});

it("projects daily quest rules from verified registration, without a legacy claim row", () => {
  const rules = { base_counts: [1, 1, 1, 1, 1, 2, 15], labor: 1000n, essence: 1500n, bonus_percent: 150 };
  for (const enabled of [false, true]) {
    const preset = registration(FRONTIER_FIXTURE_PRESET_ID, (definition) => {
      if (enabled) {
        definition.economy.quests = new CairoOption(CairoOptionVariant.Some, rules);
        definition.economy.labor = new CairoOption(CairoOptionVariant.None);
      }
    });
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const store = new NativeFactStore();
    store.applyFacts(
      world.fold.gameRows("QuestRules", "1").map(({ key, value }) => ({ model: "QuestRules", key, value })),
    );
    expect(store.get("QuestRules", { game_id: 1 })).toEqual(enabled ? { game_id: 1, ...rules } : undefined);
  }
});

it("projects optional bane rules from the verified preset with whole Cull counts", () => {
  const rules = {
    chance_step: 20,
    quorum_percent: 25,
    beast_percent: 150,
    stamina_percent: 50,
    production_percent: 50,
    quest_counts: [3n, 6n, 9n, 12n, 20n, 40n, 60n, 80n, 2500n, 6000n, 10000n, 15000n],
  };
  for (const enabled of [false, true]) {
    const preset = registration(FRONTIER_FIXTURE_PRESET_ID, (definition) => {
      if (enabled) {
        definition.economy.banes = new CairoOption(CairoOptionVariant.Some, rules);
        definition.economy.quests = new CairoOption(CairoOptionVariant.Some, {
          base_counts: [1, 1, 1, 1, 1, 2, 15],
          labor: 1000n,
          essence: 1500n,
          bonus_percent: 150,
        });
        definition.economy.labor = new CairoOption(CairoOptionVariant.None);
      }
    });
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const store = new NativeFactStore();
    store.applyFacts(
      world.fold.gameRows("BaneRules", "1").map(({ key, value }) => ({ model: "BaneRules", key, value })),
    );
    expect(store.get("BaneRules", { game_id: 1 })).toEqual(enabled ? { game_id: 1, ...rules } : undefined);
  }
});

it("projects optional race rules from verified registration into the native fact store", () => {
  const rules = {
    season_days: 50n,
    stage_height: 2_000,
    clear_mist_percent: 200,
    second_wind_percent: 200,
    pale_moon_percent: 50,
    spoils_percent: 200,
  } satisfies Omit<NativeRows["RaceRules"], "game_id">;
  for (const enabled of [false, true]) {
    const preset = registration(FRONTIER_FIXTURE_PRESET_ID, (definition) => {
      if (enabled) {
        definition.economy.race = new CairoOption(CairoOptionVariant.Some, rules);
        definition.economy.deep = new CairoOption(CairoOptionVariant.Some, {
          gate_distance: 4,
          rings: [{ radius: 5, realms: 0 }],
          beasts: [
            { count: 10000_000000000n, bow: false },
            { count: 10000_000000000n, bow: true },
            { count: 10000_000000000n, bow: false },
            { count: 10000_000000000n, bow: true },
          ],
          loss_per_tick: BigInt(frontierSeasonOnePreset.deep.lossPerTick) * BigInt(RESOURCE_PRECISION),
          core_per_tick: 500_000000000n,
          mine_per_tick: 500_000000000n,
          building_pay: { alone: 6, pair: 3, crowd: 2 },
          altar_threshold: 1500,
        });
      } else {
        definition.economy.race = new CairoOption(CairoOptionVariant.None);
      }
    });
    const world = setup(preset.definitions);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    const store = new NativeFactStore();
    store.applyFacts(
      world.fold.gameRows("RaceRules", "1").map(({ key, value }) => ({ model: "RaceRules", key, value })),
    );
    expect(store.get("RaceRules", { game_id: 1 })).toEqual(enabled ? { game_id: 1, ...rules } : undefined);
  }
});

it("publishes every active Season 1 rule through verified registration and launch", () => {
  const preset = registration(FRONTIER_S1_PRESET_ID);
  const world = setup(preset.definitions);
  world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
  const store = new NativeFactStore();
  for (const [model, rules] of [
    ["DeepRules", preset.definition.economy.deep],
    ["QuestRules", preset.definition.economy.quests],
    ["BaneRules", preset.definition.economy.banes],
    ["RaceRules", preset.definition.economy.race],
  ] as const) {
    store.applyFacts(world.fold.gameRows(model, "1").map(({ key, value }) => ({ model, key, value })));
    const { game_id, ...actual } = store.require(model, { game_id: 1 });
    expect(game_id).toBe(1);
    expect(actual).toEqual(rules.unwrap());
  }
});

const barracksAt = (labor: number) => (definition: ReturnType<typeof buildNativePreset>) => {
  const barracks = definition.structures.buildings.find(({ category }) => category === BuildingType.ResourceKnightT1)!;
  barracks.rule.simple_cost = [
    { resource_type: ResourcesIds.Labor, amount: BigInt(labor) * BigInt(RESOURCE_PRECISION) },
  ];
};

function twoReleases() {
  const launched = presetRelease(5, 1, barracksAt(400));
  const upgraded = presetRelease(5, 2, (definition) => {
    barracksAt(500)(definition);
    definition.structures.upgrades.pop();
  });
  const released = structuredClone(manifest);
  released.native.releases = releaseLine(schema.identity, [1, 2]);
  const definitions = new Map([...launched.definitions, ...upgraded.definitions]);
  const world = () => {
    const decoder = new NativeDecoder(released);
    return { decoder, fold: new WorldFold(decoder.registry), native: new NativeIngestion(decoder, definitions) };
  };
  const upgrade = rowEvent("GameRelease", ["1"], { release_id: 2, created_release_id: 1 });
  const launchedOn = (preset: typeof upgraded) => {
    const direct = world();
    direct.native.applyReceipt(direct.fold, receipt(launch(preset)), 11, 0);
    return direct.fold;
  };
  return { launched, upgraded, world, upgrade, launchedOn };
}

function clientBarracksPrice(fold: WorldFold) {
  const store = new NativeFactStore();
  for (const model of ["SliceRules", "BuildingRule"] as const) {
    store.applyFacts(fold.gameRows(model, "1").map(({ key, value }) => ({ model, key, value })));
  }
  const manager = new ClientConfigManager();
  manager.setActiveGame(1);
  manager.setStore(store);
  return manager.getBuildingCosts(BuildingType.ResourceKnightT1, true);
}

const ruleRows = (fold: WorldFold) =>
  ["BuildingRule", "ResearchPrice", "UpgradeRecipe", "SliceRules"].map((model) => fold.gameRows(model, "1"));

describe("a game's rule rows follow its release", () => {
  it("shows the new release's Barracks price once a launched game moves to it", () => {
    const { launched, world, upgrade } = twoReleases();
    const live = world();
    live.native.applyReceipt(live.fold, receipt(launch(launched)), 11, 0);
    expect(clientBarracksPrice(live.fold)).toEqual([{ resource: ResourcesIds.Labor, amount: 400 }]);
    const levels = live.fold.gameRows("UpgradeRecipe", "1").length;
    live.native.applyReceipt(live.fold, receipt([upgrade]), 12, 0);
    expect(clientBarracksPrice(live.fold)).toEqual([{ resource: ResourcesIds.Labor, amount: 500 }]);
    expect(live.fold.gameRows("UpgradeRecipe", "1")).toHaveLength(levels - 1);
  });

  it("ends a replay from genesis on the rows of a game launched on the new release", async () => {
    const { launched, upgraded, world, upgrade, launchedOn } = twoReleases();
    const blocks = [launch(launched), [upgrade]].map((events, index) => ({
      block_number: 11 + index,
      timestamp: 2160,
      transactions: [{ receipt: receipt(events, `0x${(11 + index).toString(16)}`), transaction: { type: "INVOKE" } }],
    }));
    const replayed = world();
    const rpc = { readBlock: vi.fn(async (number: number) => blocks[number - 11]) };
    await replayed.native.replay({ fold: replayed.fold, rpc, fromBlock: 11, toBlock: 12 });
    expect(ruleRows(replayed.fold)).toEqual(ruleRows(launchedOn(upgraded)));
    expect(clientBarracksPrice(replayed.fold)).toEqual([{ resource: ResourcesIds.Labor, amount: 500 }]);
  });

  it("takes a restored checkpoint's rule rows from each game's current release", async () => {
    const { launched, upgraded, world, launchedOn } = twoReleases();
    const saved = world();
    saved.native.applyReceipt(saved.fold, receipt(launch(launched)), 11, 0);
    const pinned = saved.decoder.decodeRowSet("GameRelease", ["0x1"], ["0x2", "0x1"]);
    saved.fold.apply({
      ...pinned,
      position: { blockNumber: 12, transactionHash: "0x12", transactionIndex: 0, eventIndex: 0 },
    });
    expect(clientBarracksPrice(saved.fold)).toEqual([{ resource: ResourcesIds.Labor, amount: 400 }]);
    const restarted = world();
    const checkpointStore = {
      initialize: vi.fn(),
      load: vi.fn(async () => ({
        fold: WorldFold.restore(restarted.decoder.registry, saved.fold.checkpoint()),
        confirmedBlock: 12,
      })),
      save: vi.fn(),
    };
    const rpc = { blockNumber: vi.fn(async () => 12), readBlock: vi.fn() } as unknown as MadaraRpc;
    const history = { frontierHistory: async () => [], appendEvents: vi.fn(), historyProgress: vi.fn(async () => 12) };
    const loaded = await loadNativeWorld({ chain: "madara", checkpointStore, history, native: restarted.native, rpc });
    expect(clientBarracksPrice(loaded.fold)).toEqual([{ resource: ResourcesIds.Labor, amount: 500 }]);
    expect(ruleRows(loaded.fold)).toEqual(ruleRows(launchedOn(upgraded)));
  });
});
