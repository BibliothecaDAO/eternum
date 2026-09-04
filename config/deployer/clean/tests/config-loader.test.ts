import { BuildingType, RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";

type ConfigWithFactoryAddress = {
  factory_address?: string;
};

describe("applyDeploymentConfigOverrides", () => {
  test("loads generated configs with neutral biome climate defaults", () => {
    const config = loadEnvironmentConfiguration("madara.blitz");

    expect(config.biomeClimate).toEqual({
      elevationScaleBps: 10_000,
      moistureScaleBps: 10_000,
      elevationBiasBps: 10_000,
      moistureBiasBps: 10_000,
      elevationSeed: 0,
      moistureSeed: 0,
    });
  });

  test("applies launch-time boolean overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      devModeOn: true,
      singleRealmMode: true,
      twoPlayerMode: false,
      durationSeconds: 1_800,
      pointRegistrationGraceSeconds: 5,
    });

    expect(result.season.startMainAt).toBe(1_763_112_600);
    expect(result.season.durationSeconds).toBe(1_800);
    expect(result.season.pointRegistrationCloseAfterEndSeconds).toBe(5);
    expect((result as ConfigWithFactoryAddress).factory_address).toBe("0xabc");
    expect(result.dev?.mode?.on).toBe(true);
    expect(result.settlement?.single_realm_mode).toBe(true);
    expect(result.settlement?.two_player_mode).toBe(false);
  });

  test("rejects an invalid point-registration grace override", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        pointRegistrationGraceSeconds: -1,
      }),
    ).toThrow("pointRegistrationGraceSeconds must be an integer between 0 and 4294967295");
  });

  test("applies the inferred official 60-minute blitz profile before launch overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 3_600,
    });

    expect(result.season.durationSeconds).toBe(3_600);
    expect(result.resources.productionByComplexRecipeOutputs[ResourcesIds.Donkey]).toBe(3);
    expect(result.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(result.resources.productionByComplexRecipeOutputs[ResourcesIds.Essence]).toBe(20);
    expect(result.troop.stamina.staminaInitial).toBe(30);
    expect(result.troop.stamina.staminaGainPerTick).toBe(30);
    expect(result.victoryPoints.pointsForTileExploration).toBe(5_000_000n);
    expect(result.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits).toBe(250_000_000n);
    expect(result.victoryPoints.pointsForRelicDiscovery).toBe(250_000_000n);
    expect(result.victoryPoints.pointsForHyperstructureClaimAgainstBandits).toBe(1_000_000_000n);
    expect(result.victoryPoints.hyperstructurePointsPerCycle).toBe(
      baseConfig.victoryPoints.hyperstructurePointsPerCycle,
    );
    expect(result.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);
    expect(result.realmUpgradeCosts[RealmLevels.Kingdom]?.[0]?.amount).toBe(720);
    expect(result.startingResources.find((resource) => resource.resource === ResourcesIds.Knight)?.amount).toBe(3_500);
    expect(result.blitz.exploration.rewardProfileId).toBe("official-60");
    expect(result.blitz.exploration.rewards).toHaveLength(6);
    expect(result.campStartingResources.find((resource) => resource.resource === ResourcesIds.Donkey)?.min_amount).toBe(
      1_000,
    );
  });

  test("keeps the base blitz balance for custom durations", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
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
    expect(result.blitz.exploration.rewardProfileId).toBe("official-90");
  });

  test("applies validated map config overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
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
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      blitzRegistrationOverrides: {
        registration_count_max: 12,
      },
    });

    expect(result.blitz.registration.registration_count_max).toBe(12);
  });

  test("applies validated biome climate overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      biomeClimateOverrides: {
        elevationScaleBps: 12_000,
        moistureScaleBps: 9_000,
        elevationBiasBps: 11_000,
        moistureBiasBps: 8_000,
        elevationSeed: 137,
        moistureSeed: 991,
      },
    } as Parameters<typeof applyDeploymentConfigOverrides>[1]);

    expect(result.biomeClimate).toEqual({
      elevationScaleBps: 12_000,
      moistureScaleBps: 9_000,
      elevationBiasBps: 11_000,
      moistureBiasBps: 8_000,
      elevationSeed: 137,
      moistureSeed: 991,
    });
  });

  test("rejects invalid biome climate overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        biomeClimateOverrides: {
          elevationScaleBps: 65_536,
        },
      } as Parameters<typeof applyDeploymentConfigOverrides>[1]),
    ).toThrow("biomeClimateOverrides.elevationScaleBps must be an integer between 0 and 65535");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        biomeClimateOverrides: {
          moistureSeed: 4_294_967_296,
        },
      } as Parameters<typeof applyDeploymentConfigOverrides>[1]),
    ).toThrow("biomeClimateOverrides.moistureSeed must be an integer between 0 and 4294967295");
  });

  test("lets explicit launch-time overrides win after the inferred blitz profile is applied", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");
    const result = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 3_600,
      mapConfigOverrides: {
        relicDiscoveryIntervalSeconds: 420,
      },
      blitzRegistrationOverrides: {
        registration_count_max: 24,
      },
    });

    expect(result.season.durationSeconds).toBe(3_600);
    expect(result.exploration.relicDiscoveryIntervalSeconds).toBe(420);
    expect(result.blitz.registration.registration_count_max).toBe(24);
  });

  test("rejects mutually exclusive settlement modes", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");

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
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");

    expect(() =>
      applyDeploymentConfigOverrides(baseConfig, {
        startMainAt: 1_763_112_600,
        factoryAddress: "0xabc",
        durationSeconds: 30,
      }),
    ).toThrow("durationSeconds must be an integer greater than or equal to 60");
  });

  test("rejects incomplete probability pair overrides", () => {
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");

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
    const baseConfig = loadEnvironmentConfiguration("madara.blitz");

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
});
