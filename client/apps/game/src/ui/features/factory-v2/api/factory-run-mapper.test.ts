import { describe, expect, it } from "vitest";
import { mapFactoryWorkerRun } from "./factory-run-mapper";
import type {
  FactoryWorkerGameRunRecord,
  FactoryWorkerRotationRunRecord,
  FactoryWorkerSeriesRunRecord,
} from "./factory-worker";

const buildGameRunRecord = (overrides: Partial<FactoryWorkerGameRunRecord> = {}): FactoryWorkerGameRunRecord => ({
  version: 1,
  runId: "run-1",
  environment: "slot.eternum",
  chain: "slot",
  gameType: "eternum",
  gameName: "etrn-test-9",
  status: "running",
  executionMode: "fast_trial",
  requestedLaunchStep: "full",
  inputPath: "inputs/slot/eternum/etrn-test-9/run-1.json",
  latestLaunchRequestId: "launch-1",
  currentStepId: "wait-for-factory-index",
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T10:01:00.000Z",
  workflow: {
    workflowName: "game-launch.yml",
  },
  recovery: {
    state: "active",
    canContinue: false,
    continueStepId: null,
  },
  steps: [
    {
      id: "create-world",
      title: "Create world",
      status: "succeeded",
      workflowStepName: "Create world",
      latestEvent: "World created.",
    },
    {
      id: "wait-for-factory-index",
      title: "Wait for factory index",
      status: "running",
      workflowStepName: "Wait for factory index",
      latestEvent: "Waiting for rows.",
    },
  ],
  artifacts: {},
  ...overrides,
});

const buildSeriesRunRecord = (overrides: Partial<FactoryWorkerSeriesRunRecord> = {}): FactoryWorkerSeriesRunRecord => ({
  version: 1,
  kind: "series",
  runId: "series-run-1",
  environment: "slot.blitz",
  chain: "slot",
  gameType: "blitz",
  status: "running",
  executionMode: "fast_trial",
  requestedLaunchStep: "full",
  inputPath: "inputs/slot/blitz/series-run-1.json",
  latestLaunchRequestId: "launch-series-1",
  seriesName: "bltz-cup",
  currentStepId: "configure-worlds",
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T10:01:00.000Z",
  workflow: {
    workflowName: "game-launch.yml",
  },
  recovery: {
    state: "stalled",
    canContinue: true,
    continueStepId: "configure-worlds",
  },
  autoRetry: {
    enabled: true,
    intervalMinutes: 15,
  },
  steps: [
    {
      id: "create-series",
      title: "Create series",
      status: "succeeded",
      workflowStepName: "Create series",
      latestEvent: "Series created.",
    },
    {
      id: "configure-worlds",
      title: "Configure worlds",
      status: "running",
      workflowStepName: "Configure worlds",
      latestEvent: "Applying config.",
    },
  ],
  summary: {
    environment: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    seriesName: "bltz-cup",
    rpcUrl: "https://rpc.example",
    factoryAddress: "0x123",
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    dryRun: false,
    configMode: "batched",
    seriesCreated: true,
    games: [
      {
        gameName: "bltz-cup-01",
        startTime: 1,
        startTimeIso: "2026-03-18T12:00:00.000Z",
        seriesGameNumber: 1,
        currentStepId: "configure-worlds",
        latestEvent: "Applying config.",
        status: "running",
        artifacts: {
          worldAddress: "0xabc",
          indexerTier: "basic",
        },
      },
    ],
  },
  artifacts: {},
  ...overrides,
});

