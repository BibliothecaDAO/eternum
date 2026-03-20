import { BuildingType, RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";

type ConfigWithFactoryAddress = {
  factory_address?: string;
};

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
    expect((result as ConfigWithFactoryAddress).factory_address).toBe("0xabc");
    expect(result.dev?.mode?.on).toBe(true);
    expect(result.settlement?.single_realm_mode).toBe(true);
    expect(result.settlement?.two_player_mode).toBe(false);
  });

  test("applies the inferred official 60-minute blitz profile before launch overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 3_600,
    });

    expect(result.season.durationSeconds).toBe(3_600);
    expect(result.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(result.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);
    expect(result.realmUpgradeCosts[RealmLevels.Kingdom]?.[0]?.amount).toBe(720);
    expect(result.startingResources.find((resource) => resource.resource === ResourcesIds.Knight)?.amount).toBe(3_500);
    expect(
      result.discoverableVillageStartingResources.find((resource) => resource.resource === ResourcesIds.Donkey)
        ?.min_amount,
    ).toBe(1_000);
  });

  test("keeps the base blitz balance for custom durations", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 1_800,
    });

    expect(result.season.durationSeconds).toBe(1_800);
    expect(result.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(
      baseConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood],
    );
    expect(result.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(
      baseConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount,
    );
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
        fee_token: "0x1234",
        fee_amount: "40000",
      },
    });

    expect(result.blitz.registration.registration_count_max).toBe(12);
    expect(result.blitz.registration.fee_token).toBe("0x1234");
    expect(result.blitz.registration.fee_amount).toBe(40000n);
  });

  test("lets explicit launch-time overrides win after the inferred blitz profile is applied", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 3_600,
      mapConfigOverrides: {
        relicDiscoveryIntervalSeconds: 420,
      },
      blitzRegistrationOverrides: {
        registration_count_max: 24,
        fee_amount: "250000000000000000000",
      },
    });

    expect(result.season.durationSeconds).toBe(3_600);
    expect(result.exploration.relicDiscoveryIntervalSeconds).toBe(420);
    expect(result.blitz.registration.registration_count_max).toBe(24);
    expect(result.blitz.registration.fee_amount).toBe(250000000000000000000n);
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

  test("rejects invalid blitz prize token overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        blitzRegistrationOverrides: {
          fee_token: "lords",
        },
      }),
    ).toThrow('blitzRegistrationOverrides.fee_token must be a non-empty "0x" address');
  });

  test("rejects invalid blitz prize amount overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        blitzRegistrationOverrides: {
          fee_amount: "25.5",
        },
      }),
    ).toThrow("blitzRegistrationOverrides.fee_amount must be a non-negative integer string");
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
