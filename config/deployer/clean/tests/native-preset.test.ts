import { blitzRosterOf, findRegistrarGame } from "../registrar/calls";
import { afterAll, describe, expect, test, mock } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CallData, type Account, type RpcProvider } from "starknet";
import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import {
  nativeResearchConstants as research,
  nativeRuleConstants,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { applyDeploymentConfigOverrides } from "../config/config-loader";
import { buildNativePreset } from "../config/native-preset";
import {
  FRONTIER_ACCELERATED_PRESET_ID,
  FRONTIER_PRESET_ID,
  nativeGameModeOf,
} from "../../../source/common/native-preset-modes";
import {
  buildNativePresetRegistration,
  registerNativePreset,
  buildNativeGameParams,
  loadNativePresetConfiguration,
} from "../registrar/native-preset";

const abi = [...Object.values(schema.types), ...schema.games.entrypoints];
const codec = new CallData(abi);
const directory = mkdtempSync(join(tmpdir(), "native-preset-"));
const manifestPath = join(directory, "manifest.json");
writeFileSync(
  manifestPath,
  JSON.stringify({
    world: { address: "0x123", abi },
    abis: abi,
    contracts: [{ address: "0x123", class_hash: "0x456" }],
    native: {
      version: 2,
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  }),
);
afterAll(() => rmSync(directory, { recursive: true }));

function configuration(preset: number) {
  const config = loadNativePresetConfiguration(preset === 3 ? "madara.eternum" : "madara.blitz", preset);
  return config;
}

describe("native presets", () => {
  test("Frontier owns the 90/10 chest split, whole LORDS table and a season of 21 bags of days", () => {
    const config = loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID);
    const preset = buildNativePreset(config, FRONTIER_PRESET_ID);
    expect(preset.economy.chests.unwrap()).toEqual({
      relic_probability: 9000,
      token_cap: 1,
      lords_amounts: { common: 100n, uncommon: 400n, rare: 1500n, epic: 6000n },
      lords_pool: 1000000n,
    });
    // Four-hour units, 20 to a bag: 1,680 hours, ten weeks.
    expect(preset.rules.day_unit_seconds).toBe(14_400);
    expect(config.season.durationSeconds).toBe(10 * 7 * 86_400);
    expect(preset.economy.chests.unwrap()).not.toHaveProperty("cosmetic_probability");
  });

  test("every preset supplies its cooldown explicitly, independent of the stamina clock", () => {
    for (const [network, id, expected] of [
      ["madara.frontier", 5, 0],
      ["madara.blitz", 2, 60],
      ["madara.eternum", 3, 60],
      ["madara.blitz", 4, 60],
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

  test("the contract Frontier command gate uses the published mask", () => {
    const preset = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const mask = BigInt(
      readFileSync(
        new URL("../../../../contracts/l3/world-native/tests/fixtures/frontier-command-mask.txt", import.meta.url),
        "utf8",
      ).trim(),
    );
    expect(preset.rules.command_mask).toBe(mask);
    expect(mask & BigInt(nativeCommandBits.InteractSite)).not.toBe(0n);
    for (const [network, id] of [
      ["madara.blitz", 2],
      ["madara.eternum", 3],
    ] as const) {
      const legacy = buildNativePreset(loadNativePresetConfiguration(network, id), id);
      expect(legacy.rules.command_mask & BigInt(nativeCommandBits.InteractSite)).toBe(0n);
    }
    for (const command of [
      "CreateTradeOrder",
      "AcceptTradeOrder",
      "CancelTradeOrder",
      "BuyFromBank",
      "SellToBank",
      "AddBankLiquidity",
      "RemoveBankLiquidity",
      "SendResources",
      "TransferStructureResourcesToExplorer",
      "TransferExplorerResourcesToStructure",
      "WithdrawResource",
    ] as const)
      expect(mask & BigInt(nativeCommandBits[command])).toBe(0n);
  });
  test("the accelerated Frontier preset is Frontier with every season clock 120 times faster, under its own id", () => {
    const canonical = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const accelerated = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_ACCELERATED_PRESET_ID),
      FRONTIER_ACCELERATED_PRESET_ID,
    );

    expect(canonical.rules.day_unit_seconds).toBe(14_400);
    expect(accelerated.rules.day_unit_seconds).toBe(120);
    expect(accelerated.rules.tick_config.armies_tick_in_seconds).toBe(
      canonical.rules.tick_config.armies_tick_in_seconds / 120,
    );
    expect(accelerated.resources.resources.map(({ realm_rate }) => realm_rate)).toEqual(
      canonical.resources.resources.map(({ realm_rate }) => realm_rate * 120n),
    );
    expect(
      buildNativePresetRegistration(accelerated, FRONTIER_ACCELERATED_PRESET_ID, manifestPath).commitment,
    ).not.toBe(buildNativePresetRegistration(canonical, FRONTIER_PRESET_ID, manifestPath).commitment);
  });

  test("Frontier replaces the supply pool with depth reveal percentages", () => {
    for (const id of [FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID]) {
      const generated = loadNativePresetConfiguration("madara.frontier", id);
      expect(generated.blitz.exploration.rewards).toEqual([]);
      const preset = buildNativePreset(generated, id);
      expect(preset.exploration).toEqual([]);
      expect(preset.settlement.depths.map(({ reveal_percent }) => reveal_percent)).toEqual([10, 15, 20, 25]);
    }
    for (const id of [2, 3, 4]) expect(buildNativePreset(configuration(id), id).exploration.length).toBeGreaterThan(0);
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
      [`${research.ROW_FARM}:1`]: [1000n, 1000n],
      [`${research.ROW_FARM}:4`]: [30000n, 20000n],
      [`${research.ROW_WORKSHOP}:2`]: [8000n, 6000n],
      [`${research.ROW_BARRACKS}:3`]: [48000n, 24000n],
      [`${research.ROW_HUT}:4`]: [15000n, 10000n],
      [`${research.ROW_WAR_HALL}:1`]: [12000n, 3000n],
      [`${research.ROW_HEARTH}:4`]: [360000n, 60000n],
      [`${research.ROW_SHRINE}:1`]: [2000n, 0n],
      [`${research.ROW_WELL}:1`]: [6000n, 0n],
      [`${research.ROW_DEPTH}:1`]: [160000n, 0n],
      [`${research.ROW_DEPTH}:2`]: [400000n, 0n],
      [`${research.ROW_DEPTH}:3`]: [900000n, 0n],
    });
    expect(preset.structures.board.unwrap()).toMatchObject({
      output_step_bps: 2500,
      storage_step_bps: 5000,
      population_step_bps: 2500,
      ration_step: precision / 4n,
      training_gate_tier: 2,
      castle_store_deploys: 2,
    });
    expect(preset.structures.buildings).toHaveLength(research.HEARTH);
    for (const category of [research.WAR_HALL, research.SUPPLY_YARD, research.SCOUTS_LODGE, research.HEARTH]) {
      const rule = preset.structures.buildings.find((row) => row.category === category)!.rule;
      expect([rule.population_cost, rule.simple_cost]).toEqual([2, [{ resource_type: 23, amount: 3000n * precision }]]);
    }
    for (const category of [31, 34]) {
      const rule = preset.structures.buildings.find((row) => row.category === category)!.rule;
      expect(rule.simple_cost).toEqual([]);
      expect(rule.complex_cost).toEqual([]);
    }
    expect(preset.rules.building_config.base_cost_percent_increase).toBe(10000);
    expect(preset.structures.board.unwrap()).not.toHaveProperty("neighbors");
    for (const depth of preset.settlement.depths) expect(depth).not.toHaveProperty("attunement_cost");
  });

  test("A camp's labor rate is its own rule, at the rate it read from the village before", () => {
    for (const id of [2, 3, 4]) {
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
      stragglers_bps: 600,
      camp_bps: 400,
      rift_bps: 400,
      ruin_bps: 100,
      shrine_bps: 300,
      well_bps: 300,
      empty_reveal_limit: 7,
    });
    expect(preset.economy.chests.unwrap()).not.toHaveProperty("loose_one_in");
    expect(preset.rules.map_config.camp_win_probability).toBe(0);
    expect(preset.rules.map_config.shards_mines_win_probability).toBe(0);
    expect(
      preset.settlement.depths.map((depth) => [
        depth.site_guard_lower,
        depth.site_guard_upper,
        depth.ruin_guard_lower,
        depth.ruin_guard_upper,
        depth.guard_step,
      ]),
    ).toEqual([
      [1000, 1600, 2000, 4000, 100],
      [3000, 5000, 6000, 10500, 100],
      [8000, 12000, 18000, 22500, 100],
      [20000, 30000, 52500, 76000, 100],
    ]);
    for (const depth of preset.settlement.depths) {
      expect(depth.site_guard_lower).toBeLessThanOrEqual(depth.site_guard_upper);
      expect(depth.ruin_guard_lower).toBeLessThanOrEqual(depth.ruin_guard_upper);
      for (const bound of [
        depth.site_guard_lower,
        depth.site_guard_upper,
        depth.ruin_guard_lower,
        depth.ruin_guard_upper,
      ])
        expect(bound % depth.guard_step).toBe(0);
    }
  });

  test("Blitz and Duel carry no labor-paid production, while Frontier trains troops and Eternum keeps its labor path", () => {
    const laborPaid = (environment: Parameters<typeof loadNativePresetConfiguration>[0], presetId: number) =>
      buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId)
        .resources.production.filter(({ recipe }) => recipe.simple_inputs.length > 0)
        .map(({ resource_type }) => resource_type);

    expect(laborPaid("madara.blitz", 2)).toEqual([]);
    expect(laborPaid("madara.blitz", 4)).toEqual([]);
    expect(laborPaid("madara.frontier", FRONTIER_PRESET_ID)).toEqual([26]);
    expect(laborPaid("madara.eternum", 3).length).toBeGreaterThan(0);
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

  test("Frontier disables both dice rules while Blitz, Eternum and Duel preserve Ethereal dice", () => {
    const diceRules = (environment: Parameters<typeof loadNativePresetConfiguration>[0], presetId: number) => {
      const mask = buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId).rules.mode_rules;
      return [(mask & nativeRuleConstants.COMBAT_DICE) !== 0, (mask & nativeRuleConstants.COMBAT_DICE_ETHEREAL) !== 0];
    };

    expect(diceRules("madara.frontier", FRONTIER_PRESET_ID)).toEqual([false, false]);
    expect(diceRules("madara.blitz", 2)).toEqual([false, true]);
    expect(diceRules("madara.eternum", 3)).toEqual([false, true]);
    expect(diceRules("madara.blitz", 4)).toEqual([false, true]);
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
      stamina_explore_stamina_cost: 30,
      stamina_travel_stamina_cost: 10,
      stamina_attack_req: 30,
      capture_stamina_refund: 0,
      stamina_initial: 150,
    });
    expect(design.economy.relics).toEqual([]);
    expect(design.economy.progression.unwrap()).toEqual({
      reveal_xp: 2,
      fixed_xp: 200,
      uncommon_xp: 100,
      rare_xp: 200,
      epic_xp: 400,
      legendary_xp: 800,
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
    for (const resource of [27, 28, 29, 30, 31, 32, 33, 34]) {
      const production = design.resources.production.find(({ resource_type }) => resource_type === resource)!;
      expect(production.recipe.simple_inputs).toEqual([]);
      expect(production.recipe.simple_output).toBe(0n);
    }
    // A Labor building a player builds costs 2 population; the castle the world places at founding costs none.
    expect(design.structures.buildings.find(({ category }) => category === 25)?.rule.population_cost).toBe(2);
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
    expect([1, 2, 3, 4, FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID, 102].map(nativeGameModeOf)).toEqual([
      "frontier",
      "blitz",
      "eternum",
      "duel",
      "frontier",
      "frontier",
      "frontier",
    ]);
    expect(() => nativeGameModeOf(9)).toThrow("Unknown native preset 9");
    expect(() => nativeGameModeOf(103)).toThrow("Unknown native preset 103");
  });

  test("native balances and mine ladders come only from the selected sheet", () => {
    const config = configuration(3);
    config.bitcoin = { prizePerPhase: 7, minimumLabor: 123, ownerCutBps: 1500 };
    config.mines!.kinds[1] = {
      resourceType: 38,
      buildingCategory: 39,
      productionRate: 9,
      capMinimum: 400,
      capSteps: 3,
    };
    config.mines!.surfacePool = [{ kind: 1, weight: 4 }];
    const definition = buildNativePreset(config, 3);
    expect(definition.rules.bitcoin_mine_config).toEqual({
      enabled: true,
      prize_per_phase: 7_000000000n,
      min_labor_per_contribution: 123_000000000n,
      owner_cut_bps: 1500,
    });
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
    const config = configuration(3);
    delete config.bitcoin;
    expect(() => buildNativePreset(config, 3)).toThrow("Bitcoin balance config");
    config.bitcoin = configuration(3).bitcoin;
    delete config.mines;
    expect(() => buildNativePreset(config, 3)).toThrow("Mine balance config");
    config.mines = configuration(3).mines;
    config.mines!.surfacePool = [{ kind: 99, weight: 1 }];
    expect(() => buildNativePreset(config, 3)).toThrow("Invalid mine pool");
    config.mines!.surfacePool = [];
    expect(() => buildNativePreset(config, 3)).toThrow("requires a pool");
  });

  test("large resource amounts retain bigint precision and missing balance entries fail", () => {
    const config = configuration(3);
    expect(buildNativePreset(config, 3).economy.hyperstructures.initialize_shards).toBe(20_000_000_000000000n);
    delete (config.resources.resourceWeightsGrams as Partial<Record<number, number>>)[3];
    expect(() => buildNativePreset(config, 3)).toThrow("Missing resource weight for 3");
  });

  test("building a changed preset cannot mutate the next definition's tables", () => {
    const first = buildNativePreset(configuration(3), 3);
    first.settlement.villages.resource_pool[0].weight = 1;
    first.economy.relics[0].rate_bps = 1;
    first.settlement.realms.realm_resources.length = 0;
    const next = buildNativePreset(configuration(3), 3);
    expect(next.settlement.villages.resource_pool[0].weight).toBe(19815);
    expect(next.economy.relics[0].rate_bps).toBe(5000);
    expect(next.settlement.realms.realm_resources).toHaveLength(9);
  });

  test("registration reads the current commitment and refuses a registered id locally", async () => {
    const registration = buildNativePresetRegistration(buildNativePreset(configuration(3), 3), 1, manifestPath);
    let commitment = registration.commitment;
    const account = {
      getBlockNumber: async () => 10,
      getClassHashAt: async () => "0x456",
      callContract: async () => [commitment],
      execute: async () => {
        throw new Error("registration submitted");
      },
    } as unknown as Account;
    expect(await registerNativePreset(account, 1, registration)).toBeNull();
    commitment = "0x1";
    await expect(registerNativePreset(account, 1, registration)).rejects.toThrow(
      "Preset 1 is registered with commitment 0x1",
    );
    commitment = "0x0";
    await expect(registerNativePreset(account, 1, registration)).rejects.toThrow("registration submitted");
  });

  test("a stale manifest cannot register through a replaced registrar", async () => {
    const registration = buildNativePresetRegistration(buildNativePreset(configuration(2), 2), 2, manifestPath);
    const account = {
      getBlockNumber: async () => 10,
      getClassHashAt: async () => "0x999",
      callContract: async () => {
        throw new Error("unexpected view");
      },
    } as unknown as Account;
    await expect(registerNativePreset(account, 2, registration)).rejects.toThrow("differs from manifest");
  });
});

