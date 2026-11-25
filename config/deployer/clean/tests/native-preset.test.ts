import { frontierSeasonOnePreset } from "../../../source/frontier/season-one";
import { buildingIds } from "../../../source/frontier/native";
import { findRegistrarGame } from "../registrar/calls";
import { nativePresets } from "../../../source/native";
import { describe, expect, test, mock } from "bun:test";
import type { RpcProvider } from "starknet";
import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { blitzPendingCommandMask } from "../../../source/common/native-commands";
import { applyDeploymentConfigOverrides } from "../config/config-loader";
import {
  blitzPointRules,
  blitzReleaseDefinition,
  buildNativePreset,
  seasonOneReleaseDefinition,
} from "../config/native-preset";
import { blitzExplorationRewards } from "../../../source/blitz/balance";
import { balanceModules, blitzBalanceModules } from "../../../../contracts/l3/world-native/scripts/balance-modules";
import {
  FRONTIER_ACCELERATED_PRESET_ID,
  FRONTIER_PRESET_ID,
  FRONTIER_S1_PRESET_ID,
  FRONTIER_FIXTURE_PRESET_ID,
  FRONTIER_PLAYGROUND_PRESET_ID,
  FRONTIER_REHEARSAL_PRESET_ID,
  nativeGameModeOf,
} from "../../../source/common/native-preset-modes";
import { nativePresetIdFor } from "../../../source/native";
import {
  clockScaled,
  gameClockScale,
  scaleGameClocks,
  seasonDayUnitSeconds,
} from "../../../source/common/season-clock";
import { RESOURCE_PRECISION, ResourcesIds, deepSites } from "../../../../packages/types/src/constants";
import { buildNativeGameParams, loadNativePresetConfiguration } from "../registrar/native-preset";
import { launchGame } from "../launch/runner";

const abi = [...Object.values(schema.types), ...schema.games.entrypoints];

function configuration(preset: number) {
  const config = loadNativePresetConfiguration("madara.blitz", preset);
  return config;
}