const buildRotationRunRecord = (
  overrides: Partial<FactoryWorkerRotationRunRecord> = {},
): FactoryWorkerRotationRunRecord => {
  const queuedStartTime = Date.now() + 60 * 60 * 1000;

  return {
    version: 1,
    kind: "rotation",
    runId: "rotation-run-1",
    environment: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    status: "running",
    executionMode: "fast_trial",
    requestedLaunchStep: "full",
    inputPath: "inputs/slot/blitz/rotation-run-1.json",
    latestLaunchRequestId: "launch-rotation-1",
    rotationName: "bltz-ladder-loop",
    seriesName: "bltz-ladder-loop",
    currentStepId: "create-worlds",
    createdAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-18T10:01:00.000Z",
    workflow: {
      workflowName: "game-launch.yml",
    },
    recovery: {
      state: "active",
      canContinue: false,
      continueStepId: null,
    },
    autoRetry: {
      enabled: true,
      intervalMinutes: 15,
    },
    evaluation: {
      intervalMinutes: 30,
      nextEvaluationAt: "2026-03-18T10:30:00.000Z",
      lastEvaluatedAt: "2026-03-18T10:00:00.000Z",
    },
    steps: [
      {
        id: "create-series",
        title: "Create series",
        status: "succeeded",
        workflowStepName: "Create series",
        latestEvent: "Series created.",
      },
      {
        id: "create-worlds",
        title: "Create worlds",
        status: "running",
        workflowStepName: "Create worlds",
        latestEvent: "Adding the next queued game.",
      },
    ],
    summary: {
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      rotationName: "bltz-ladder-loop",
      seriesName: "bltz-ladder-loop",
      firstGameStartTime: 1710763200,
      firstGameStartTimeIso: "2026-03-18T12:00:00.000Z",
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
      games: [
        {
          gameName: "bltz-ladder-loop-01",
          startTime: Math.floor(queuedStartTime / 1000),
          startTimeIso: new Date(queuedStartTime).toISOString(),
          seriesGameNumber: 1,
          currentStepId: "create-worlds",
          latestEvent: "Queued for setup.",
          status: "running",
          artifacts: {
            worldAddress: "0xabc",
            indexerTier: "basic",
          },
        },
      ],
    },
    artifacts: {},
    ...overrides,
  };
};

describe("mapFactoryWorkerRun", () => {
  it("maps wait steps to the calmer waiting status", () => {
    const run = mapFactoryWorkerRun(buildGameRunRecord());

    expect(run.status).toBe("waiting");
    expect(run.summary).toBe("Waiting for the next step.");
  });

  it("keeps failed steps retryable in the UI model", () => {
    const run = mapFactoryWorkerRun(
      buildGameRunRecord({
        status: "attention",
        currentStepId: "grant-village-pass-role",
        steps: [
          {
            id: "grant-village-pass-role",
            title: "Grant village pass role",
            status: "failed",
            workflowStepName: "Grant village pass role",
            latestEvent: "RPC timed out.",
            errorMessage: "RPC timed out.",
          },
        ],
      }),
    );

    expect(run.status).toBe("attention");
    expect(run.steps[0]?.status).toBe("failed");
    expect(run.steps[0]?.latestEvent).toBe("RPC timed out.");
  });

  it("maps explicit worker recovery state into the UI model", () => {
    const run = mapFactoryWorkerRun(
      buildGameRunRecord({
        recovery: {
          state: "stalled",
          canContinue: true,
          continueStepId: "configure-world",
        },
      }),
    );

    expect(run.recovery).toEqual({
      state: "stalled",
      canContinue: true,
      continueStepId: "configure-world",
    });
  });

  it("maps series runs with children and auto-retry details", () => {
    const run = mapFactoryWorkerRun(buildSeriesRunRecord());

    expect(run.kind).toBe("series");
    expect(run.name).toBe("bltz-cup");
    expect(run.autoRetry).toEqual({
      enabled: true,
      intervalMinutes: 15,
      nextRetryAt: null,
      lastRetryAt: null,
      cancelledAt: null,
      cancelReason: null,
    });
    expect(run.children).toHaveLength(1);
    expect(run.children?.[0]).toMatchObject({
      gameName: "bltz-cup-01",
      seriesGameNumber: 1,
      status: "running",
      worldAddress: "0xabc",
    });
  });

  it("maps rotation runs with evaluation state and queue details", () => {
    const run = mapFactoryWorkerRun(buildRotationRunRecord());

    expect(run.kind).toBe("rotation");
    expect(run.name).toBe("bltz-ladder-loop");
    expect(run.evaluation).toEqual({
      intervalMinutes: 30,
      nextEvaluationAt: "2026-03-18T10:30:00.000Z",
      lastEvaluatedAt: "2026-03-18T10:00:00.000Z",
      lastNudgedAt: null,
    });
    expect(run.rotation).toEqual({
      rotationName: "bltz-ladder-loop",
      maxGames: 12,
      advanceWindowGames: 5,
      createdGameCount: 1,
      queuedGameCount: 1,
      gameIntervalMinutes: 60,
      firstGameStartTimeIso: "2026-03-18T12:00:00.000Z",
    });
  });
});
