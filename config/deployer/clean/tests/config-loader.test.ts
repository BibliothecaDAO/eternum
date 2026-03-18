import { describe, expect, test } from "bun:test";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";

describe("applyDeploymentConfigOverrides", () => {
  test("applies launch-time boolean overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      devModeOn: true,
      singleRealmMode: true,
      twoPlayerMode: false,
      durationSeconds: 1_800,
    });

    expect(result.season.startMainAt).toBe(1_763_112_600);
    expect(result.season.durationSeconds).toBe(1_800);
    expect((result as any).factory_address).toBe("0xabc");
    expect(result.dev?.mode?.on).toBe(true);
    expect(result.settlement?.single_realm_mode).toBe(true);
    expect(result.settlement?.two_player_mode).toBe(false);
  });

  test("applies validated map config overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.eternum");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      mapConfigOverrides: {
        bitcoinMineWinProbability: 1638,
        bitcoinMineFailProbability: 63897,
        hyperstructureWinProbAtCenter: 12345,
        hyperstructureFailProbAtCenter: 87655,
      },
    });

    expect(result.exploration.bitcoinMineWinProbability).toBe(1638);
    expect(result.exploration.bitcoinMineFailProbability).toBe(63897);
    expect(result.exploration.hyperstructureWinProbAtCenter).toBe(12345);
    expect(result.exploration.hyperstructureFailProbAtCenter).toBe(87655);
  });

  test("applies validated blitz registration overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      blitzRegistrationOverrides: {
        registration_count_max: 12,
      },
    });

    expect(result.blitz.registration.registration_count_max).toBe(12);
  });

  test("rejects mutually exclusive settlement modes", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        singleRealmMode: true,
        twoPlayerMode: true,
      }),
    ).toThrow("single_realm_mode and two_player_mode cannot both be enabled");
  });

  test("rejects invalid duration overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        durationSeconds: 30,
      }),
    ).toThrow("durationSeconds must be an integer greater than or equal to 60");
  });

  test("rejects incomplete probability pair overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        mapConfigOverrides: {
          campFindProbability: 16384,
        },
      }),
    ).toThrow("Camp chance overrides must include both win and fail values");
  });

  test("rejects blitz registration overrides in two-player mode", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        twoPlayerMode: true,
        blitzRegistrationOverrides: {
          registration_count_max: 12,
        },
      }),
    ).toThrow("blitz registration overrides are not supported when two_player_mode is enabled");
  });

  test("ignores duration overrides for eternum environments", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.eternum");

    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 0,
    });

    expect(result.season.startMainAt).toBe(1_763_112_600);
    expect(result.season.durationSeconds).toBe(0);
    expect(result.blitz.mode.on).toBe(false);
  });
});