describe("native presets", () => {
  test("the release's commands leave out retired ones and Season 1 opens army relics", () => {
    expect(nativeCommandBits).not.toHaveProperty("RefillStamina");
    expect(nativeCommandBits).not.toHaveProperty("WithdrawLords");
    for (const retired of ["OpenRelicChest", "CraftRelic", "CloseSeason", "ContributeHyperstructure"])
      expect(nativeCommandBits).not.toHaveProperty(retired);
    const mask = nativePresets[FRONTIER_S1_PRESET_ID]!.commandMask;
    expect(mask & BigInt(nativeCommandBits.ApplyRelic)).not.toBe(0n);
  });

  test("Season 1 grants 2,000 Knights at home while historical presets retain their stock", () => {
    for (const id of [FRONTIER_S1_PRESET_ID, FRONTIER_FIXTURE_PRESET_ID, FRONTIER_PRESET_ID]) {
      const preset = buildNativePreset(loadNativePresetConfiguration("madara.frontier", id), id);
      const seasonOne = id !== FRONTIER_PRESET_ID;
      expect(preset.settlement.realms.resources).toEqual([
        { resource_type: ResourcesIds.Knight, amount: BigInt(seasonOne ? 2000 : 1500) * BigInt(RESOURCE_PRECISION) },
        { resource_type: ResourcesIds.Wheat, amount: BigInt(seasonOne ? 6000 : 4500) * BigInt(RESOURCE_PRECISION) },
        { resource_type: ResourcesIds.Labor, amount: 2000n * BigInt(RESOURCE_PRECISION) },
      ]);
    }
  });

  test("Frontier presets cannot grant or import resource relics into an army", () => {
    const frontierPresets = Object.values(nativePresets).filter(({ gameType }) => gameType === "frontier");
    expect(frontierPresets.length).toBeGreaterThan(0);
    for (const source of frontierPresets) {
      expect(source.gameType).toBe("frontier");
      const preset = buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id);
      expect(preset.rules.day_unit_seconds).toBeGreaterThan(0);
      expect(source.bridgeResources).toEqual([]);
      expect(preset.economy.withdrawals.isNone()).toBe(true);
      for (const command of [
        "OffloadArrival",
        "SendResources",
        "TransferExplorerResources",
        "TransferExplorerResourcesToStructure",
      ] as const) {
        expect(preset.rules.command_mask & BigInt(nativeCommandBits[command])).toBe(0n);
      }
      const grants = [
        ...preset.settlement.realms.resources,
        ...preset.settlement.villages.resources,
        ...preset.settlement.villages.resource_pool,
        ...preset.structures.camps.resources,
        ...preset.resources.mine_kinds.map(({ config }) => config),
      ];
      expect(grants.some(({ resource_type }) => resource_type >= 39 && resource_type <= 56)).toBe(false);
      expect(preset.settlement.realms.realm_resources.some((id) => id >= 39 && id <= 56)).toBe(false);
      const relics = preset.resources.resources.filter(
        ({ resource_type }) => resource_type >= 39 && resource_type <= 56,
      );
      expect(relics).toHaveLength(18);
      for (const relic of relics) {
        expect([relic.realm_rate, relic.village_rate]).toEqual([0n, 0n]);
        const production = preset.resources.production.find(
          ({ resource_type }) => resource_type === relic.resource_type,
        )!;
        expect([production.recipe.simple_output, production.recipe.complex_output]).toEqual([0n, 0n]);
      }
    }
  });

  test("held-Realm labor is fixed per game day without a golden campaign bonus", () => {
    for (const id of [FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID]) {
      const preset = buildNativePreset(loadNativePresetConfiguration("madara.frontier", id), id);
      expect(preset.economy.labor.unwrap()).toEqual({
        amount: 1000n,
        campaign_essence: 0n,
        golden_amount: 1000n,
        golden_essence: 0n,
      });
    }
    for (const id of [2]) expect(buildNativePreset(configuration(id), id).economy.labor.isNone()).toBe(true);
  });
  test.each([-1, 0.5, Number.NaN])("refuses invalid daily home grants (%s)", (invalid) => {
    const labor = nativePresets[FRONTIER_PRESET_ID]!.labor!;
    for (const field of ["amount", "campaignEssence", "goldenAmount", "goldenEssence"] as const) {
      const previous = labor[field];
      try {
        labor[field] = invalid;
        expect(() =>
          buildNativePreset(loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID), FRONTIER_PRESET_ID),
        ).toThrow("Invalid Realm labor rules");
      } finally {
        labor[field] = previous;
      }
    }
  });
  test.each([2])(
    "a fixed-roster realm (preset %i) starts with 1,000 T1 troops garrisoned and 1,000 in reserve, its type dealt",
    (id) => {
      const preset = buildNativePreset(configuration(id), id);
      expect(preset.settlement.realms.starting_troops).toEqual([]);
      expect(preset.rules.troop_limit_config.starting_guard).toBe(1_000);
      expect(
        preset.settlement.realms.resources.filter(({ resource_type }) => [26, 29, 32].includes(resource_type)),
      ).toEqual([26, 29, 32].map((resource_type) => ({ resource_type, amount: 1_000_000_000_000n })));
    },
  );

  test.each([FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID])(
    "Frontier preset %i removes one chest rarity at each depth and preserves the remaining proportions",
    (id) => {
      const preset = buildNativePreset(loadNativePresetConfiguration("madara.frontier", id), id);
      const tables = preset.settlement.depths.map(({ chest }) => chest);
      expect(tables).toEqual([
        { common: 5000, uncommon: 2700, rare: 1400, epic: 600, legendary: 300 },
        { common: 0, uncommon: 5000, rare: 2833, epic: 1500, legendary: 667 },
        { common: 0, uncommon: 0, rare: 5500, epic: 3000, legendary: 1500 },
        { common: 0, uncommon: 0, rare: 0, epic: 6400, legendary: 3600 },
      ]);
      for (const [depth, table] of tables.entries()) {
        const weights = [table.common, table.uncommon, table.rare, table.epic, table.legendary];
        expect(weights.every(Number.isInteger)).toBe(true);
        expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(10000);
        expect(weights.slice(0, depth)).toEqual(Array(depth).fill(0));
      }
    },
  );

  test("every preset supplies its cooldown explicitly, independent of the stamina clock", () => {
    for (const [network, id, expected] of [
      ["madara.frontier", 5, 0],
      ["madara.blitz", 2, 60],
    ] as const) {
      const config = loadNativePresetConfiguration(network, id);
      expect(buildNativePreset(config, id).rules.battle_config.cooldown_seconds).toBe(expected);
      expect(() =>
        buildNativePreset(
          { ...config, battle: { ...config.battle, cooldownSeconds: undefined } } as unknown as typeof config,
          id,
        ),
      ).toThrow("cooldownSeconds must be an explicit u32");
    }
  });

  test("Season 1's command gate opens site interaction and no resource transfer", () => {
    const mask = seasonOneReleaseDefinition().rules.command_mask;
    expect(mask & BigInt(nativeCommandBits.InteractSite)).not.toBe(0n);
    for (const [network, id] of [["madara.blitz", 2]] as const) {
      const legacy = buildNativePreset(loadNativePresetConfiguration(network, id), id);
      expect(legacy.rules.command_mask & BigInt(nativeCommandBits.InteractSite)).toBe(0n);
    }
    for (const command of ["SendResources", "TransferExplorerResourcesToStructure"] as const)
      expect(mask & BigInt(nativeCommandBits[command])).toBe(0n);
  });
  test("the accelerated Frontier preset's games run Frontier's release with every clock 120 times faster", () => {
    const canonical = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const accelerated = scaleGameClocks(canonical, gameClockScale(nativePresets[FRONTIER_ACCELERATED_PRESET_ID]!));

    expect(canonical.rules.day_unit_seconds).toBe(14_400);
    expect(accelerated.rules.day_unit_seconds).toBe(120);
    expect(accelerated.rules.tick_config.armies_tick_in_seconds).toBe(
      canonical.rules.tick_config.armies_tick_in_seconds / 120,
    );
    expect(accelerated.resources.resources.map(({ realm_rate }) => realm_rate)).toEqual(
      canonical.resources.resources.map(({ realm_rate }) => realm_rate * 120n),
    );
  });

  test("Frontier sites carry no flat camp reward or rift-production table", () => {
    const design = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );

    expect(design.structures.camps.resources).toEqual([]);
    for (const depth of design.settlement.depths) {
      for (const retired of ["mine_cap_min", "mine_cap_max", "mine_rate", "mine_chest"])
        expect(depth).not.toHaveProperty(retired);
    }
  });

  test("Frontier prices every research row's tiers once, in resource precision, from the rules' ladders", () => {
    const preset = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const precision = 1_000_000_000n;
    const prices = Object.fromEntries(
      preset.structures.research.map(({ row, tier, price }) => [
        `${row}:${tier}`,
        [BigInt(price.essence) / precision, BigInt(price.labor) / precision],
      ]),
    );
    expect(preset.structures.research).toHaveLength(37);
    expect(prices).toMatchObject({
      [`${research.ROW_FARM}:1`]: [500n, 500n],
      [`${research.ROW_FARM}:5`]: [30000n, 20000n],
      [`${research.ROW_WORKSHOP}:3`]: [8000n, 6000n],
      [`${research.ROW_SUPPLY_YARD}:1`]: [6000n, 1500n],
      [`${research.ROW_SUPPLY_YARD}:2`]: [16000n, 3000n],
      [`${research.ROW_SUPPLY_YARD}:5`]: [360000n, 60000n],
      [`${research.ROW_LORE}:1`]: [2500n, 0n],
      [`${research.ROW_LORE}:2`]: [5000n, 0n],
      [`${research.ROW_LORE}:3`]: [10000n, 0n],
    });
    for (const row of [research.ROW_KNIGHT_OATHS, research.ROW_SCOUT_OATHS, research.ROW_CROSSBOW_OATHS]) {
      expect([1, 2, 3].map((tier) => prices[`${row}:${tier}`])).toEqual([
        [5000n, 1000n],
        [35000n, 7500n],
        [150000n, 35000n],
      ]);
      expect(prices[`${row}:4`]).toBeUndefined();
    }
    for (const row of [research.ROW_CONSCRIPTION, research.ROW_RATIONS]) {
      expect([1, 2, 3, 4, 5].map((tier) => prices[`${row}:${tier}`])).toEqual([
        [2500n, 500n],
        [5000n, 1000n],
        [12500n, 2500n],
        [25000n, 5000n],
        [50000n, 12500n],
      ]);
    }
    for (const category of [research.CONSCRIPTION_CAMP, research.RATIONS_DEPOT]) {
      expect(preset.structures.buildings.find((row) => row.category === category)!.rule.simple_cost).toEqual([
        { resource_type: 38, amount: 2500n * precision },
        { resource_type: 23, amount: 500n * precision },
      ]);
    }
    expect(preset.structures.buildings.find((row) => row.category === research.RANGE)!.rule.simple_cost).toEqual([
      { resource_type: 23, amount: 500n * precision },
    ]);
    expect(preset.structures.board.unwrap()).toMatchObject({
      output_step_bps: 2000,
      storage_step_bps: 4000,
      ration_step: precision / 5n,
      troop_store_deploys: 2,
      settlement_resource_cap: 6000,
      city_resource_cap: 18000,
      kingdom_resource_cap: 40000,
      empire_resource_cap: 80000,
    });
    expect(preset.structures.buildings).toHaveLength(buildingIds.length);
    for (const category of [research.SUPPLY_YARD]) {
      const rule = preset.structures.buildings.find((row) => row.category === category)!.rule;
      expect(rule.simple_cost).toEqual([
        { resource_type: 38, amount: 6000n * precision },
        { resource_type: 23, amount: 1500n * precision },
      ]);
    }
    for (const category of [34]) {
      const rule = preset.structures.buildings.find((row) => row.category === category)!.rule;
      expect(rule.simple_cost).toEqual([]);
      expect(rule.complex_cost).toEqual([]);
    }
    expect(preset.rules.building_config.base_cost_percent_increase).toBe(10000);
    expect(preset.structures.board.unwrap()).not.toHaveProperty("neighbors");
    for (const depth of preset.settlement.depths) expect(depth).not.toHaveProperty("attunement_cost");
  });

  test("A camp's labor rate is its own rule, at the rate it read from the village before", () => {
    for (const id of [2]) {
      const preset = buildNativePreset(configuration(id), id);
      const labor = preset.resources.resources.find(({ resource_type }) => resource_type === 23)!;
      expect(preset.structures.camps.labor_rate).toBe(labor.realm_rate / 2n);
    }
  });

  test("Frontier owns discovery odds in its categorical row and ruin beasts in each depth", () => {
    const preset = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    expect(preset.economy.discovery.unwrap()).toEqual({
      beasts_bps: 900,
      camp_bps: 400,
      rift_bps: 400,
      ruin_bps: 300,
      shrine_bps: 300,
      well_bps: 300,
      empty_reveal_limit: 7,
    });
    expect(preset.rules.map_config.camp_win_probability).toBe(0);
    expect(preset.rules.map_config.shards_mines_win_probability).toBe(0);
    expect(
      preset.settlement.depths.map((depth) => [depth.site_guard_lower, depth.site_guard_upper, depth.guard_step]),
    ).toEqual([
      [1200, 1400, 100],
      [2400, 2800, 100],
      [4700, 5700, 100],
      [9300, 11500, 100],
    ]);
    for (const depth of preset.settlement.depths) {
      expect(depth.site_guard_lower).toBeLessThanOrEqual(depth.site_guard_upper);
      for (const bound of [depth.site_guard_lower, depth.site_guard_upper]) expect(bound % depth.guard_step).toBe(0);
    }
  });

  test("Blitz carries no labor-paid production, while Frontier trains troops", () => {
    const laborPaid = (environment: Parameters<typeof loadNativePresetConfiguration>[0], presetId: number) =>
      buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId)
        .resources.production.filter(({ recipe }) => recipe.simple_inputs.length > 0)
        .map(({ resource_type }) => resource_type);

    expect(laborPaid("madara.blitz", 2)).toEqual([]);
    expect(laborPaid("madara.frontier", FRONTIER_PRESET_ID)).toEqual([26, 29]);
  });

  test("Frontier carries separate weak and stronger beast ranges at each depth", () => {
    const preset = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    expect(
      preset.settlement.depths.map((depth) => [
        depth.beast_weak_lower,
        depth.beast_weak_upper,
        depth.beast_strong_lower,
        depth.beast_strong_upper,
      ]),
    ).toEqual([
      [380, 420, 430, 470],
      [760, 840, 860, 940],
      [1520, 1680, 1720, 1880],
      [3040, 3360, 3440, 3760],
    ]);
    expect(preset.economy.discovery.unwrap()).toMatchObject({ beasts_bps: 900 });
  });

  test("Frontier armies merge but never recruit guards: troop management on, every guard slot closed", () => {
    const design = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const limits = design.rules.troop_limit_config;

    expect(design.rules.command_mask & BigInt(nativeCommandBits.ManageTroops)).not.toBe(0n);
    expect([
      limits.settlement_guard_slots,
      limits.city_guard_slots,
      limits.kingdom_guard_slots,
      limits.empire_guard_slots,
    ]).toEqual([0, 0, 0, 0]);
  });

  test("Frontier combat is biome-neutral while Blitz keeps its terrain bonus", () => {
    const frontier = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const blitz = buildNativePreset(loadNativePresetConfiguration("madara.blitz", 2), 2);

    expect(frontier.rules.troop_damage_config.damage_biome_bonus_num).toBe(0);
    expect(blitz.rules.troop_damage_config.damage_biome_bonus_num).toBe(3000);
  });

  test("Frontier's design preset carries the starting grant and farm, barracks and castle production", () => {
    const design = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const perHour = (resource: number) =>
      (Number(design.resources.resources.find(({ resource_type }) => resource_type === resource)!.realm_rate) * 3600) /
      1_000_000_000;

    expect(design.rules.tick_config.armies_tick_in_seconds).toBe(120);
    expect(design.rules.troop_stamina_config).toMatchObject({
      stamina_gain_per_tick: 1,
      stamina_explore_stamina_cost: 20,
      stamina_travel_stamina_cost: 10,
      stamina_attack_req: 30,
      capture_stamina_refund: 0,
      stamina_initial: 120,
      stamina_knight_max: 120,
      stamina_crossbowman_max: 120,
      stamina_paladin_max: 120,
    });
    expect(design.settlement.realms.resources).toEqual([
      { resource_type: 26, amount: 1_500_000_000_000n },
      { resource_type: 35, amount: 4_500_000_000_000n },
      { resource_type: 23, amount: 2_000_000_000_000n },
    ]);
    expect(design.settlement.realms.starting_troops.every((troop) => troop.activeVariant() === "Knight")).toBe(true);
    for (const [resource, expected] of [
      [26, 100.8],
      [27, 0],
      [28, 0],
      [29, 100],
      [35, 302.4],
      [23, 100.8],
    ]) {
      expect(perHour(resource)).toBeCloseTo(expected, 5);
    }
    for (const resource of [26]) {
      const production = design.resources.production.find(({ resource_type }) => resource_type === resource)!;
      expect(production.recipe.simple_inputs).toEqual([{ resource_type: 35, amount: 2_000_000_000n }]);
      expect(perHour(resource) * 2).toBeCloseTo(201.6, 5);
    }
    expect(design.resources.production.find(({ resource_type }) => resource_type === 29)!.recipe.simple_inputs).toEqual(
      [{ resource_type: 35, amount: 2_000_000_000n }],
    );
    for (const resource of [27, 28, 30, 31, 32, 33, 34]) {
      const production = design.resources.production.find(({ resource_type }) => resource_type === resource)!;
      expect(production.recipe.simple_inputs).toEqual([]);
      expect(production.recipe.simple_output).toBe(0n);
    }
  });

  test("Frontier castle upgrades and the workshop cost labor", () => {
    const design = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    expect(design.structures.upgrades.map(({ costs }) => costs)).toEqual([
      [{ resource_type: 23, amount: 4_000_000_000_000n }],
      [{ resource_type: 23, amount: 15_000_000_000_000n }],
      [{ resource_type: 23, amount: 40_000_000_000_000n }],
    ]);
    expect(design.structures.buildings.find(({ category }) => category === 25)?.rule.simple_cost).toEqual([
      { resource_type: 23, amount: 2_000_000_000_000n },
    ]);
  });

  test("every preset id names the mode it plays, and an unknown id fails by name", () => {
    expect([1, 2, FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID, 102].map(nativeGameModeOf)).toEqual([
      "frontier",
      "blitz",
      "frontier",
      "frontier",
      "frontier",
    ]);
    expect(() => nativeGameModeOf(4)).toThrow("Unknown native preset 4");
    expect(() => loadNativePresetConfiguration("madara.blitz", 4)).toThrow("Unsupported native preset 4");
    expect(() => nativeGameModeOf(9)).toThrow("Unknown native preset 9");
    for (const retired of [3, 103]) {
      expect(() => nativeGameModeOf(retired)).toThrow(`Unknown native preset ${retired}`);
      expect(() => loadNativePresetConfiguration("madara.blitz", retired)).toThrow(
        `Unsupported native preset ${retired}`,
      );
    }
    expect(nativeGameModeOf(104)).toBe("frontier");
    expect(nativeGameModeOf(105)).toBe("frontier");
    expect(() => nativeGameModeOf(106)).toThrow("Unknown native preset 106");
  });

  test("native balances and mine ladders come only from the selected sheet", () => {
    const config = configuration(2);
    config.mines!.kinds[1] = {
      resourceType: 38,
      buildingCategory: 39,
      productionRate: 9,
      capMinimum: 400,
      capSteps: 3,
    };
    config.mines!.surfacePool = [{ kind: 1, weight: 4 }];
    const definition = buildNativePreset(config, 2);
    expect(definition.resources.mine_kinds[0].config).toEqual({
      resource_type: 38,
      building_category: 39,
      production_rate: 9_000000000n,
      cap_min: 400_000000000n,
      cap_steps: 3,
    });
    expect(definition.resources.surface_mines).toEqual([{ kind: 1, weight: 4 }]);
  });

  test("missing balances and malformed mine pools fail before registration", () => {
    const config = configuration(2);
    delete config.mines;
    expect(() => buildNativePreset(config, 2)).toThrow("Mine balance config");
    config.mines = configuration(2).mines;
    config.mines!.surfacePool = [{ kind: 99, weight: 1 }];
    expect(() => buildNativePreset(config, 2)).toThrow("Invalid mine pool");
    config.mines!.surfacePool = [];
    expect(() => buildNativePreset(config, 2)).toThrow("requires a pool");
  });

  test("large resource amounts retain bigint precision and missing balance entries fail", () => {
    const config = configuration(2);
    config.startingResources[0]!.amount = 20_000_000;
    expect(buildNativePreset(config, 2).settlement.realms.resources[0]!.amount).toBe(20_000_000_000000000n);
    delete (config.resources.resourceWeightsGrams as Partial<Record<number, number>>)[3];
    expect(() => buildNativePreset(config, 2)).toThrow("Missing resource weight for 3");
  });

  test("building a changed preset cannot mutate the next definition's tables", () => {
    const first = buildNativePreset(configuration(2), 2);
    first.settlement.villages.resource_pool[0].weight = 1;
    first.settlement.realms.realm_resources.length = 0;
    const next = buildNativePreset(configuration(2), 2);
    expect(next.settlement.villages.resource_pool[0].weight).toBe(19815);
    expect(next.settlement.realms.realm_resources).toHaveLength(9);
  });
});

