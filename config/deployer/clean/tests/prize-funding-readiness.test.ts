import { describe, expect, test } from "bun:test";
import {
  resolveDefaultSeriesLikePrizeFundingGameNames,
  resolveGamePrizeFundingReadiness,
  resolveSelectedSeriesLikePrizeFundingGameNames,
} from "../prize-funding-readiness";
import type { FactoryRotationRunRecord, FactoryRunRecord, FactorySeriesRunRecord } from "../run-store/types";
import type { SeriesLaunchGameSummary } from "../types";

describe("prize funding readiness", () => {
  test("requires a world address and successful GameRegistry indexing for single games", () => {
    const readyRun = buildGameRunRecord();
    const pendingRun = buildGameRunRecord({
      gameName: "etrn-prize-pending",
      steps: [
        {
          id: "create-world",
          title: "Create world",
          status: "succeeded",
          workflowStepName: "Create world",
          latestEvent: "Created",
        },
        {
          id: "wait-for-factory-index",
          title: "Wait for game",
          status: "running",
          workflowStepName: "Wait for GameRegistry index",
          latestEvent: "Waiting for GameRegistry",
        },
      ],
    });

    expect(resolveGamePrizeFundingReadiness(readyRun)).toEqual({ ready: true });
    expect(resolveGamePrizeFundingReadiness(pendingRun)).toEqual({
      ready: false,
      reason: 'Game "etrn-prize-pending" must be indexed before prize funding',
    });
  });

  test("defaults series funding to ready unfunded games only", () => {
    const runRecord = buildSeriesRunRecord({
      summary: {
        ...buildSeriesRunRecord().summary,
        games: [
          buildSeriesLikeGameSummary({
            gameName: "bltz-weekend-cup-01",
            seriesGameNumber: 1,
            worldAddress: "0x111",
            stepStatus: "succeeded",
          }),
          buildSeriesLikeGameSummary({
            gameName: "bltz-weekend-cup-02",
            seriesGameNumber: 2,
            worldAddress: "0x222",
            stepStatus: "succeeded",
            funded: true,
          }),
          buildSeriesLikeGameSummary({
            gameName: "bltz-weekend-cup-03",
            seriesGameNumber: 3,
            worldAddress: "0x333",
            stepStatus: "running",
          }),
        ],
      },
    });

    expect(resolveDefaultSeriesLikePrizeFundingGameNames(runRecord)).toEqual(["bltz-weekend-cup-01"]);
  });

  test("defaults rotation funding to ready unfunded games only", () => {
    const runRecord = buildRotationRunRecord({
      summary: {
        ...buildRotationRunRecord().summary,
        games: [
          buildSeriesLikeGameSummary({
            gameName: "etrn-season-loop-01",
            seriesGameNumber: 1,
            worldAddress: "0x111",
            stepStatus: "succeeded",
          }),
          buildSeriesLikeGameSummary({
            gameName: "etrn-season-loop-02",
            seriesGameNumber: 2,
            worldAddress: "0x222",
            stepStatus: "succeeded",
            funded: true,
          }),
          buildSeriesLikeGameSummary({
            gameName: "etrn-season-loop-03",
            seriesGameNumber: 3,
            worldAddress: "0x333",
            stepStatus: "running",
          }),
        ],
      },
    });

    expect(resolveDefaultSeriesLikePrizeFundingGameNames(runRecord)).toEqual(["etrn-season-loop-01"]);
  });

  test("rejects explicitly selected games that are not ready", () => {
    const runRecord = buildRotationRunRecord({
      rotationName: "etrn-season-loop",
      seriesName: "etrn-season-loop",
      summary: {
        ...buildRotationRunRecord().summary,
        rotationName: "etrn-season-loop",
        seriesName: "etrn-season-loop",
        games: [
          buildSeriesLikeGameSummary({
            gameName: "etrn-season-loop-01",
            seriesGameNumber: 1,
            worldAddress: "0x111",
            stepStatus: "succeeded",
          }),
          buildSeriesLikeGameSummary({
            gameName: "etrn-season-loop-02",
            seriesGameNumber: 2,
            worldAddress: "0x222",
            stepStatus: "running",
          }),
        ],
      },
    });

    expect(() => resolveSelectedSeriesLikePrizeFundingGameNames(runRecord, ["etrn-season-loop-02"])).toThrow(
      'Game "etrn-season-loop-02" must be indexed before prize funding',
    );
  });
});

function buildGameRunRecord(overrides: Partial<FactoryRunRecord> = {}): FactoryRunRecord {
  return {
    version: 1,
    kind: "game",
    runId: "appchain.eternum:etrn-prize-run",
    environment: "appchain.eternum",
    chain: "appchain",
    gameType: "eternum",
    gameName: "etrn-prize-run",
    status: "attention",
    executionMode: "guided_recovery",
    requestedLaunchStep: "full",
    inputPath: "inputs/appchain/eternum/etrn-prize-run/101-1.json",
    latestLaunchRequestId: "101-1",
    currentStepId: "wait-for-factory-index",
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:10:00.000Z",
    workflow: {
      workflowName: "game-launch.yml",
    },
    steps: [
      {
        id: "create-world",
        title: "Create world",
        status: "succeeded",
        workflowStepName: "Create world",
        latestEvent: "Created",
      },
      {
        id: "wait-for-factory-index",
        title: "Wait for game",
        status: "succeeded",
        workflowStepName: "Wait for GameRegistry index",
        latestEvent: "Indexed",
      },
    ],
    artifacts: {
      worldAddress: "0x111",
    },
    ...overrides,
  };
}