test("rejects missing Eternum rules and bridge tokens before registration", () => {
  for (const [mutation, error] of [
    [
      (config) => {
        delete config.faith;
      },
      "Native faith config is required",
    ],
    [
      (config) => {
        delete config.artificer;
      },
      "Native research cost",
    ],
    [
      (config) => {
        delete (config.setup!.addresses as { resources?: unknown }).resources;
      },
      "Eternum bridge resource tokens",
    ],
    [
      (config) => {
        config.setup!.addresses.lords = "0x0";
      },
      "Missing bridge token for resource 37",
    ],
  ] as Array<[(config: ReturnType<typeof configuration>) => void, string]>) {
    const config = configuration(3);
    mutation(config);
    expect(() => buildNativePreset(config, 3)).toThrow(error);
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
    gameName: "free-slot-1",
    presetId: 2,
    startMainAt: 2000000000,
    chainTimestamp: 1999999990,
    durationSeconds: 3600,
    devModeOn: false,
    singleRealmMode: false,
    twoPlayerMode: false,
    useMapOverride: false,
  };
  test("creation requires the frozen roster and never enables Duel or dev mode", () => {
    const config = configuration(2);
    const players = [{ owner: "0xabc", account: "0xdef" }];
    expect(() => buildNativeGameParams(config, input)).toThrow("fixed roster");
    expect(() => buildNativeGameParams(config, input, Array(25).fill(players[0]))).toThrow("fixed roster");
    expect(() => buildNativeGameParams(config, { ...input, twoPlayerMode: true }, players)).toThrow(
      "Settlement layout",
    );
    expect(() => buildNativeGameParams(config, { ...input, devModeOn: true }, players)).toThrow("development mode");
    expect(buildNativeGameParams(config, input, players).roster).toEqual(players);
  });
  test("a roster is its players' accounts in registration order, each once", () => {
    expect(blitzRosterOf(["0x02", "0x1"])).toEqual([{ account: "0x2" }, { account: "0x1" }]);
    expect(() => blitzRosterOf(["0x01", "0x1"])).toThrow("Duplicate");
    expect(() => blitzRosterOf(["0x0"])).toThrow("Invalid");
    expect(() => blitzRosterOf([])).toThrow("1 to 24");
  });
  test("creation recovery reads the registrar without waiting for Herald", async () => {
    const callContract = mock(async () => ["0x7"]);
    const provider = { callContract } as unknown as RpcProvider;
    expect(await findRegistrarGame(provider, "free-slot-1", target as never)).toEqual({ gameId: 7 });
    expect(callContract.mock.calls).toHaveLength(1);
  });
});

