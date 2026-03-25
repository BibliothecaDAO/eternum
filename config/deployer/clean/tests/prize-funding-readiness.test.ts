import { describe, expect, test } from "bun:test";
import {
  resolveDefaultSeriesLikePrizeFundingGameNames,
  resolveGamePrizeFundingReadiness,
  resolveSelectedSeriesLikePrizeFundingGameNames,
} from "../prize-funding-readiness";
import type { FactoryRotationRunRecord, FactoryRunRecord, FactorySeriesRunRecord } from "../run-store/types";
import type { SeriesLaunchGameSummary } from "../types";

describe("prize funding readiness", () => {
  test("requires a world address and configure-world success for single games", () => {
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
          id: "configure-world",
          title: "Configure world",
          status: "running",
          workflowStepName: "Configure world",
          latestEvent: "Configuring",
        },
      ],
    });

    expect(resolveGamePrizeFundingReadiness(readyRun)).toEqual({ ready: true });
    expect(resolveGamePrizeFundingReadiness(pendingRun)).toEqual({
      ready: false,
      reason: 'Game "etrn-prize-pending" must finish world configuration before prize funding',
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
      'Game "etrn-season-loop-02" must finish world configuration before prize funding',
    );
  });
});

function buildGameRunRecord(overrides: Partial<FactoryRunRecord> = {}): FactoryRunRecord {
  return {
    version: 1,
    kind: "game",
    runId: "slot.eternum:etrn-prize-run",
    environment: "slot.eternum",
    chain: "slot",
    gameType: "eternum",
    gameName: "etrn-prize-run",
    status: "attention",
    executionMode: "guided_recovery",
    requestedLaunchStep: "full",
    inputPath: "inputs/slot/eternum/etrn-prize-run/101-1.json",
    latestLaunchRequestId: "101-1",
    currentStepId: "create-indexer",
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
        id: "configure-world",
        title: "Configure world",
        status: "succeeded",
        workflowStepName: "Configure world",
        latestEvent: "Configured",
      },
      {
        id: "create-indexer",
        title: "Create indexer",
        status: "failed",
        workflowStepName: "Create indexer",
        latestEvent: "Indexer failed",
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
    runId: "slot.blitz:series:bltz-weekend-cup",
    environment: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    seriesName: "bltz-weekend-cup",
    status: "attention",
    executionMode: "guided_recovery",
    requestedLaunchStep: "full",
    inputPath: "inputs/slot/blitz/series/bltz-weekend-cup/101-1.json",
    latestLaunchRequestId: "101-1",
    currentStepId: "create-indexers",
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:10:00.000Z",
    workflow: {
      workflowName: "game-launch.yml",
    },
    steps: [],
    summary: {
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      seriesName: "bltz-weekend-cup",
      rpcUrl: "https://rpc.example",
      factoryAddress: "0x123",
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
    runId: "slot.eternum:rotation:etrn-season-loop",
    environment: "slot.eternum",
    chain: "slot",
    gameType: "eternum",
    rotationName: "etrn-season-loop",
    seriesName: "etrn-season-loop",
    status: "attention",
    executionMode: "guided_recovery",
    requestedLaunchStep: "create-indexers",
    inputPath: "inputs/slot/eternum/rotations/etrn-season-loop/101-1.json",
    latestLaunchRequestId: "101-1",
    currentStepId: "create-indexers",
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
      environment: "slot.eternum",
      chain: "slot",
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
      factoryAddress: "0x123",
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
    currentStepId: stepStatus === "succeeded" ? null : "configure-worlds",
    latestEvent: stepStatus === "succeeded" ? "Ready" : "Configuring",
    status: stepStatus === "succeeded" ? "succeeded" : "running",
    configSteps: [],
    steps: [
      {
        id: "configure-worlds",
        status: stepStatus,
        latestEvent: stepStatus === "succeeded" ? "Configured" : "Configuring",
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
