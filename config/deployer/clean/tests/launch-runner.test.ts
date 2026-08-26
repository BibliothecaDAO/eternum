import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { LaunchGameSummary } from "../types";

let existingGame: { gameId: number; gameName: string } | null = null;
let loadedSummary: LaunchGameSummary | null = null;
let findGameError: Error | null = null;

const assertRegistrarAvailableMock = mock(() => undefined);
const createRegistrarGameMock = mock(async () => ({
  transactionHash: "0xcreate",
  receipt: { execution_status: "SUCCEEDED" },
  gameId: 7,
}));
const findGameRegistryByNameMock = mock(async () => {
  if (findGameError) {
    throw findGameError;
  }
  return existingGame;
});
const waitForGameRegistryByIdMock = mock(async ({ gameId }: { gameId: number }) => ({
  gameId,
  gameName: "bltz-test",
}));
const writeLaunchSummaryMock = mock(() => ".context/game-launch/madara-blitz-bltz-test.json");
const buildCreateGameParamsMock = mock((_: unknown, params: unknown) => params);

mock.module("../config/config-loader", () => ({
  loadEnvironmentConfiguration: () => buildLaunchConfig(),
  applyDeploymentConfigOverrides: (config: unknown) => config,
}));

mock.module("../registrar/calls", () => ({
  assertRegistrarAvailable: assertRegistrarAvailableMock,
  createRegistrarGame: createRegistrarGameMock,
  resolveRegistrarEnvironmentId: (environmentId: string) => environmentId,
  resolveRegistrarWorldAddress: () => "0xworld",
}));

mock.module("../registrar/game-registry", () => ({
  findGameRegistryByName: findGameRegistryByNameMock,
  waitForGameRegistryById: waitForGameRegistryByIdMock,
}));

mock.module("../registrar/preset", () => ({
  buildCreateGameParams: buildCreateGameParamsMock,
}));

mock.module("../launch/io", () => ({
  loadLaunchSummaryIfPresent: () => loadedSummary,
  writeLaunchSummary: writeLaunchSummaryMock,
}));

const { launchGame, runLaunchStep } = await import("../launch/runner");

afterAll(() => {
  mock.restore();
});

beforeEach(() => {
  existingGame = null;
  loadedSummary = null;
  findGameError = null;
  assertRegistrarAvailableMock.mockClear();
  createRegistrarGameMock.mockClear();
  findGameRegistryByNameMock.mockClear();
  waitForGameRegistryByIdMock.mockClear();
  writeLaunchSummaryMock.mockClear();
  buildCreateGameParamsMock.mockClear();
});

describe("registrar game launch", () => {
  test("creates one game and waits for its GameRegistry row", async () => {
    const summary = await launchGame(buildRequest());

    expect(createRegistrarGameMock).toHaveBeenCalledTimes(1);
    expect(waitForGameRegistryByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 7, timeoutMs: 10_000, pollIntervalMs: 25 }),
    );
    expect(summary).toMatchObject({
      environment: "madara.blitz",
      gameId: 7,
      worldAddress: "0xworld",
      createGameTxHash: "0xcreate",
      outputPath: ".context/game-launch/madara-blitz-bltz-test.json",
    });
  });

  test("reuses an indexed game instead of submitting create_game again", async () => {
    existingGame = { gameId: 19, gameName: "bltz-test" };

    const summary = await runLaunchStep({ ...buildRequest(), stepId: "create-world" });

    expect(createRegistrarGameMock).not.toHaveBeenCalled();
    expect(summary.gameId).toBe(19);
    expect(summary.worldAddress).toBe("0xworld");
  });

  test("hydrates the indexed wait from the stored launch summary", async () => {
    loadedSummary = {
      environment: "madara.blitz",
      chain: "madara",
      gameType: "blitz",
      gameName: "bltz-test",
      startTime: 4_070_908_800,
      startTimeIso: "2099-01-01T00:00:00.000Z",
      rpcUrl: "http://127.0.0.1:5050",
      gameId: 23,
      worldAddress: "0xworld",
      createGameTxHash: "0xstored",
      configMode: "batched",
      configSteps: [],
      dryRun: false,
      outputPath: ".context/game-launch/madara-blitz-bltz-test.json",
    };

    const summary = await runLaunchStep({ ...buildRequest(), stepId: "wait-for-factory-index" });

    expect(findGameRegistryByNameMock).not.toHaveBeenCalled();
    expect(waitForGameRegistryByIdMock).toHaveBeenCalledWith(expect.objectContaining({ gameId: 23 }));
    expect(summary.createGameTxHash).toBe("0xstored");
  });

  test("refuses to create when duplicate detection cannot be trusted", async () => {
    findGameError = new Error("Torii unavailable");

    await expect(runLaunchStep({ ...buildRequest(), stepId: "create-world" })).rejects.toThrow(
      'Cannot verify whether game "bltz-test" already exists',
    );
    expect(createRegistrarGameMock).not.toHaveBeenCalled();
  });

  test("rejects per-game fee token overrides", async () => {
    await expect(
      runLaunchStep({
        ...buildRequest(),
        stepId: "create-world",
        blitzRegistrationOverrides: { fee_token: "0x123" },
      }),
    ).rejects.toThrow("fee_token is chain-global");
    expect(createRegistrarGameMock).not.toHaveBeenCalled();
  });

  test("dry runs never call the registrar", async () => {
    const summary = await launchGame({ ...buildRequest(), dryRun: true });

    expect(assertRegistrarAvailableMock).not.toHaveBeenCalled();
    expect(createRegistrarGameMock).not.toHaveBeenCalled();
    expect(waitForGameRegistryByIdMock).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });
});

function buildRequest() {
  return {
    environmentId: "madara.blitz" as const,
    gameName: "bltz-test",
    startTime: "2099-01-01T00:00:00Z",
    rpcUrl: "http://127.0.0.1:5050",
    accountAddress: "0x123",
    privateKey: "0x456",
    waitForFactoryIndexTimeoutMs: 10_000,
    waitForFactoryIndexPollMs: 25,
  };
}

function buildLaunchConfig() {
  return {
    season: { durationSeconds: 3_600 },
    dev: { mode: { on: false } },
    settlement: { single_realm_mode: false, two_player_mode: false },
  };
}
