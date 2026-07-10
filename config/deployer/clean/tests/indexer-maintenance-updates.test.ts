import { describe, expect, test } from "bun:test";
import { applyIndexerMaintenanceRunUpdates } from "../run-store/indexer-maintenance-updates";
import type { FactoryRotationRunRecord } from "../run-store/types";

describe("indexer maintenance run updates", () => {
  test("updates only the targeted rotation child and preserves fresher sibling state", () => {
    const run = buildRotationRunRecord();

    const nextRun = applyIndexerMaintenanceRunUpdates(run, [
      {
        kind: "tier-success",
        target: {
          gameName: "bltz-warzone-05",
          recordPath: "runs/mainnet/blitz/rotations/bltz-warzone.json",
        },
        message: "Indexer tier updated basic -> pro for bltz-warzone-05",
        updatedAt: "2026-03-25T14:32:40.000Z",
        tier: "pro",
        liveState: {
          state: "existing",
          currentTier: "pro",
          url: "https://api.cartridge.gg/x/bltz-warzone-05/torii",
          version: "v1.8.15",
          branch: "main",
          describedAt: "2026-03-25T14:32:40.000Z",
          stateSource: "describe",
        },
      },
    ]);

    expect(nextRun?.kind).toBe("rotation");

    const updatedGames = (nextRun as FactoryRotationRunRecord).summary.games;
    const updatedWarzone05 = updatedGames.find((game) => game.gameName === "bltz-warzone-05");
    const preservedWarzone10 = updatedGames.find((game) => game.gameName === "bltz-warzone-10");

    expect(updatedWarzone05).toMatchObject({
      gameName: "bltz-warzone-05",
      latestEvent: "Indexer tier updated basic -> pro for bltz-warzone-05",
      artifacts: {
        indexerTier: "pro",
        indexerUrl: "https://api.cartridge.gg/x/bltz-warzone-05/torii",
      },
    });

    expect(preservedWarzone10).toMatchObject({
      gameName: "bltz-warzone-10",
      currentStepId: null,
      latestEvent: "Create indexers succeeded",
      status: "succeeded",
      artifacts: {
        indexerCreated: true,
        indexerTier: "basic",
        indexerUrl: "https://api.cartridge.gg/x/bltz-warzone-10/torii",
      },
    });
  });

  test("marks successful runtime deletes complete and clears AWS runtime artifacts", () => {
    const run = buildRotationRunRecord();

    const nextRun = applyIndexerMaintenanceRunUpdates(run, [
      {
        kind: "runtime-delete-success",
        target: {
          gameName: "bltz-warzone-05",
          recordPath: "runs/mainnet/blitz/rotations/bltz-warzone.json",
        },
        message: "Deleted tagged runtimes",
        updatedAt: "2026-03-25T16:00:00.000Z",
        reason: "expired",
      },
    ]) as FactoryRotationRunRecord;
    const updatedWarzone05 = nextRun.summary.games.find((game) => game.gameName === "bltz-warzone-05");
    const preservedWarzone10 = nextRun.summary.games.find((game) => game.gameName === "bltz-warzone-10");

    expect(updatedWarzone05?.artifacts).toMatchObject({
      indexerCreated: false,
      runtimeTeardown: {
        status: "complete",
        reason: "expired",
        completedAt: "2026-03-25T16:00:00.000Z",
      },
    });
    expect(updatedWarzone05?.artifacts.awsRuntime).toBeUndefined();
    expect(preservedWarzone10?.artifacts.awsRuntime).toBeDefined();
  });

  test("marks failed runtime deletes without clearing runtime artifacts", () => {
    const run = buildRotationRunRecord();

    const nextRun = applyIndexerMaintenanceRunUpdates(run, [
      {
        kind: "runtime-delete-failure",
        target: {
          gameName: "bltz-warzone-05",
          recordPath: "runs/mainnet/blitz/rotations/bltz-warzone.json",
        },
        message: "Runtime delete failed",
        updatedAt: "2026-03-25T16:00:00.000Z",
        reason: "expired",
        errorMessage: "delete failed",
      },
    ]) as FactoryRotationRunRecord;
    const updatedWarzone05 = nextRun.summary.games.find((game) => game.gameName === "bltz-warzone-05");

    expect(updatedWarzone05?.artifacts).toMatchObject({
      awsRuntime: {
        provider: "aws",
        runtimeKind: "torii",
      },
      runtimeTeardown: {
        status: "failed",
        reason: "expired",
        failedAt: "2026-03-25T16:00:00.000Z",
        errorMessage: "delete failed",
      },
    });
  });
});