describe("scaled Frontier presets", () => {
  const launchedSeconds = (presetId: number) =>
    applyDeploymentConfigOverrides(loadNativePresetConfiguration("madara.frontier", presetId), {
      startMainAt: 1_800_000_000,
      factoryAddress: "",
    }).season.durationSeconds;
  const dayUnitSeconds = (presetId: number) =>
    buildNativePreset(loadNativePresetConfiguration("madara.frontier", presetId), presetId).rules.day_unit_seconds;

  test("an accelerated launch lasts 21 bags of its 120 s units: 14 hours", () => {
    expect(dayUnitSeconds(FRONTIER_ACCELERATED_PRESET_ID)).toBe(120);
    expect(launchedSeconds(FRONTIER_ACCELERATED_PRESET_ID)).toBe(14 * 3_600);
    expect(launchedSeconds(FRONTIER_PRESET_ID)).toBe(10 * 7 * 86_400);
  });

  test("every scaled preset keeps its mode's season length in day units", () => {
    const units = launchedSeconds(FRONTIER_PRESET_ID) / dayUnitSeconds(FRONTIER_PRESET_ID);
    expect(launchedSeconds(FRONTIER_ACCELERATED_PRESET_ID) / dayUnitSeconds(FRONTIER_ACCELERATED_PRESET_ID)).toBe(
      units,
    );
  });
});
