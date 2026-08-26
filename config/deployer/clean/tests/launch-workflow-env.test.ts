import { describe, expect, test } from "bun:test";
import { buildLaunchWorkflowEnvironment } from "../cli/launch-workflow-env";
import type { LaunchRotationRequest, LaunchSeriesRequest } from "../types";

function buildSeriesRequest(overrides: Partial<LaunchSeriesRequest> = {}): LaunchSeriesRequest {
  return {
    launchKind: "series",
    environmentId: "appchain.blitz",
    seriesName: "blitz-weekly",
    games: [{ gameName: "bltz-weekly-01", startTime: "2026-05-02T18:00:00Z" }],
    durationSeconds: 86400,
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    ...overrides,
  };
}

function buildRotationRequest(overrides: Partial<LaunchRotationRequest> = {}): LaunchRotationRequest {
  return {
    launchKind: "rotation",
    environmentId: "appchain.blitz",
    rotationName: "blitz-rotation",
    firstGameStartTime: "2026-04-20T01:00:00Z",
    gameIntervalMinutes: 0,
    maxGames: 5200,
    advanceWindowGames: 5,
    evaluationIntervalMinutes: 15,
    durationSeconds: 3600,
    weeklyCadence: [{ gameNamePrefix: "na-gladiator", weekday: "monday", utcTime: "01:00" }],
    ...overrides,
  };
}

describe("launch workflow env", () => {
  test("merges workflow launch option overrides on top of config-backed defaults", () => {
    const environment = buildLaunchWorkflowEnvironment(buildSeriesRequest(), {
      GAME_LAUNCH_OPTIONS_JSON: JSON.stringify({
        durationSeconds: 3600,
        twoPlayerMode: true,
      }),
      GAME_LAUNCH_AUTO_RETRY_ENABLED: "false",
      GAME_LAUNCH_TARGET_GAME_NAMES_JSON: JSON.stringify(["bltz-weekly-override"]),
    });

    expect(JSON.parse(environment.GAME_LAUNCH_OPTIONS_JSON)).toMatchObject({
      durationSeconds: 3600,
      twoPlayerMode: true,
    });
    expect(environment.GAME_LAUNCH_AUTO_RETRY_ENABLED).toBe("false");
    expect(environment.GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES).toBe("15");
    expect(environment.GAME_LAUNCH_TARGET_GAME_NAMES_JSON).toBe('["bltz-weekly-override"]');
  });

  test("includes only registrar launch settings in replayable launch options", () => {
    const environment = buildLaunchWorkflowEnvironment(buildSeriesRequest());
    const options = JSON.parse(environment.GAME_LAUNCH_OPTIONS_JSON);

    expect(options).toMatchObject({ durationSeconds: 86400 });
    expect(options).not.toHaveProperty("factoryAddress");
    expect(options).not.toHaveProperty("skipIndexer");
  });

  test("exports rotation weekly cadence for workflow replay", () => {
    const environment = buildLaunchWorkflowEnvironment(buildRotationRequest());

    expect(environment.GAME_LAUNCH_WEEKLY_CADENCE_JSON).toBe(
      '[{"gameNamePrefix":"na-gladiator","weekday":"monday","utcTime":"01:00"}]',
    );
    expect(JSON.parse(environment.GAME_LAUNCH_OPTIONS_JSON)).toMatchObject({
      durationSeconds: 3600,
      weeklyCadence: [{ gameNamePrefix: "na-gladiator", weekday: "monday", utcTime: "01:00" }],
    });
  });
});