test("rejects missing bridge tokens before registration", () => {
  const previous = nativePresets[2]!.bridgeResources;
  nativePresets[2]!.bridgeResources = [37];
  try {
    for (const [mutation, error] of [
      [
        (config) => {
          delete (config.setup!.addresses as { resources?: unknown }).resources;
        },
        "Bridge resource tokens",
      ],
      [
        (config) => {
          config.setup!.addresses.lords = "0x0";
        },
        "Missing bridge token for resource 37",
      ],
    ] as Array<[(config: ReturnType<typeof configuration>) => void, string]>) {
      const config = configuration(2);
      mutation(config);
      expect(() => buildNativePreset(config, 2)).toThrow(error);
    }
  } finally {
    nativePresets[2]!.bridgeResources = previous;
  }
});
describe("fixed Regular Blitz rosters", () => {
  const target = {
    world: { address: "0x123", abi },
    native: {
      version: 2,
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  };
  const input = {
    gameName: "slot-1",
    presetId: 2,
    startMainAt: 2000000000,
    chainTimestamp: 1999999990,
    durationSeconds: 3600,
    devModeOn: false,
    singleRealmMode: false,
    useMapOverride: false,
  };
  test("a fixed-roster game is never created outside its closed slot", () => {
    expect(() => buildNativeGameParams(configuration(2), input)).toThrow("launch from a closed slot");
  });
  test("creation recovery reads the registrar without waiting for Herald", async () => {
    const callContract = mock(async () => ["0x7"]);
    const provider = { callContract } as unknown as RpcProvider;
    expect(await findRegistrarGame(provider, "free-slot-1", target as never)).toEqual({ gameId: 7 });
    expect(callContract.mock.calls).toHaveLength(1);
  });
});

describe("scaled Frontier presets", () => {
  test("all Frontier modes require the operator's duration and retain their own day unit", () => {
    for (const presetId of [FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID]) {
      const config = loadNativePresetConfiguration("madara.frontier", presetId);
      expect(config.season.durationSeconds).toBe(0);
      const durationSeconds = 40 * buildNativePreset(config, presetId).rules.day_unit_seconds;
      expect(
        applyDeploymentConfigOverrides(config, { startMainAt: 1800000000, factoryAddress: "", durationSeconds }).season
          .durationSeconds,
      ).toBe(durationSeconds);
    }
  });

  test("a preset's games run its release's day divided by the preset's clock scale", () => {
    for (const [presetId, dayUnit] of [
      [FRONTIER_PRESET_ID, 14_400],
      [FRONTIER_ACCELERATED_PRESET_ID, 120],
      [FRONTIER_FIXTURE_PRESET_ID, 14_400],
      [FRONTIER_PLAYGROUND_PRESET_ID, 14_400],
      [FRONTIER_REHEARSAL_PRESET_ID, 3_600],
    ]) {
      const release = buildNativePreset(loadNativePresetConfiguration("madara.frontier", presetId), presetId);
      expect(release.rules.day_unit_seconds).toBe(14_400);
      expect(seasonDayUnitSeconds(nativePresets[presetId]!)).toBe(dayUnit);
    }
  });

  test("rejects fractional, zero and inexact clock scales instead of rounding a contract boundary", () => {
    for (const scale of [0, -1, 1.5]) expect(() => clockScaled(120, scale, "tick")).toThrow("positive integer");
    expect(() => clockScaled(120, 7, "tick")).toThrow("tick 120 does not divide by clock scale 7");
    expect(clockScaled(0, 3, "unset duration")).toBe(0);
  });
});

describe("the 4x rehearsal beside Season 1", () => {
  const frontierInput = (presetId: number, devModeOn: boolean) => ({
    gameName: `speed-${presetId}`,
    presetId,
    startMainAt: 2_000_000_000,
    chainTimestamp: 1_999_999_990,
    durationSeconds: 200 * 3600,
    devModeOn,
    singleRealmMode: false,
    useMapOverride: false,
  });
  const params = (presetId: number, devModeOn: boolean) =>
    buildNativeGameParams(
      loadNativePresetConfiguration("madara.frontier", presetId),
      frontierInput(presetId, devModeOn),
    ) as { clock_scale: number };

  test("is Season 1 with one clock factor of 4, and Season 1 itself runs at 1", () => {
    const { clockScale, id, ...rehearsal } = nativePresets[FRONTIER_REHEARSAL_PRESET_ID]!;
    const { id: seasonOneId, ...seasonOne } = frontierSeasonOnePreset;
    expect([id, seasonOneId]).toEqual([FRONTIER_REHEARSAL_PRESET_ID, FRONTIER_S1_PRESET_ID]);
    expect(rehearsal).toEqual(seasonOne);
    expect(clockScale).toBe(4);
    expect(gameClockScale(nativePresets[FRONTIER_REHEARSAL_PRESET_ID]!)).toBe(4);
    expect(gameClockScale(frontierSeasonOnePreset)).toBe(1);
  });

  test("is never launched from the deployer CLI: the launch Worker creates it on staging", async () => {
    await expect(
      launchGame({
        manifest: {} as never,
        environmentId: "madara.frontier",
        gameName: "rehearsal-cli",
        startTime: 2_000_000_000,
        rpcUrl: "http://127.0.0.1:1",
        version: String(FRONTIER_REHEARSAL_PRESET_ID),
        devModeOn: true,
      }),
    ).rejects.toThrow("Preset 8 runs a scaled clock: the launch Worker creates it on staging");
  });

  test("creates a game at 4 only in dev mode, and a Season 1 game always at 1", () => {
    expect(params(FRONTIER_S1_PRESET_ID, false).clock_scale).toBe(1);
    expect(params(FRONTIER_S1_PRESET_ID, true).clock_scale).toBe(1);
    expect(params(FRONTIER_REHEARSAL_PRESET_ID, true).clock_scale).toBe(4);
    expect(() => params(FRONTIER_REHEARSAL_PRESET_ID, false)).toThrow("runs a scaled clock: dev mode only");
  });

  test("divides the release's durations and multiplies its rates by the scale, leaving the release itself whole", () => {
    const release = seasonOneReleaseDefinition();
    const fast = scaleGameClocks(release, 4);
    const wheat = (definition: typeof release) =>
      definition.resources.resources.find(({ resource_type }) => resource_type === ResourcesIds.Wheat)!.realm_rate;
    const workshop = (definition: typeof release) =>
      (definition.structures.board.unwrap() as { workshop_rate: bigint }).workshop_rate;
    expect(fast.rules.tick_config).toEqual({
      armies_tick_in_seconds: 30,
      delivery_tick_in_seconds: release.rules.tick_config.delivery_tick_in_seconds,
    });
    expect([fast.rules.day_unit_seconds, fast.rules.relic_seconds_per_rank]).toEqual([3600, 450]);
    expect([wheat(fast), workshop(fast)]).toEqual([wheat(release) * 4n, workshop(release) * 4n]);
    expect(fast.rules.troop_stamina_config).toEqual(release.rules.troop_stamina_config);
    expect(fast.economy).toEqual(release.economy);
    expect([release.rules.tick_config.armies_tick_in_seconds, release.rules.day_unit_seconds]).toEqual([120, 14_400]);
    expect(scaleGameClocks(release, 1)).toBe(release);
  });
});

describe("the Frontier playground preset", () => {
  const load = (id: number) => loadNativePresetConfiguration("madara.frontier", id);
  const definition = (id: number) => buildNativePreset(load(id), id);
  const whole = (amount: bigint) => Number(amount / BigInt(RESOURCE_PRECISION));

  test("plays Frontier under its own id, which the launcher never creates from", () => {
    expect(nativeGameModeOf(FRONTIER_PLAYGROUND_PRESET_ID)).toBe("frontier");
    expect(nativePresetIdFor("frontier")).toBe(FRONTIER_S1_PRESET_ID);
  });

  test("keeps Season 1's rules, clocks, depths, Deep and research prices in Essence; only its stock and labor prices differ", () => {
    const playground = definition(FRONTIER_PLAYGROUND_PRESET_ID);
    const season = definition(FRONTIER_S1_PRESET_ID);
    const frontier = definition(FRONTIER_PRESET_ID);
    expect(playground.rules).toEqual(season.rules);
    expect(playground.settlement.depths).toEqual(season.settlement.depths);
    expect(playground.economy.deep.unwrap()).toEqual(season.economy.deep.unwrap());
    expect(playground.structures.research.map(({ price }) => price.essence)).toEqual(
      season.structures.research.map(({ price }) => price.essence),
    );
    expect(playground.structures.research.every(({ price }) => price.labor === 0n)).toBe(true);
    expect(playground.structures.upgrades.map(({ costs }) => costs.map(({ amount }) => whole(amount)))).toEqual([
      [100],
      [100],
      [100],
    ]);
    expect(playground.structures.buildings.every(({ rule }) => rule.simple_cost.length === 0)).toBe(true);
    // Loading the playground leaves Frontier's own balance as it was.
    expect(frontier.settlement.realms.resources.map(({ amount }) => whole(amount))).toEqual([1_500, 4_500, 2_000]);
  });

  test("starts a realm with Essence for every research tier, Spire lore included, and its castle's stores full", () => {
    const playground = definition(FRONTIER_PLAYGROUND_PRESET_ID);
    const start = new Map(
      playground.settlement.realms.resources.map(({ resource_type, amount }) => [resource_type, whole(amount)]),
    );
    const essenceForEveryTier = playground.structures.research.reduce(
      (sum, { price }) => sum + whole(price.essence),
      0,
    );
    expect(start.get(ResourcesIds.Essence)).toBeGreaterThan(essenceForEveryTier);
    // A castle stores two full deploys of its level; a Settlement's stores hold what the realm starts with, no more.
    const config = load(FRONTIER_PLAYGROUND_PRESET_ID);
    const settlementStore =
      config.troop.limit.settlementDeploymentCap *
      nativePresets[FRONTIER_PLAYGROUND_PRESET_ID]!.board!.troopStoreDeploys;
    for (const resource of [ResourcesIds.Labor, ResourcesIds.Wheat, ResourcesIds.Knight])
      expect(start.get(resource)).toBe(settlementStore);
  });
});

test("Frontier discoveries use the approved narrow guard ranges at every depth", () => {
  const preset = buildNativePreset(
    loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
    FRONTIER_PRESET_ID,
  );
  expect(preset.economy.discovery.unwrap()).toMatchObject({ ruin_bps: 300 });
  expect(preset.settlement.depths.map((row) => [row.site_guard_lower, row.site_guard_upper])).toEqual([
    [1200, 1400],
    [2400, 2800],
    [4700, 5700],
    [9300, 11500],
  ]);
  for (const row of preset.settlement.depths) {
    expect(row).not.toHaveProperty("entry_stamina");
    for (const [lower, upper] of [
      [row.site_guard_lower, row.site_guard_upper],
      [row.rift_guard_lower, row.rift_guard_upper],
      [row.beast_weak_lower, row.beast_weak_upper],
      [row.beast_strong_lower, row.beast_strong_upper],
    ]) {
      expect(upper / lower).toBeLessThanOrEqual(1.25);
    }
  }
});

test("Season 1 and its check preset share the canonical Aspect mapping", () => {
  const season = seasonOneReleaseDefinition();
  expect(season.settlement.order_aspects).toEqual([1, 2, 3, 4, 4, 3, 4, 4, 1, 2, 2, 1, 1, 3, 3, 2]);
  expect(nativePresets[FRONTIER_FIXTURE_PRESET_ID]!.orderAspects).toEqual(season.settlement.order_aspects);
  expect(nativePresets[FRONTIER_PLAYGROUND_PRESET_ID]!.orderAspects).toEqual(season.settlement.order_aspects);
  expect(nativePresets[FRONTIER_REHEARSAL_PRESET_ID]!.orderAspects).toEqual(season.settlement.order_aspects);
  for (const preset of Object.values(nativePresets).filter(
    ({ id }) =>
      ![
        FRONTIER_S1_PRESET_ID,
        FRONTIER_FIXTURE_PRESET_ID,
        FRONTIER_PLAYGROUND_PRESET_ID,
        FRONTIER_REHEARSAL_PRESET_ID,
      ].includes(id),
  ))
    expect(preset.orderAspects).toEqual([]);
});

const deepFixture = () => structuredClone(frontierSeasonOnePreset.deep);

test("an optional Deep preset serializes its rings, its beasts in kind order and resource precision", () => {
  const source = nativePresets[FRONTIER_FIXTURE_PRESET_ID]!;
  const previous = source.deep;
  try {
    const deep = deepFixture();
    source.deep = deep;
    const built = buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id);
    const scaled = (amount: number) => BigInt(amount) * BigInt(RESOURCE_PRECISION);
    expect(built.economy.deep.unwrap()).toEqual({
      gate_distance: deep.gateDistance,
      rings: deep.rings,
      beasts: deepSites.map(({ key }) => ({ count: scaled(deep.beasts[key].count), bow: deep.beasts[key].bow })),
      loss_per_tick: scaled(deep.lossPerTick),
      core_per_tick: scaled(deep.corePerTick),
      mine_per_tick: scaled(deep.minePerTick),
      building_pay: deep.buildingPay,
      altar_threshold: deep.altarThreshold,
    });
  } finally {
    source.deep = previous;
  }
});