function buildRotationRunRecord(): FactoryRotationRunRecord {
  return {
    version: 1,
    kind: "rotation",
    runId: "rotation:mainnet.blitz:bltz-warzone",
    environment: "mainnet.blitz",
    chain: "mainnet",
    gameType: "blitz",
    rotationName: "bltz-warzone",
    seriesName: "bltz-warzone",
    status: "running",
    executionMode: "fast_trial",
    requestedLaunchStep: "full",
    inputPath: "inputs/mainnet/blitz/rotations/bltz-warzone/1-1.json",
    latestLaunchRequestId: "1-1",
    currentStepId: "sync-paymaster",
    createdAt: "2026-03-25T14:32:01.000Z",
    updatedAt: "2026-03-25T14:32:35.000Z",
    workflow: {
      workflowName: "Game Launch",
    },
    autoRetry: {
      enabled: true,
      intervalMinutes: 15,
    },
    evaluation: {
      intervalMinutes: 5,
    },
    steps: [],
    summary: {
      environment: "mainnet.blitz",
      chain: "mainnet",
      gameType: "blitz",
      rotationName: "bltz-warzone",
      seriesName: "bltz-warzone",
      firstGameStartTime: 1774504800,
      firstGameStartTimeIso: "2026-03-25T06:00:00.000Z",
      gameIntervalMinutes: 120,
      maxGames: 12,
      advanceWindowGames: 3,
      evaluationIntervalMinutes: 5,
      rpcUrl: "https://rpc.example",
      factoryAddress: "0x123",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      dryRun: false,
      configMode: "batched",
      seriesCreated: true,
      games: [
        {
          gameName: "bltz-warzone-05",
          startTime: 1774519200,
          startTimeIso: "2026-03-25T10:00:00.000Z",
          durationSeconds: 3600,
          seriesGameNumber: 5,
          currentStepId: "create-indexers",
          latestEvent: "Create indexers succeeded",
          status: "succeeded",
          configSteps: [],
          steps: [],
          artifacts: {
            indexerCreated: true,
            indexerTier: "basic",
            indexerUrl: "https://api.cartridge.gg/x/bltz-warzone-05/torii",
            runtimeProvider: "aws",
            awsRuntime: {
              provider: "aws",
              runtimeKind: "torii",
              runtimeName: "bltz-warzone-05",
              status: "existing",
            },
            runtimeTeardown: {
              status: "dispatched",
              requestedAt: "2026-03-25T15:00:00.000Z",
            },
          },
        },
        {
          gameName: "bltz-warzone-10",
          startTime: 1774537200,
          startTimeIso: "2026-03-26T15:00:00.000Z",
          durationSeconds: 3600,
          seriesGameNumber: 10,
          currentStepId: null,
          latestEvent: "Create indexers succeeded",
          status: "succeeded",
          configSteps: [],
          steps: [],
          artifacts: {
            indexerCreated: true,
            indexerTier: "basic",
            indexerUrl: "https://api.cartridge.gg/x/bltz-warzone-10/torii",
            runtimeProvider: "aws",
            awsRuntime: {
              provider: "aws",
              runtimeKind: "torii",
              runtimeName: "bltz-warzone-10",
              status: "existing",
            },
          },
        },
      ],
    },
    artifacts: {
      summaryPath: "runs/mainnet/blitz/rotations/bltz-warzone.summary.json",
      seriesCreated: true,
    },
  };
}
