import { describe, expect, test } from "bun:test";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config-loader";

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
});