test("the Deep codec refuses fractional or empty amounts", () => {
  const source = nativePresets[FRONTIER_FIXTURE_PRESET_ID]!;
  const previous = source.deep;
  const fixture = deepFixture();
  const malformed = [
    { ...fixture, beasts: { ...fixture.beasts, core: { count: 0, bow: true } } },
    { ...fixture, rings: [{ radius: 0, realms: 0 }] },
    { ...fixture, gateDistance: 0 },
    { ...fixture, lossPerTick: 0.5 },
    { ...fixture, corePerTick: 0 },
    { ...fixture, buildingPay: { alone: 6, pair: 3, crowd: 0 } },
    { ...fixture, buildingPay: { alone: 6, pair: 7, crowd: 2 } },
    { ...fixture, buildingPay: { alone: 6, pair: 3, crowd: 2.5 } },
    { ...fixture, altarThreshold: 0 },
  ];
  try {
    for (const deep of malformed) {
      source.deep = deep;
      expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow(
        "Invalid Deep",
      );
    }
  } finally {
    source.deep = previous;
  }
});

const questFixture = () => ({ baseCounts: [1, 1, 1, 1, 1, 2, 15], labor: 1000, essence: 1500, bonusPercent: 150 });

test("the daily quest codec replaces legacy labor and preserves whole reward units", () => {
  const source = nativePresets[FRONTIER_FIXTURE_PRESET_ID]!;
  const previous = { dailyQuest: source.dailyQuest, labor: source.labor };
  try {
    source.dailyQuest = questFixture();
    expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow(
      "replace labor",
    );
    source.labor = null;
    const built = buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id);
    expect(built.economy.labor.isNone()).toBe(true);
    expect(built.economy.quests.unwrap()).toEqual({
      base_counts: [1, 1, 1, 1, 1, 2, 15],
      labor: 1000n,
      essence: 1500n,
      bonus_percent: 150,
    });
    for (const invalid of [
      { ...questFixture(), baseCounts: [1] },
      { ...questFixture(), baseCounts: [1, 1, 1, 0, 1, 2, 15] },
      { ...questFixture(), baseCounts: [1, 1, 1, 1, 1, 2, 0x1_0000_0000] },
      { ...questFixture(), labor: 0 },
      { ...questFixture(), essence: 0.5 },
      { ...questFixture(), bonusPercent: 99 },
      { ...questFixture(), bonusPercent: 0x1_0000 },
    ]) {
      source.dailyQuest = invalid;
      expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow(
        "Invalid daily quest",
      );
    }
  } finally {
    Object.assign(source, previous);
  }
});

