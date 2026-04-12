import { describe, expect, test } from "bun:test";
import { buildLaunchWorkflowEnvironment } from "../cli/launch-workflow-env";
import type { LaunchSeriesRequest } from "../types";

function buildSeriesRequest(overrides: Partial<LaunchSeriesRequest> = {}): LaunchSeriesRequest {
  return {
    launchKind: "series",
    environmentId: "slot.blitz",
    seriesName: "blitz-weekly",
    games: [{ gameName: "bltz-weekly-01", startTime: "2026-05-02T18:00:00Z" }],
    durationSeconds: 86400,
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    workflowFile: "factory-torii-deployer.yml",
    ref: "feature/yaml-schedule",
    ...overrides,
  };
}

describe("launch workflow env", () => {
  test("merges workflow launch option overrides on top of config-backed defaults", () => {
    const environment = buildLaunchWorkflowEnvironment(buildSeriesRequest(), {
      GAME_LAUNCH_OPTIONS_JSON: JSON.stringify({
        durationSeconds: 3600,
        skipIndexer: true,
      }),
      GAME_LAUNCH_AUTO_RETRY_ENABLED: "false",
      GAME_LAUNCH_TARGET_GAME_NAMES_JSON: JSON.stringify(["bltz-weekly-override"]),
    });

    expect(JSON.parse(environment.GAME_LAUNCH_OPTIONS_JSON)).toMatchObject({
      durationSeconds: 3600,
      skipIndexer: true,
      workflowFile: "factory-torii-deployer.yml",
      ref: "feature/yaml-schedule",
    });
    expect(environment.GAME_LAUNCH_AUTO_RETRY_ENABLED).toBe("false");
    expect(environment.GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES).toBe("15");
    expect(environment.GAME_LAUNCH_TARGET_GAME_NAMES_JSON).toBe('["bltz-weekly-override"]');
  });

  test("includes workflow dispatch overrides in replayable launch options", () => {
    const environment = buildLaunchWorkflowEnvironment(buildSeriesRequest());

    expect(JSON.parse(environment.GAME_LAUNCH_OPTIONS_JSON)).toMatchObject({
      workflowFile: "factory-torii-deployer.yml",
      ref: "feature/yaml-schedule",
    });
  });
});
