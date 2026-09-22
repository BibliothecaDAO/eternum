import { describe, expect, test } from "bun:test";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import { buildCreateGameParams } from "../registrar/preset";

describe("native game configuration", () => {
  const config = loadEnvironmentConfiguration("madara.blitz");
  test.each([0, -1, NaN, 1.5, undefined])("rejects an invalid chain clock (%s)", (chainTimestamp) => {
    expect(() =>
      buildCreateGameParams(config, {
        gameName: "bltz-clock",
        presetId: 2,
        startMainAt: 2_000_000_000,
        chainTimestamp: chainTimestamp as number,
        durationSeconds: 3_600,
        devModeOn: false,
        singleRealmMode: false,
        twoPlayerMode: false,
        useMapOverride: false,
      }),
    ).toThrow("positive chain timestamp");
  });
  test("keeps launch clocks and mode overrides in CreateGameParams", () => {
    const originalDateNow = Date.now;
    Date.now = () => 1_999_995_000_000;

    try {
      const params = buildCreateGameParams(config, {
        gameName: "bltz-a2",
        presetId: 4,
        startMainAt: 2_000_000_000,
        chainTimestamp: 1_999_990_000,
        durationSeconds: 7_200,
        devModeOn: true,
        singleRealmMode: false,
        twoPlayerMode: true,
        useMapOverride: true,
      });

      // A launcher clock ahead of the chain cannot delay recorded settlement.
      expect(params).toMatchObject({
        preset_id: 4,
        start_settling_at: 1_999_990_000,
        start_main_at: 2_000_000_000,
        duration_seconds: 7_200,
        registration_start_at: 1_999_989_999,
        registration_count_max: 2,
        dev_mode_on: true,
        two_player_mode: true,
        use_map_override: true,
        end_grace_seconds: 0,
      });
      expect(BigInt(params.seed as string)).not.toBe(0n);
      expect(params).not.toHaveProperty("fee_amount");
      expect(params).not.toHaveProperty("registration_grace_seconds");
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
        presetId: 2,
        startMainAt: 2_000_000_000,
        chainTimestamp: 2_000_000_500,
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
      presetId: 2,
      startMainAt: 2_000_000_000,
      chainTimestamp: 1_999_990_000,
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
