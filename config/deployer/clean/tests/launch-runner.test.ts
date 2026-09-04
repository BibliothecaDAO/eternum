import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { expectedChainId } from "@realms-world/chain/chain-guard";
import { RpcProvider } from "starknet";
import type { LaunchGameSummary } from "../types";

let existingGame: { gameId: number; gameName: string } | null = null;
let loadedSummary: LaunchGameSummary | null = null;
let findGameError: Error | null = null;

const assertRegistrarAvailableMock = mock(() => undefined);
const createRegistrarGameMock = mock(async (...args: unknown[]) => ({
  transactionHash: "0xcreate",
  receipt: { execution_status: "SUCCEEDED" },
  gameId: 7,
  openLedgerTxHash: args[3] ? "0xopen" : undefined,
}));
const createLedgerOperatorAccountMock = mock(() => ({ address: "0xoperator" }));
const createLedgerTreasuryAccountMock = mock(() => ({ address: "0xtreasury" }));
const openLedgerGameMock = mock(async () => ({ transactionHash: "0xopen", receipt: {} }));
const fundLedgerGameToTargetPoolMock = mock(async () => ({ transactionHash: "0xsponsor", receipt: {} }));
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
const originalGetChainId = RpcProvider.prototype.getChainId;

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

mock.module("../ledger/calls", () => ({
  createLedgerOperatorAccount: createLedgerOperatorAccountMock,
  createLedgerTreasuryAccount: createLedgerTreasuryAccountMock,
  fundLedgerGameToTargetPool: fundLedgerGameToTargetPoolMock,
  openLedgerGame: openLedgerGameMock,
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
  RpcProvider.prototype.getChainId = originalGetChainId;
  mock.restore();
});

beforeEach(() => {
  RpcProvider.prototype.getChainId = async function () {
    const nodeUrl = (this as RpcProvider & { channel: { nodeUrl: string } }).channel.nodeUrl;
    return expectedChainId(nodeUrl.includes("mainnet.example") ? "mainnet" : "madara") as Awaited<
      ReturnType<RpcProvider["getChainId"]>
    >;
  };
  existingGame = null;
  loadedSummary = null;
  findGameError = null;
  assertRegistrarAvailableMock.mockClear();
  createRegistrarGameMock.mockClear();
  createLedgerOperatorAccountMock.mockClear();
  createLedgerTreasuryAccountMock.mockClear();
  fundLedgerGameToTargetPoolMock.mockClear();
  openLedgerGameMock.mockClear();
  findGameRegistryByNameMock.mockClear();
  waitForGameRegistryByIdMock.mockClear();
  writeLaunchSummaryMock.mockClear();
  buildCreateGameParamsMock.mockClear();
});

describe("registrar game launch", () => {
  test("refuses a mainnet RPC before an L3 command can submit", async () => {
    await expect(
      launchGame({
        ...buildRequest(),
        rpcUrl: "https://mainnet.example/rpc",
        ledgerAddress: undefined,
        ledgerRpcUrl: undefined,
      }),
    ).rejects.toThrow("RPC_URL is not madara");
    expect(createRegistrarGameMock).not.toHaveBeenCalled();
  });

  test("refuses a lab RPC before an L2 command can submit", async () => {
    await expect(
      launchGame({
        ...buildRequest(),
        ledgerRpcUrl: "http://lab.example/rpc",
      }),
    ).rejects.toThrow("LEDGER_RPC_URL is not Starknet mainnet");
    expect(createRegistrarGameMock).not.toHaveBeenCalled();
  });

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
      openLedgerTxHash: "0xopen",
      outputPath: ".context/game-launch/madara-blitz-bltz-test.json",
    });
  });

  test("opens a dev-off game without the value plane when no ledger is configured", async () => {
    const summary = await launchGame({
      ...buildRequest(),
      devModeOn: false,
      ledgerAddress: undefined,
      ledgerRpcUrl: undefined,
    });

    expect(createRegistrarGameMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "madara.blitz",
      undefined,
    );
    expect(createLedgerOperatorAccountMock).not.toHaveBeenCalled();
    expect(openLedgerGameMock).not.toHaveBeenCalled();
    expect(summary.openLedgerTxHash).toBeUndefined();
  });

  test("reuses a game in the Herald directory instead of submitting create_game again", async () => {
    existingGame = { gameId: 19, gameName: "bltz-test" };
    const lines: string[] = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = mock((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const summary = await runLaunchStep({ ...buildRequest(), stepId: "create-world" });

      expect(createRegistrarGameMock).not.toHaveBeenCalled();
      expect(openLedgerGameMock).toHaveBeenCalledWith(
        expect.objectContaining({ address: "0xoperator" }),
        { address: "0xledger", rpcUrl: "https://mainnet.example/rpc" },
        19,
        8,
        4_070_908_800,
        4_070_912_400,
      );
      expect(summary.gameId).toBe(19);
      expect(summary.worldAddress).toBe("0xworld");
      expect(lines.join("")).toContain('Game "bltz-test" already exists as 19; skipping create_game');
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  test("hydrates the Herald wait from the stored launch summary", async () => {
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
    findGameError = new Error("Herald unavailable");

    await expect(runLaunchStep({ ...buildRequest(), stepId: "create-world" })).rejects.toThrow(
      'Cannot verify whether game "bltz-test" already exists',
    );
    expect(createRegistrarGameMock).not.toHaveBeenCalled();
  });

  test("tops a sponsored game up to the requested mainnet pool", async () => {
    const summary = await launchGame({
      ...buildRequest(),
      lordsAddress: "0xlords",
      sponsoredPoolLords: "48000",
    });

    expect(createLedgerTreasuryAccountMock).toHaveBeenCalledTimes(1);
    expect(fundLedgerGameToTargetPoolMock).toHaveBeenCalledWith(
      { address: "0xtreasury" },
      { address: "0xledger", rpcUrl: "https://mainnet.example/rpc" },
      "0xlords",
      7,
      48_000n * 10n ** 18n,
    );
    expect(summary.sponsorLedgerTxHash).toBe("0xsponsor");
  });

  test("rejects fractional sponsored LORDS before submitting", async () => {
    await expect(launchGame({ ...buildRequest(), lordsAddress: "0xlords", sponsoredPoolLords: "1.5" })).rejects.toThrow(
      "positive whole LORDS",
    );

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
    ledgerAddress: "0xledger",
    ledgerRpcUrl: "https://mainnet.example/rpc",
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