const baneFixture = () => ({
  quietDays: 3,
  chanceStep: 10,
  quorumPercent: 25,
  beastPercent: 150,
  staminaPercent: 50,
  productionPercent: 50,
  questCounts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
});

test("the bane codec preserves whole quest units and refuses invalid effects", () => {
  const source = nativePresets[FRONTIER_FIXTURE_PRESET_ID]!;
  const previous = { banes: source.banes, dailyQuest: source.dailyQuest, labor: source.labor };
  try {
    source.banes = baneFixture();
    expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow(
      "Banes require daily quests",
    );
    source.dailyQuest = questFixture();
    source.labor = null;
    const built = buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id);
    expect(built.economy.banes.unwrap()).toEqual({
      chance_step: 10,
      quorum_percent: 25,
      beast_percent: 150,
      stamina_percent: 50,
      production_percent: 50,
      quest_counts: [3n, 6n, 9n, 12n, 20n, 40n, 60n, 80n, 2500n, 6000n, 10000n, 15000n],
    });
    for (const invalid of [
      { ...baneFixture(), chanceStep: 0 },
      { ...baneFixture(), chanceStep: 101 },
      { ...baneFixture(), quorumPercent: 0 },
      { ...baneFixture(), quorumPercent: 101 },
      { ...baneFixture(), beastPercent: 99 },
      { ...baneFixture(), beastPercent: 0x1_0000 },
      { ...baneFixture(), staminaPercent: 0 },
      { ...baneFixture(), staminaPercent: 101 },
      { ...baneFixture(), productionPercent: 0 },
      { ...baneFixture(), productionPercent: 101 },
      { ...baneFixture(), chanceStep: 0.5 },
      { ...baneFixture(), questCounts: [3] },
      { ...baneFixture(), questCounts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 0] },
      { ...baneFixture(), questCounts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 0.5] },
    ]) {
      source.banes = invalid;
      expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow(
        "Invalid bane",
      );
    }
  } finally {
    Object.assign(source, previous);
  }
});

