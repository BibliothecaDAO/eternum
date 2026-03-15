import { describe, expect, test } from "bun:test";
import { getGameManifest } from "../../../../contracts/utils/utils";
import { FACTORY_WORLD_CONFIG_STEPS, resolveFactoryWorldConfigSteps } from "../config-steps";
import { loadEnvironmentConfiguration } from "../config-loader";
import { setBlitzRegistrationParametersConfig, setSeasonConfig } from "../native-config-steps";

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
    expect(stepIds).toContain("blitz-registration");
    expect(stepIds).toContain("season");

    expect(stepIds).not.toContain("world");
    expect(stepIds).not.toContain("globals");
    expect(stepIds).not.toContain("building");
    expect(stepIds).not.toContain("blitz-season");
  });

  test("resolves different step subsets for different environments", () => {
    const blitzConfig = loadEnvironmentConfiguration("slot.blitz");
    const eternumConfig = loadEnvironmentConfiguration("slot.eternum");
    (blitzConfig as typeof blitzConfig & { factory_address?: string }).factory_address = "0xabc";
    (eternumConfig as typeof eternumConfig & { factory_address?: string }).factory_address = "0xabc";

    const blitzStepIds = resolveFactoryWorldConfigSteps({
      environmentId: "slot.blitz",
      config: blitzConfig,
    }).map((step) => step.id);
    const eternumStepIds = resolveFactoryWorldConfigSteps({
      environmentId: "slot.eternum",
      config: eternumConfig,
    }).map((step) => step.id);

    expect(blitzStepIds).toContain("blitz-registration");
    expect(blitzStepIds).toContain("season");
    expect(blitzStepIds).not.toContain("blitz-season");

    expect(eternumStepIds).toContain("season");
    expect(eternumStepIds).not.toContain("blitz-registration");
    expect(eternumStepIds).not.toContain("blitz-season");
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
});
