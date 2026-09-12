import { describe, expect, mock, test } from "bun:test";
import { loadEnvironmentConfiguration } from "../config/config-loader";

mock.module("../../../../contracts/l3/game/manifest_madara.json", () => ({
  default: {
    world: { address: "0xsharedworld" },
    contracts: [
      {
        tag: "s2-registrar_systems",
        address: "0xregistrar",
        abi: [
          { type: "function", name: "bootstrap_chain_config" },
          { type: "function", name: "register_preset" },
          { type: "function", name: "register_series" },
          { type: "function", name: "create_game" },
        ],
      },
    ],
    events: [{ tag: "s2-GameCreated", selector: "0xabc" }],
  },
}));

const { buildCreateGameCalldata, buildRegisterPresetCalldata } = await import("../registrar/calls");
const { buildCreateGameParams, buildPresetRegistration, summarizePresetSideTables } =
  await import("../registrar/preset");

describe("appchain registrar preset", () => {
  const config = loadEnvironmentConfiguration("madara.blitz");

  test("builds stable preset side tables and calldata", () => {
    const payload = buildPresetRegistration(config, 1);

    expect(summarizePresetSideTables(payload)).toEqual({
      weights: 39,
      resourceFactories: 39,
      buildingCategories: 39,
      structureLevels: 3,
      hyperstructureConstruction: 0,
      resourceLists: 209,
      resourceMinMaxLists: 3,
    });
    expect(buildRegisterPresetCalldata(payload)).toHaveLength(2_097);
    expect(payload.presetConfig.preset_id).toBe(1);
    expect(payload.gameConfig.preset_id).toBe(1);
    expect(payload.gameConfig.blitz_registration_config).toEqual({
      registration_count: 0,
      registration_count_max: config.blitz.registration.registration_count_max,
      registration_start_at: 0,
    });
    expect(buildRegisterPresetCalldata(payload)).toMatchSnapshot();
  });

  test("writes an explicit disabled address only for disabled features", () => {
    const blitzConfig = structuredClone(config);
    delete blitzConfig.setup;
    delete blitzConfig.faith;

    const payload = buildPresetRegistration(blitzConfig, 1);
    expect(payload.presetConfig).toMatchObject({ faith_config: { enabled: false, reward_token: "0x0" } });
  });

  test("keeps launch clocks and mode overrides in CreateGameParams", () => {
    const originalDateNow = Date.now;
    Date.now = () => 1_999_990_000_000;

    try {
      const params = buildCreateGameParams(config, {
        gameName: "bltz-a2",
        presetId: 3,
        seriesName: "bltz-series",
        seriesGameNumber: 2,
        startMainAt: 2_000_000_000,
        durationSeconds: 7_200,
        devModeOn: true,
        singleRealmMode: false,
        twoPlayerMode: true,
        useMapOverride: true,
      });

      // Settling and registration open at creation time, not at start − window.
      expect(params).toMatchObject({
        preset_id: 3,
        game_number_in_series: 2,
        start_settling_at: 1_999_990_000,
        start_main_at: 2_000_000_000,
        duration_seconds: 7_200,
        registration_start_at: 1_999_989_999,
        registration_count_max: 2,
        dev_mode_on: true,
        two_player_mode: true,
        use_map_override: true,
        end_grace_seconds: 86_400,
      });
      expect(BigInt(params.seed as string)).not.toBe(0n);
      expect(params).not.toHaveProperty("fee_amount");
      expect(params).not.toHaveProperty("registration_grace_seconds");
      expect(buildCreateGameCalldata(params)).toMatchSnapshot();
    } finally {
      Date.now = originalDateNow;
    }
  });

  test("clamps settling to the start time when a game is created late", () => {
    const originalDateNow = Date.now;
    Date.now = () => 2_000_000_500_000;

    try {
      const params = buildCreateGameParams(config, {
        gameName: "bltz-late",
        presetId: 3,
        startMainAt: 2_000_000_000,
        durationSeconds: 3_600,
        devModeOn: true,
        singleRealmMode: false,
        twoPlayerMode: false,
        useMapOverride: false,
      });

      expect(params).toMatchObject({
        start_settling_at: 2_000_000_000,
        registration_start_at: 1_999_999_999,
        start_main_at: 2_000_000_000,
      });
    } finally {
      Date.now = originalDateNow;
    }
  });

  test("accepts the 96-player Blitz capacity and rejects 97", () => {
    const capacityConfig = structuredClone(config);
    const createGameInput = {
      gameName: "bltz-capacity",
      presetId: 3,
      startMainAt: 2_000_000_000,
      durationSeconds: 3_600,
      devModeOn: true,
      singleRealmMode: false,
      twoPlayerMode: false,
      useMapOverride: false,
    };

    capacityConfig.blitz.registration.registration_count_max = 96;
    expect(buildCreateGameParams(capacityConfig, createGameInput).registration_count_max).toBe(96);

    capacityConfig.blitz.registration.registration_count_max = 97;
    expect(() => buildCreateGameParams(capacityConfig, createGameInput)).toThrow(
      "Blitz registration_count_max must be between 1 and 96",
    );
  });
});

describe("Eternum portal preset", () => {
  test("places six public portals four ethereal steps apart with a fee each way", () => {
    const config = loadEnvironmentConfiguration("madara.eternum");
    const payload = buildPresetRegistration(config, 12);
    expect(config.settlement.spires_max_count).toBe(6);
    expect(config.settlement.base_distance * config.settlement.spires_layer_distance).toBe(60);
    expect(payload.presetConfig.spire_travel_essence_cost).toBe(10_000_000_000n);
    expect(payload.presetConfig).toMatchObject({
      map_config: { holysite_win_probability: 0, holysite_fail_probability: 0 },
      faith_config: { holy_site_fp_per_sec: 0 },
      structure_capacity_config: { holysite_capacity: 0 },
      quest_config: { quest_discovery_prob: 0, quest_discovery_fail_prob: 0 },
      quest_games: [],
    });
    expect(config.exploration.bitcoinMineWinProbability).toBeGreaterThan(0);
  });
});
