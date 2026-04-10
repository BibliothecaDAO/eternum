import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import {
  buildFactoryRunRequestContext,
  buildLaunchGameRequest,
  buildLaunchRotationRequest,
  buildLaunchSeriesRequest,
  resolveLaunchGameStepId,
} from "../cli/launch-request";

const TEMP_DIRECTORIES: string[] = [];

afterEach(() => {
  for (const directory of TEMP_DIRECTORIES.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function writeLaunchConfig(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), "clean-launch-config-"));
  const path = join(directory, "launch.yaml");
  writeFileSync(path, contents, "utf8");
  TEMP_DIRECTORIES.push(directory);
  return path;
}

describe("launch request helpers", () => {
  test("builds a launch request from shared CLI args", () => {
    expect(
      buildLaunchGameRequest({
        environment: "mainnet.blitz",
        game: "bltz-test-1",
        "start-time": "2026-03-18T10:00:00Z",
        "factory-address": "0xabc",
        "two-player-mode": "true",
        "duration-seconds": "3600",
        "map-config-overrides-json": JSON.stringify({
          campFindProbability: 16384,
          campFindFailProbability: 49151,
        }),
        "blitz-registration-overrides-json": JSON.stringify({
          registration_count_max: 12,
          fee_token: "0x1234",
          fee_amount: "40000",
        }),
      }),
    ).toMatchObject({
      environmentId: "mainnet.blitz",
      gameName: "bltz-test-1",
      startTime: "2026-03-18T10:00:00Z",
      factoryAddress: "0xabc",
      twoPlayerMode: true,
      durationSeconds: 3600,
      mapConfigOverrides: {
        campFindProbability: 16384,
        campFindFailProbability: 49151,
      },
      blitzRegistrationOverrides: {
        registration_count_max: 12,
        fee_token: "0x1234",
        fee_amount: "40000",
      },
    });
  });

  test("defaults max actions from the selected environment", () => {
    expect(
      buildLaunchGameRequest({
        environment: "mainnet.blitz",
        game: "bltz-test-1",
        "start-time": "2026-03-18T10:00:00Z",
      }).maxActions,
    ).toBe(50);

    expect(
      buildLaunchGameRequest({
        environment: "slot.blitz",
        game: "bltz-test-2",
        "start-time": "2026-03-18T10:00:00Z",
      }).maxActions,
    ).toBe(300);
  });

  test("resolves supported launch step ids", () => {
    expect(resolveLaunchGameStepId("create-world")).toBe("create-world");
    expect(resolveLaunchGameStepId("configure-world")).toBe("configure-world");
    expect(resolveLaunchGameStepId("create-indexer")).toBe("create-indexer");
    expect(resolveLaunchGameStepId("sync-paymaster")).toBe("sync-paymaster");
  });

  test("builds a run-store request context with the nested launch request intact", () => {
    expect(
      buildFactoryRunRequestContext(
        {
          environment: "slot.blitz",
          game: "bltz-test-1",
          "start-time": "2026-03-18T10:00:00Z",
          "two-player-mode": "true",
        },
        "full",
      ),
    ).toMatchObject({
      environmentId: "slot.blitz",
      gameName: "bltz-test-1",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-test-1",
        startTime: "2026-03-18T10:00:00Z",
        twoPlayerMode: true,
      },
    });
  });

  test("parses targeted child game names for grouped recovery", () => {
    expect(
      buildLaunchRotationRequest({
        environment: "slot.blitz",
        "rotation-name": "bltz-knicker",
        "first-game-start-time": "2026-03-18T10:00:00Z",
        "game-interval-minutes": "60",
        "max-games": "12",
        "evaluation-interval-minutes": "15",
        "target-game-names-json": JSON.stringify(["bltz-knicker-03"]),
      }).targetGameNames,
    ).toEqual(["bltz-knicker-03"]);
  });

  test("loads weekly series schedules from a YAML config file", () => {
    const configPath = writeLaunchConfig(`
launchKind: series
environmentId: slot.blitz
seriesName: blitz-weekly-may-2026
autoRetryEnabled: true
autoRetryIntervalMinutes: 15
durationSeconds: 86400
games:
  - gameName: bltz-weekly-01
    startTime: 2026-05-02T18:00:00Z
  - gameName: bltz-weekly-02
    startTime: 2026-05-09T18:00:00Z
`);

    expect(
      buildLaunchSeriesRequest({
        "config-path": configPath,
      }),
    ).toMatchObject({
      launchKind: "series",
      environmentId: "slot.blitz",
      seriesName: "blitz-weekly-may-2026",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      durationSeconds: 86400,
      games: [
        {
          gameName: "bltz-weekly-01",
          startTime: "2026-05-02T18:00:00Z",
        },
        {
          gameName: "bltz-weekly-02",
          startTime: "2026-05-09T18:00:00Z",
        },
      ],
    });
  });

  test("lets explicit CLI overrides win over YAML shared launch options", () => {
    const configPath = writeLaunchConfig(`
launchKind: series
environmentId: slot.blitz
seriesName: blitz-weekly-may-2026
durationSeconds: 86400
skipIndexer: false
games:
  - gameName: bltz-weekly-01
    startTime: 2026-05-02T18:00:00Z
`);

    expect(
      buildLaunchSeriesRequest({
        "config-path": configPath,
        "duration-seconds": "3600",
        "skip-indexer": "true",
      }),
    ).toMatchObject({
      durationSeconds: 3600,
      skipIndexer: true,
    });
  });

  test("rejects unsupported launch step ids", () => {
    expect(() => resolveLaunchGameStepId("full")).toThrow('Unsupported launch step "full"');
  });
});
