import { describe, expect, mock, test } from "bun:test";
import { loadEnvironmentConfiguration } from "../config/config-loader";

mock.module("../../../../contracts/game/manifest_appchain.json", () => ({
  default: {
    world: { address: "0xsharedworld" },
    contracts: [
      {
        tag: "s2_blitz-registrar_systems",
        address: "0xregistrar",
        abi: [
          { type: "function", name: "bootstrap_chain_config" },
          { type: "function", name: "register_preset" },
          { type: "function", name: "register_series" },
          { type: "function", name: "create_game" },
        ],
      },
    ],
    events: [{ tag: "s2_blitz-GameCreated", selector: "0xabc" }],
  },
}));

const { buildRegisterPresetCalldata } = await import("../registrar/calls");
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
    expect(buildRegisterPresetCalldata(payload)).toHaveLength(2_037);
    expect(payload.presetConfig.preset_id).toBe(1);
    expect(payload.gameConfig.preset_id).toBe(1);
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
    });
    expect(BigInt(params.seed as string)).not.toBe(0n);
  });
});
