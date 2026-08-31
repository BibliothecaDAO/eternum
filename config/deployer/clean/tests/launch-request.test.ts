import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  buildFactoryRunRequestContext,
  buildLaunchGameRequest,
  buildLaunchRotationRequest,
  buildLaunchSeriesRequest,
  resolveLaunchGameStepId,
} from "../cli/launch-request";

const TEMP_DIRECTORIES: string[] = [];
const ORIGINAL_RPC_URL = process.env.RPC_URL;

afterEach(() => {
  for (const directory of TEMP_DIRECTORIES.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  if (ORIGINAL_RPC_URL === undefined) delete process.env.RPC_URL;
  else process.env.RPC_URL = ORIGINAL_RPC_URL;
});

function writeLaunchConfig(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), "clean-launch-config-"));
  const path = join(directory, "launch.yaml");
  writeFileSync(path, contents, "utf8");
  TEMP_DIRECTORIES.push(directory);
  return path;
}

describe("launch request helpers", () => {
  const ORIGINAL_BIOME_CLIMATE_BY_GAME_ENV = process.env.GAME_LAUNCH_BIOME_CLIMATE_OVERRIDES_BY_GAME_NUMBER_JSON;

  beforeEach(() => {
    process.env.RPC_URL = "https://rpc.example";
  });

  afterEach(() => {
    if (ORIGINAL_BIOME_CLIMATE_BY_GAME_ENV === undefined) {
      delete process.env.GAME_LAUNCH_BIOME_CLIMATE_OVERRIDES_BY_GAME_NUMBER_JSON;
    } else {
      process.env.GAME_LAUNCH_BIOME_CLIMATE_OVERRIDES_BY_GAME_NUMBER_JSON = ORIGINAL_BIOME_CLIMATE_BY_GAME_ENV;
    }
  });

  test("builds a launch request from shared CLI args", () => {
    expect(
      buildLaunchGameRequest({
        environment: "madara.blitz",
        game: "bltz-test-1",
        "start-time": "2026-03-18T10:00:00Z",
        ledger: "0xledger",
        "ledger-rpc-url": "https://mainnet.example/rpc",
        lords: "0xlords",
        "sponsored-pool-lords": "48000",
        "two-player-mode": "true",
        "duration-seconds": "3600",
        "map-config-overrides-json": JSON.stringify({
          campFindProbability: 16384,
          campFindFailProbability: 49151,
        }),
        "biome-climate-overrides-json": JSON.stringify({
          elevationScaleBps: 12000,
          moistureSeed: 991,
        }),
        "blitz-registration-overrides-json": JSON.stringify({
          registration_count_max: 12,
        }),
      }),
    ).toMatchObject({
      environmentId: "madara.blitz",
      gameName: "bltz-test-1",
      startTime: "2026-03-18T10:00:00Z",
      ledgerAddress: "0xledger",
      ledgerRpcUrl: "https://mainnet.example/rpc",
      lordsAddress: "0xlords",
      sponsoredPoolLords: "48000",
      twoPlayerMode: true,
      durationSeconds: 3600,
      mapConfigOverrides: {
        campFindProbability: 16384,
        campFindFailProbability: 49151,
      },
      biomeClimateOverrides: {
        elevationScaleBps: 12000,
        moistureSeed: 991,
      },
      blitzRegistrationOverrides: {
        registration_count_max: 12,
      },
    });
  });

  test("defaults launches to their preset and the GameRegistry poll budget", () => {
    const blitzRequest = buildLaunchGameRequest({
      environment: "appchain.blitz",
      game: "bltz-test-1",
      "start-time": "2026-03-18T10:00:00Z",
    });
    const eternumRequest = buildLaunchGameRequest({
      environment: "appchain.eternum",
      game: "etrn-test-1",
      "start-time": "2026-03-18T10:00:00Z",
    });
    const madaraRequest = buildLaunchGameRequest({
      environment: "madara.blitz",
      game: "bltz-test-2",
      "start-time": "2026-03-18T10:00:00Z",
    });

    expect(blitzRequest).toMatchObject({
      version: "6",
      waitForFactoryIndexTimeoutMs: 120_000,
      waitForFactoryIndexPollMs: 2_000,
    });
    expect(eternumRequest).toMatchObject({
      version: "10",
      waitForFactoryIndexTimeoutMs: 120_000,
      waitForFactoryIndexPollMs: 2_000,
    });
    expect(madaraRequest).toMatchObject({
      version: "1",
      waitForFactoryIndexTimeoutMs: 120_000,
      waitForFactoryIndexPollMs: 2_000,
    });
  });

  test("resolves supported launch step ids", () => {
    expect(resolveLaunchGameStepId("create-world")).toBe("create-world");
    expect(resolveLaunchGameStepId("wait-for-factory-index")).toBe("wait-for-factory-index");
  });

  test("builds a run-store request context with the nested launch request intact", () => {
    expect(
      buildFactoryRunRequestContext(
        {
          environment: "appchain.blitz",
          game: "bltz-test-1",
          "start-time": "2026-03-18T10:00:00Z",
          "two-player-mode": "true",
        },
        "full",
      ),
    ).toMatchObject({
      environmentId: "appchain.blitz",
      gameName: "bltz-test-1",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-test-1",
        startTime: "2026-03-18T10:00:00Z",
        twoPlayerMode: true,
      },
    });
  });

  test("parses targeted child game names for grouped recovery", () => {
    expect(
      buildLaunchRotationRequest({
        environment: "appchain.blitz",
        "rotation-name": "bltz-knicker",
        "first-game-start-time": "2026-03-18T10:00:00Z",
        "game-interval-minutes": "60",
        "max-games": "12",
        "evaluation-interval-minutes": "15",
        "target-game-names-json": JSON.stringify(["bltz-knicker-03"]),
      }).targetGameNames,
    ).toEqual(["bltz-knicker-03"]);
  });

  test("parses rotation biome climate overrides by game number from workflow env", () => {
    process.env.GAME_LAUNCH_BIOME_CLIMATE_OVERRIDES_BY_GAME_NUMBER_JSON = JSON.stringify({
      2: {
        elevationSeed: 137,
        moistureSeed: 991,
      },
      3: {
        elevationScaleBps: 12_000,
      },
    });

    expect(
      buildLaunchRotationRequest({
        environment: "appchain.blitz",
        "rotation-name": "bltz-biome-loop",
        "first-game-start-time": "2026-03-18T10:00:00Z",
        "game-interval-minutes": "60",
        "max-games": "12",
        "evaluation-interval-minutes": "15",
      }).biomeClimateOverridesByGameNumber,
    ).toEqual({
      2: {
        elevationSeed: 137,
        moistureSeed: 991,
      },
      3: {
        elevationScaleBps: 12_000,
      },
    });
  });

  test("loads weekly series schedules from a YAML config file", () => {
    const configPath = writeLaunchConfig(`
launchKind: series
environmentId: appchain.blitz
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
      environmentId: "appchain.blitz",
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

  test("loads the committed blitz rotation as a rolling weekly cadence", () => {
    const request = buildLaunchRotationRequest({
      "config-path": join(import.meta.dir, "../examples/blitz-rotation.yaml"),
    });

    expect(request).toMatchObject({
      launchKind: "rotation",
      environmentId: "appchain.blitz",
      rotationName: "blitz-rotation",
      firstGameStartTime: "2026-04-20T01:00:00Z",
      gameIntervalMinutes: 0,
      maxGames: 5200,
      advanceWindowGames: 5,
      evaluationIntervalMinutes: 15,
      durationSeconds: 3600,
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      weeklyCadence: [
        { gameNamePrefix: "na-gladiator", weekday: "monday", utcTime: "01:00" },
        { gameNamePrefix: "apac-gladiator", weekday: "tuesday", utcTime: "11:00" },
        { gameNamePrefix: "na-gladiator", weekday: "wednesday", utcTime: "02:00" },
        { gameNamePrefix: "eu-gladiator", weekday: "wednesday", utcTime: "19:00" },
        { gameNamePrefix: "apac-gladiator", weekday: "thursday", utcTime: "10:00" },
        { gameNamePrefix: "na-gladiator", weekday: "friday", utcTime: "01:00" },
        { gameNamePrefix: "eu-gladiator", weekday: "friday", utcTime: "18:00" },
        { gameNamePrefix: "apac-gladiator", weekday: "saturday", utcTime: "12:00" },
        { gameNamePrefix: "eu-gladiator", weekday: "saturday", utcTime: "20:00" },
        { gameNamePrefix: "na-gladiator", weekday: "sunday", utcTime: "03:00" },
        { gameNamePrefix: "apac-gladiator", weekday: "sunday", utcTime: "11:00" },
        { gameNamePrefix: "eu-gladiator", weekday: "sunday", utcTime: "19:00" },
      ],
    });
  });

  test("lets explicit CLI overrides win over YAML shared launch options", () => {
    const configPath = writeLaunchConfig(`
launchKind: series
environmentId: appchain.blitz
seriesName: blitz-weekly-may-2026
durationSeconds: 86400
twoPlayerMode: false
games:
  - gameName: bltz-weekly-01
    startTime: 2026-05-02T18:00:00Z
`);

    expect(
      buildLaunchSeriesRequest({
        "config-path": configPath,
        "duration-seconds": "3600",
        "two-player-mode": "true",
      }),
    ).toMatchObject({
      durationSeconds: 3600,
      twoPlayerMode: true,
    });
  });

  test("rejects unsupported launch step ids", () => {
    expect(() => resolveLaunchGameStepId("full")).toThrow('Unsupported launch step "full"');
  });

  test("requires an explicit L3 RPC", () => {
    delete process.env.RPC_URL;
    expect(() =>
      buildLaunchGameRequest({
        environment: "madara.blitz",
        game: "bltz-test-1",
        "start-time": "2026-03-18T10:00:00Z",
      }),
    ).toThrow("--rpc-url or RPC_URL is required");
  });
});