const raceFixture = (): NonNullable<(typeof nativePresets)[number]["race"]> => ({
  seasonDays: 50,
  stageHeight: 2_000,
  clearMistPercent: 200,
  secondWindPercent: 200,
  paleMoonPercent: 50,
  spoilsPercent: 200,
});

test("the race codec preserves its season length, stages and Triumph rates", () => {
  const source = nativePresets[FRONTIER_FIXTURE_PRESET_ID]!;
  const previous = { race: source.race, deep: source.deep };
  try {
    source.race = raceFixture();
    source.deep = deepFixture();
    const built = buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id);
    expect(built.economy.race.unwrap()).toEqual({
      season_days: 50n,
      stage_height: 2_000,
      clear_mist_percent: 200,
      second_wind_percent: 200,
      pale_moon_percent: 50,
      spoils_percent: 200,
    });
  } finally {
    Object.assign(source, previous);
  }
});

test("the race codec refuses missing Deep rules, malformed amounts and effects", () => {
  const source = nativePresets[FRONTIER_FIXTURE_PRESET_ID]!;
  const previous = { race: source.race, deep: source.deep };
  const malformed = [
    { ...raceFixture(), seasonDays: 0 },
    { ...raceFixture(), seasonDays: 49 },
    { ...raceFixture(), stageHeight: 5 },
    { ...raceFixture(), stageHeight: 0xffff_ffff },
    { ...raceFixture(), clearMistPercent: 99 },
    { ...raceFixture(), secondWindPercent: 201 },
    { ...raceFixture(), paleMoonPercent: 0 },
    { ...raceFixture(), spoilsPercent: 99 },
  ] satisfies NonNullable<(typeof nativePresets)[number]["race"]>[];
  try {
    source.race = raceFixture();
    source.deep = null;
    expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow(
      "Race requires the Deep",
    );
    source.deep = deepFixture();
    for (const race of malformed) {
      source.race = race;
      expect(() => buildNativePreset(loadNativePresetConfiguration("madara.frontier", source.id), source.id)).toThrow();
    }
  } finally {
    Object.assign(source, previous);
  }
});