function buildSeriesRunRecord(overrides: Partial<FactorySeriesRunRecord> = {}): FactorySeriesRunRecord {
  return {
    version: 1,
    kind: "series",
    runId: "appchain.blitz:series:bltz-weekend-cup",
    environment: "appchain.blitz",
    chain: "appchain",
    gameType: "blitz",
    seriesName: "bltz-weekend-cup",
    status: "attention",
    executionMode: "guided_recovery",
    requestedLaunchStep: "full",
    inputPath: "inputs/appchain/blitz/series/bltz-weekend-cup/101-1.json",
    latestLaunchRequestId: "101-1",
    currentStepId: "wait-for-factory-indexes",
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:10:00.000Z",
    workflow: {
      workflowName: "game-launch.yml",
    },
    autoRetry: {
      enabled: true,
      intervalMinutes: 15,
    },
    steps: [],
    summary: {
      environment: "appchain.blitz",
      chain: "appchain",
      gameType: "blitz",
      seriesName: "bltz-weekend-cup",
      rpcUrl: "https://rpc.example",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      dryRun: false,
      configMode: "batched",
      seriesCreated: true,
      games: [],
    },
    artifacts: {},
    ...overrides,
  };
}

function buildRotationRunRecord(overrides: Partial<FactoryRotationRunRecord> = {}): FactoryRotationRunRecord {
  return {
    version: 1,
    kind: "rotation",
    runId: "appchain.eternum:rotation:etrn-season-loop",
    environment: "appchain.eternum",
    chain: "appchain",
    gameType: "eternum",
    rotationName: "etrn-season-loop",
    seriesName: "etrn-season-loop",
    status: "attention",
    executionMode: "guided_recovery",
    requestedLaunchStep: "wait-for-factory-indexes",
    inputPath: "inputs/appchain/eternum/rotations/etrn-season-loop/101-1.json",
    latestLaunchRequestId: "101-1",
    currentStepId: "wait-for-factory-indexes",
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:10:00.000Z",
    workflow: {
      workflowName: "game-launch.yml",
    },
    autoRetry: {
      enabled: true,
      intervalMinutes: 15,
    },
    evaluation: {
      intervalMinutes: 30,
    },
    steps: [],
    summary: {
      environment: "appchain.eternum",
      chain: "appchain",
      gameType: "eternum",
      rotationName: "etrn-season-loop",
      seriesName: "etrn-season-loop",
      firstGameStartTime: 1774195200,
      firstGameStartTimeIso: "2026-03-22T16:00:00.000Z",
      gameIntervalMinutes: 60,
      maxGames: 12,
      advanceWindowGames: 5,
      evaluationIntervalMinutes: 30,
      rpcUrl: "https://rpc.example",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      dryRun: false,
      configMode: "batched",
      seriesCreated: true,
      games: [],
    },
    artifacts: {},
    ...overrides,
  };
}

function buildSeriesLikeGameSummary({
  gameName,
  seriesGameNumber,
  worldAddress,
  stepStatus,
  funded = false,
}: {
  gameName: string;
  seriesGameNumber: number;
  worldAddress?: string;
  stepStatus: "pending" | "running" | "succeeded" | "failed";
  funded?: boolean;
}): SeriesLaunchGameSummary {
  return {
    gameName,
    startTime: 1774195200 + (seriesGameNumber - 1) * 3600,
    startTimeIso: new Date((1774195200 + (seriesGameNumber - 1) * 3600) * 1000).toISOString(),
    durationSeconds: 3600,
    seriesGameNumber,
    currentStepId: stepStatus === "succeeded" ? null : "wait-for-factory-indexes",
    latestEvent: stepStatus === "succeeded" ? "Ready" : "Waiting for GameRegistry",
    status: stepStatus === "succeeded" ? "succeeded" : "running",
    configSteps: [],
    steps: [
      {
        id: "wait-for-factory-indexes",
        status: stepStatus,
        latestEvent: stepStatus === "succeeded" ? "Indexed" : "Waiting for GameRegistry",
      },
    ],
    artifacts: {
      worldAddress,
      ...(funded
        ? {
            prizeFunding: {
              transfers: [
                {
                  id: "0xpaid",
                  tokenAddress: "0x123",
                  amountRaw: "100",
                  amountDisplay: "1",
                  decimals: 18,
                  transactionHash: "0xpaid",
                  fundedAt: "2026-03-18T11:00:00.000Z",
                },
              ],
            },
          }
        : {}),
    },
  };
}
