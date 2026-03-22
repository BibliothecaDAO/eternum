import { describe, expect, test } from "bun:test";
import { getGameManifest } from "../../../../contracts/utils/utils";
import { FACTORY_WORLD_CONFIG_STEPS, resolveFactoryWorldConfigSteps } from "../config/steps";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";
import {
  setBlitzExplorationConfig,
  setBlitzRegistrationParametersConfig,
  setFaithConfig,
  setResourceFactoryConfig,
  setSeasonConfig,
} from "../config/native-steps";

describe("native config steps", () => {
  test("keeps the registry atomic instead of grouped", () => {
    const stepIds = FACTORY_WORLD_CONFIG_STEPS.map((step) => step.id);

    expect(stepIds).toContain("world-admin");
    expect(stepIds).toContain("mercenaries-name");
    expect(stepIds).toContain("bank");
    expect(stepIds).toContain("tick");
    expect(stepIds).toContain("map");
    expect(stepIds).toContain("quest");
    expect(stepIds).toContain("building-base");
    expect(stepIds).toContain("building-categories");
    expect(stepIds).toContain("blitz-exploration");
    expect(stepIds).toContain("blitz-registration");
    expect(stepIds).toContain("season");
    expect(stepIds).toContain("faith");

    expect(stepIds).not.toContain("world");
    expect(stepIds).not.toContain("globals");
    expect(stepIds).not.toContain("building");
    expect(stepIds).not.toContain("blitz-season");
  });

  test("resolves different step subsets for different environments", () => {
    const blitzConfig = loadEnvironmentConfiguration("slot.blitz");
    const mainnetBlitzConfig = loadEnvironmentConfiguration("mainnet.blitz");
    const eternumConfig = loadEnvironmentConfiguration("slot.eternum");
    (blitzConfig as typeof blitzConfig & { factory_address?: string }).factory_address = "0xabc";
    (mainnetBlitzConfig as typeof mainnetBlitzConfig & { factory_address?: string }).factory_address = "0xabc";
    (eternumConfig as typeof eternumConfig & { factory_address?: string }).factory_address = "0xabc";

    const blitzStepIds = resolveFactoryWorldConfigSteps({
      environmentId: "slot.blitz",
      config: blitzConfig,
    }).map((step) => step.id);
    const mainnetBlitzStepIds = resolveFactoryWorldConfigSteps({
      environmentId: "mainnet.blitz",
      config: mainnetBlitzConfig,
    }).map((step) => step.id);
    const eternumStepIds = resolveFactoryWorldConfigSteps({
      environmentId: "slot.eternum",
      config: eternumConfig,
    }).map((step) => step.id);

    expect(blitzStepIds).toContain("blitz-registration");
    expect(blitzStepIds).toContain("blitz-exploration");
    expect(blitzStepIds).toContain("mmr");
    expect(blitzStepIds).not.toContain("faith");
    expect(blitzStepIds).not.toContain("trade");
    expect(blitzStepIds).not.toContain("bank");
    expect(blitzStepIds).toContain("season");
    expect(blitzStepIds).not.toContain("blitz-season");

    expect(mainnetBlitzStepIds).toContain("blitz-registration");
    expect(mainnetBlitzStepIds).toContain("blitz-exploration");
    expect(mainnetBlitzStepIds).toContain("mmr");
    expect(mainnetBlitzStepIds).not.toContain("faith");
    expect(mainnetBlitzStepIds).not.toContain("trade");
    expect(mainnetBlitzStepIds).not.toContain("bank");
    expect(mainnetBlitzStepIds).toContain("season");
    expect(mainnetBlitzStepIds).not.toContain("blitz-season");

    expect(eternumStepIds).toContain("faith");
    expect(eternumStepIds).toContain("trade");
    expect(eternumStepIds).toContain("bank");
    expect(eternumStepIds).not.toContain("mmr");
    expect(eternumStepIds).toContain("season");
    expect(eternumStepIds).not.toContain("blitz-exploration");
    expect(eternumStepIds).not.toContain("blitz-registration");
    expect(eternumStepIds).not.toContain("blitz-season");
  });

  test("writes the inferred blitz exploration reward profile id", async () => {
    const config = loadEnvironmentConfiguration("slot.blitz");
    const capturedCalls: Array<Record<string, unknown>> = [];
    const provider = {
      manifest: getGameManifest("slot") as any,
      set_blitz_exploration_config: async (payload: Record<string, unknown>) => {
        capturedCalls.push(payload);
        return { statusReceipt: "ok" };
      },
    };

    await setBlitzExplorationConfig({
      account: { address: "0x1" } as any,
      provider: provider as any,
      config,
    });

    expect(capturedCalls).toEqual([{ signer: expect.anything(), reward_profile_id: 2 }]);
  });

  test("applies faith config with the expected payload scaling", async () => {
    const config = loadEnvironmentConfiguration("slot.eternum");
    const capturedCalls: Array<Record<string, unknown>> = [];
    const provider = {
      manifest: getGameManifest("slot") as any,
      set_faith_config: async (payload: Record<string, unknown>) => {
        capturedCalls.push(payload);
        return { statusReceipt: "ok" };
      },
    };

    await setFaithConfig({
      account: { address: "0x1" } as any,
      provider: provider as any,
      config,
    });

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]).toMatchObject({
      enabled: config.faith?.enabled,
      wonder_base_fp_per_sec: config.faith?.wonder_base_fp_per_sec,
      holy_site_fp_per_sec: config.faith?.holy_site_fp_per_sec,
      realm_fp_per_sec: config.faith?.realm_fp_per_sec,
      village_fp_per_sec: config.faith?.village_fp_per_sec,
      owner_share_percent: (config.faith?.owner_share_percent || 0) * 100,
      reward_token: config.faith?.reward_token,
    });
  });

  test("reuses the same blitz timing across split registration steps", async () => {
    const config = loadEnvironmentConfiguration("slot.blitz");
    config.season.startMainAt = 0;
    config.blitz.registration.registration_delay_seconds = 10;
    config.blitz.registration.registration_period_seconds = 100;

    const capturedCalls: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const provider = {
      manifest: getGameManifest("slot") as any,
      set_blitz_registration_config: async (payload: Record<string, unknown>) => {
        capturedCalls.push({ type: "registration", payload });
        return { statusReceipt: "ok" };
      },
      set_season_config: async (payload: Record<string, unknown>) => {
        capturedCalls.push({ type: "season", payload });
        return { statusReceipt: "ok" };
      },
    };

    const originalDateNow = Date.now;
    let currentTimeMs = 1_700_000_000_000;
    Date.now = () => currentTimeMs;

    try {
      await setBlitzRegistrationParametersConfig({
        account: { address: "0x1" } as any,
        provider: provider as any,
        config,
      });

      currentTimeMs += 5_000;

      await setSeasonConfig({
        account: { address: "0x1" } as any,
        provider: provider as any,
        config,
      });
    } finally {
      Date.now = originalDateNow;
    }

    expect(capturedCalls).toHaveLength(2);

    const registrationPayload = capturedCalls[0]!.payload;
    const seasonPayload = capturedCalls[1]!.payload;
    const registrationStartAt = registrationPayload.registration_start_at as number;

    expect(registrationStartAt).toBe(1_700_000_010);
    expect(seasonPayload.start_settling_at).toBe(registrationStartAt);
    expect(seasonPayload.start_main_at).toBe(registrationStartAt + 100);
    expect(seasonPayload.end_at).toBe((seasonPayload.start_main_at as number) + config.season.durationSeconds);
  });

  test("carries inferred blitz profile duration through the season payload", async () => {
    const baseConfig = loadEnvironmentConfiguration("slot.blitz");
    const config = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 0,
      factoryAddress: "0xabc",
      durationSeconds: 3_600,
    });
    config.season.startMainAt = 0;
    config.blitz.registration.registration_delay_seconds = 10;
    config.blitz.registration.registration_period_seconds = 100;

    const capturedCalls: Array<Record<string, unknown>> = [];
    const provider = {
      manifest: getGameManifest("slot") as any,
      set_season_config: async (payload: Record<string, unknown>) => {
        capturedCalls.push(payload);
        return { statusReceipt: "ok" };
      },
    };

    await setSeasonConfig({
      account: { address: "0x1" } as any,
      provider: provider as any,
      config,
    });

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]?.end_at).toBe((capturedCalls[0]?.start_main_at as number) + 3_600);
  });

  test("fills missing simple recipe outputs with zero in resource factory payloads", async () => {
    const baseConfig = loadEnvironmentConfiguration("mainnet.blitz");
    const config = applyDeploymentConfigOverrides(baseConfig, {
      startMainAt: 1_763_112_600,
      factoryAddress: "0xabc",
      durationSeconds: 432_000,
      devModeOn: true,
    });

    const capturedCalls: Array<Record<string, unknown>> = [];
    const provider = {
      manifest: getGameManifest("mainnet") as any,
      set_resource_factory_config: async (payload: Record<string, unknown>) => {
        capturedCalls.push(payload);
        return { statusReceipt: "ok" };
      },
    };

    await setResourceFactoryConfig({
      account: { address: "0x1" } as any,
      provider: provider as any,
      config,
    });

    expect(capturedCalls).toHaveLength(1);

    const calls = capturedCalls[0]?.calls as Array<Record<string, unknown>>;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call.resource_output_per_simple_input !== undefined)).toBe(true);
    expect(calls.some((call) => call.resource_output_per_simple_input === 0)).toBe(true);
  });
});