test("the release's discovery must fit one draw under Clear Mist", () => {
  const source = nativePresets[FRONTIER_S1_PRESET_ID]!;
  const previous = source.discovery;
  const modules = () => balanceModules(seasonOneReleaseDefinition());
  try {
    expect(modules).not.toThrow();
    source.discovery = { ...previous!, beastsBps: 4000 };
    expect(modules).toThrow("Season 1 discovery under Clear Mist exceeds one hundred percent");
  } finally {
    source.discovery = previous;
  }
});

test("preset 7 activates the complete Slice 1 rules while fixtures and historical definitions stay isolated", () => {
  for (const source of Object.values(nativePresets)) {
    const environment = source.gameType === "blitz" ? "madara.blitz" : "madara.frontier";
    const built = buildNativePreset(loadNativePresetConfiguration(environment, source.id), source.id);
    const active = source.id === FRONTIER_S1_PRESET_ID;
    const followsSeason =
      active || source.id === FRONTIER_PLAYGROUND_PRESET_ID || source.id === FRONTIER_REHEARSAL_PRESET_ID;
    const seasonShaped = followsSeason || source.id === FRONTIER_FIXTURE_PRESET_ID;
    for (const name of ["deep", "race"] as const) expect(built.economy[name].isSome()).toBe(seasonShaped);
    for (const name of ["quests", "banes"] as const) expect(built.economy[name].isSome()).toBe(followsSeason);
    if (!active) continue;
    expect(source.dailyQuest).toEqual(questFixture());
    expect(source.banes).toEqual(baneFixture());
    expect(source.deep).toEqual(deepFixture());
    expect(source.race).toEqual(raceFixture());
    expect(built.economy.labor.isNone()).toBe(true);
    for (const command of ["ClaimDailyQuest", "BattleGuard", "ApplyRelic", "InteractSite", "MarkGameSettled"] as const)
      expect(built.rules.command_mask & BigInt(nativeCommandBits[command])).not.toBe(0n);
    expect(built.rules.command_mask & BigInt(nativeCommandBits.Battle)).toBe(0n);
    expect(built.rules.troop_stamina_config).toMatchObject({
      stamina_initial: 180,
      stamina_knight_max: 180,
      stamina_crossbowman_max: 180,
      stamina_paladin_max: 180,
      stamina_defense_req: 0,
    });
    expect(built.rules.troop_limit_config.explore_reward_strength_cap).toBe(10000);
    const scouts = built.resources.production.find(({ resource_type }) => resource_type === 32)!.recipe;
    expect(scouts.simple_inputs).toEqual([{ resource_type: 35, amount: 2_000_000_000n }]);
    expect(scouts.simple_output).toBe(1_000_000_000n);
    expect((Number(scouts.complex_output) * 3600) / 1e9).toBeCloseTo(100, 5);
    expect(built.structures.buildings.find(({ category }) => category === 43)!.rule.simple_cost).toEqual([
      { resource_type: 23, amount: 500_000_000_000n },
    ]);
    expect(
      built.settlement.depths.map((row) => [
        row.beast_weak_lower,
        row.beast_weak_upper,
        row.beast_strong_lower,
        row.beast_strong_upper,
      ]),
    ).toEqual([
      [315, 385, 405, 495],
      [630, 770, 810, 990],
      [1260, 1540, 1620, 1980],
    ]);
    expect(built.settlement.depths.map((row) => [row.site_guard_lower, row.site_guard_upper, row.guard_step])).toEqual([
      [1170, 1430, 10],
      [2340, 2860, 10],
      [4680, 5720, 10],
    ]);
    expect(built.settlement.depths.map((row) => [row.rift_guard_lower, row.rift_guard_upper])).toEqual([
      [1350, 1650],
      [2700, 3300],
      [5400, 6600],
    ]);
    expect(
      built.settlement.depths.map(({ chest }) => [
        chest.common,
        chest.uncommon,
        chest.rare,
        chest.epic,
        chest.legendary,
      ]),
    ).toEqual([
      [6000, 3000, 1000, 0, 0],
      [0, 6000, 3000, 1000, 0],
      [0, 0, 6000, 3000, 1000],
    ]);
  }
});

