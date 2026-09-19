import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildLaunchGameRequest } from "../cli/launch-request";

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

  test("defaults launches to the madara preset and the GameRegistry poll budget", () => {
    const madaraRequest = buildLaunchGameRequest({
      environment: "madara.blitz",
      game: "bltz-test-2",
      "start-time": "2026-03-18T10:00:00Z",
    });

    expect(madaraRequest).toMatchObject({
      version: "2",
      waitForFactoryIndexTimeoutMs: 120_000,
      waitForFactoryIndexPollMs: 2_000,
    });
  });

  test("loads a single game from YAML and keeps explicit shared overrides", () => {
    const configPath = writeLaunchConfig(`launchKind: game
environmentId: madara.eternum
gameName: season-one
startTime: 2026-09-21T10:00:00Z
durationSeconds: 86400
`);
    expect(buildLaunchGameRequest({ "config-path": configPath, "duration-seconds": "3600" })).toMatchObject({
      gameName: "season-one",
      environmentId: "madara.eternum",
      durationSeconds: 3600,
    });
  });

  test("uses native writer credentials and explicit overrides, never browser credentials", () => {
    const keys = [
      "DEPLOYER_ACCOUNT_ADDRESS",
      "DEPLOYER_PRIVATE_KEY",
      "VITE_PUBLIC_MASTER_ADDRESS",
      "VITE_PUBLIC_MASTER_PRIVATE_KEY",
    ];
    const original = keys.map((key) => process.env[key]);
    const args = { environment: "madara.blitz", game: "credential-test", "start-time": "1787666400" };
    try {
      delete process.env.DEPLOYER_ACCOUNT_ADDRESS;
      delete process.env.DEPLOYER_PRIVATE_KEY;
      process.env.VITE_PUBLIC_MASTER_ADDRESS = "0x11";
      process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY = "0x12";
      expect(buildLaunchGameRequest(args)).toMatchObject({ accountAddress: undefined, privateKey: undefined });

      process.env.DEPLOYER_ACCOUNT_ADDRESS = "0x21";
      process.env.DEPLOYER_PRIVATE_KEY = "0x22";
      expect(buildLaunchGameRequest(args)).toMatchObject({ accountAddress: "0x21", privateKey: "0x22" });
      expect(buildLaunchGameRequest({ ...args, "account-address": "0x31", "private-key": "0x32" })).toMatchObject({
        accountAddress: "0x31",
        privateKey: "0x32",
      });
    } finally {
      keys.forEach((key, index) => {
        if (original[index] === undefined) delete process.env[key];
        else process.env[key] = original[index];
      });
    }
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

test("rejects retired series launches instead of silently creating one game", () => {
  expect(() =>
    buildLaunchGameRequest({
      "launch-kind": "series",
      environment: "madara.blitz",
      game: "old-series",
      "start-time": "1789819200",
    }),
  ).toThrow("Only game launches");
});
