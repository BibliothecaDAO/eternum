import { blitzRosterOf, findRegistrarGame } from "../registrar/calls";
import { afterAll, describe, expect, test, mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CallData, type Account, type RpcProvider } from "starknet";
import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import { buildNativePreset } from "../config/native-preset";
import {
  FRONTIER_ACCELERATED_PRESET_ID,
  FRONTIER_PLAYTEST_PRESET_ID,
  FRONTIER_PRESET_ID,
  nativeGameModeOf,
} from "../../../source/common/native-preset-modes";
import {
  buildNativePresetRegistration,
  registerNativePreset,
  buildNativeGameParams,
  loadNativePresetConfiguration,
} from "../registrar/native-preset";

const abi = [...Object.values(schema.types), ...schema.domains.registry.entrypoints];
const codec = new CallData(abi);
const directory = mkdtempSync(join(tmpdir(), "native-preset-"));
const manifestPath = join(directory, "manifest.json");
writeFileSync(
  manifestPath,
  JSON.stringify({
    abis: abi,
    contracts: [{ address: "0x123", class_hash: "0x456" }],
    native: {
      domains: { registry: { address: "0x123" } },
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
  test("the accelerated Frontier preset is Frontier with every season clock 120 times faster, under its own id", () => {
    const canonical = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const accelerated = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_ACCELERATED_PRESET_ID),
      FRONTIER_ACCELERATED_PRESET_ID,
    );

    expect(canonical.rules.epoch_seconds).toBe(86_400);
    expect(accelerated.rules.epoch_seconds).toBe(720);
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

  test("the playtest preset is Frontier's design compressed exactly 24 times: days, army tick and every rate", () => {
    const design = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const playtest = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PLAYTEST_PRESET_ID),
      FRONTIER_PLAYTEST_PRESET_ID,
    );
    const board = (preset: typeof design) => preset.structures.board.unwrap() as { workshop_rate: bigint };

    expect(playtest.rules.epoch_seconds).toBe(3_600);
    expect(playtest.rules.epoch_seconds * 24).toBe(design.rules.epoch_seconds);
    expect(playtest.rules.tick_config.armies_tick_in_seconds).toBe(150);
    expect(playtest.rules.tick_config.armies_tick_in_seconds * 24).toBe(
      design.rules.tick_config.armies_tick_in_seconds,
    );
    expect(playtest.resources.resources).toEqual(
      design.resources.resources.map((resource) => ({
        ...resource,
        realm_rate: resource.realm_rate * 24n,
        village_rate: resource.village_rate * 24n,
      })),
    );
    expect(board(playtest).workshop_rate).toBe(board(design).workshop_rate * 24n);
    expect(playtest.settlement.depths.map(({ mine_rate }) => mine_rate)).toEqual(
      design.settlement.depths.map(({ mine_rate }) => mine_rate * 24n),
    );
    expect(playtest.resources.mine_kinds.map(({ config }) => config.production_rate)).toEqual(
      design.resources.mine_kinds.map(({ config }) => config.production_rate * 24n),
    );
    // Stamina is paid per tick, so a 24 times faster tick is a 24 times faster regen with the same numbers.
    expect(playtest.rules.troop_stamina_config).toEqual(design.rules.troop_stamina_config);
    expect(playtest.settlement.realms).toEqual(design.settlement.realms);
  });

  test("Frontier's design preset carries the owner's balance: hourly stamina, a lean grant, slower barracks and farms", () => {
    const design = buildNativePreset(
      loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID),
      FRONTIER_PRESET_ID,
    );
    const perHour = (resource: number) =>
      (design.resources.resources.find(({ resource_type }) => resource_type === resource)!.realm_rate * 3600n) /
      1_000_000_000n;

    expect(design.rules.tick_config.armies_tick_in_seconds).toBe(3600);
    expect(design.rules.troop_stamina_config).toMatchObject({
      stamina_gain_per_tick: 30,
      capture_stamina_refund: 0,
      stamina_initial: 150,
    });
    expect(design.settlement.realms.resources).toEqual([
      { resource_type: 26, amount: 1_500_000_000_000n },
      { resource_type: 35, amount: 1_000_000_000_000n },
      { resource_type: 23, amount: 2_000_000_000_000n },
    ]);
    expect(design.settlement.realms.starting_troops.every((troop) => troop.activeVariant() === "Knight")).toBe(true);
    expect([perHour(26), perHour(35), perHour(23)]).toEqual([100n, 200n, 100n]);
  });

  test("every preset id names the mode it plays, and an unknown id fails by name", () => {
    expect(
      [1, 2, 3, 4, FRONTIER_PRESET_ID, FRONTIER_ACCELERATED_PRESET_ID, FRONTIER_PLAYTEST_PRESET_ID].map(
        nativeGameModeOf,
      ),
    ).toEqual(["frontier", "blitz", "eternum", "duel", "frontier", "frontier", "frontier"]);
    expect(() => nativeGameModeOf(9)).toThrow("Unknown native preset 9");
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

  test("registration reads the current commitment and replaces changed balances", async () => {
    const registration = buildNativePresetRegistration(buildNativePreset(configuration(3), 3), 1, manifestPath);
    let commitment = registration.commitment;
    const account = {
      getBlockNumber: async () => 10,
      getClassHashAt: async () => "0x456",
      callContract: async () => [commitment],
      execute: async () => {
        throw new Error("replacement submitted");
      },
    } as unknown as Account;
    expect(await registerNativePreset(account, 1, registration)).toBeNull();
    commitment = "0x1";
    await expect(registerNativePreset(account, 1, registration)).rejects.toThrow("replacement submitted");
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
    native: {
      domains: { registry: { address: "0x123" }, season: { address: "0x456" } },
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
    expect(blitzRosterOf(["0x02", "0x1"])).toEqual([
      { owner: "0x2", account: "0x2" },
      { owner: "0x1", account: "0x1" },
    ]);
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