test("the Blitz balance holds its own switches and spacing, and none of the tables only the Frontier reads", () => {
  const modules = blitzBalanceModules(blitzReleaseDefinition());
  expect(Object.keys(modules)).toEqual(["resources", "structures", "rules", "settlement", "points", "exploration"]);
  expect(modules.points).toContain(`pub const EXPLORE_POINTS: u128 = ${blitzPointRules().explore_points};`);
  expect(modules.points).toContain(`pub const CAPTURE_POINTS: u128 = ${blitzPointRules().capture_points};`);
  expect(modules.points).toContain(
    `pub const HYPERSTRUCTURE_CAPTURE_POINTS: u128 = ${blitzPointRules().hyperstructure_capture_points};`,
  );
  expect(modules.points).toContain(
    `pub const HOLD_POINTS_PER_SECOND: u128 = ${blitzPointRules().hold_points_per_second};`,
  );
  expect(modules.exploration).toContain(`EXPLORATION_REWARDS: [ExplorationReward; ${blitzExplorationRewards.length}]`);
  expect(modules.rules).toContain("day_unit_seconds: 0");
  expect(modules.rules).toContain("entry_rule: 2");
  expect(modules.rules).toContain(`pub const PENDING_COMMANDS: u128 = ${blitzPendingCommandMask};`);
  expect(modules.settlement).toContain("pub const SETTLEMENT_SPACING_STEPS: u32 = 6;");
  for (const absent of ["BOARD", "LABOR_STORES", "RESEARCH_PRICES"]) expect(modules.structures).not.toContain(absent);
  for (const absent of ["ORDER_ASPECTS", "STARTING_TROOPS"]) expect(modules.settlement).not.toContain(absent);
});

test("the Blitz balance refuses the Frontier's definition", () => {
  expect(() => blitzBalanceModules(seasonOneReleaseDefinition())).toThrow("Blitz has no realm board and no research");
});
