import { describe, expect, mock, test } from "bun:test";
import { loadEnvironmentConfiguration } from "../config/config-loader";

mock.module("../../../../contracts/game/manifest_appchain_blitz.json", () => ({
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
  const config = loadEnvironmentConfiguration("appchain.blitz");

  test("builds stable preset side tables and calldata", () => {
    const payload = buildPresetRegistration(config, 1);

    expect(summarizePresetSideTables(payload)).toEqual({
      weights: 39,
      resourceFactories: 39,
      buildingCategories: 39,
      structureLevels: 3,
      hyperstructureConstruction: 0,
      resourceLists: 203,
      resourceMinMaxLists: 3,
    });
    expect(buildRegisterPresetCalldata(payload)).toHaveLength(2_091);
    expect(payload.presetConfig.preset_id).toBe(1);
    expect(payload.gameConfig.preset_id).toBe(1);
    expect(buildRegisterPresetCalldata(payload)).toMatchSnapshot();
  });

  test("builds an Eternum preset and create-game payload without Blitz registration", () => {
    const eternumConfig = loadEnvironmentConfiguration("appchain.eternum");
    const payload = buildPresetRegistration(eternumConfig, 10);
    const createGameInput = {
      gameName: "etrn-w3",
      presetId: 10,
      startMainAt: 2_000_000_000,
      durationSeconds: eternumConfig.season.durationSeconds,
      devModeOn: true,
      singleRealmMode: false,
      twoPlayerMode: false,
      useMapOverride: false,
    };
    const params = buildCreateGameParams(eternumConfig, createGameInput);

    expect(payload.gameConfig).toMatchObject({ preset_id: 10, blitz_mode_on: false });
    expect(payload.presetConfig).toMatchObject({
      preset_id: 10,
      season_addresses_config: expect.any(Object),
      bank_config: expect.any(Object),
      trade_config: expect.any(Object),
      quest_config: expect.any(Object),
      faith_config: expect.objectContaining({ owner_share_percent: 3000 }),
      bitcoin_mine_config: expect.any(Object),
    });
    expect(params).toMatchObject({ preset_id: 10, registration_count_max: 0, two_player_mode: false });
    expect(() => buildCreateGameParams(eternumConfig, { ...createGameInput, twoPlayerMode: true })).toThrow(
      "Eternum seasons do not support two-player mode",
    );
  });

  test("keeps launch clocks and mode overrides in CreateGameParams", () => {
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

    expect(params).toMatchObject({
      preset_id: 3,
      game_number_in_series: 2,
      start_settling_at: 1_999_996_400,
      start_main_at: 2_000_000_000,
      duration_seconds: 7_200,
      registration_start_at: 1_999_996_399,
      registration_count_max: 2,
      dev_mode_on: true,
      two_player_mode: true,
      use_map_override: true,
      end_grace_seconds: 86_400,
    });
    expect(BigInt(params.seed as string)).not.toBe(0n);
    expect(buildCreateGameCalldata(params)).toMatchSnapshot();
  });
});
