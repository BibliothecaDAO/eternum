import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  acquireFactoryAccountLease,
  heartbeatFactoryAccountLease,
  recordFactoryLaunchStarted,
  recordFactoryRotationLaunchStarted,
  recordFactoryRotationLaunchStepSucceeded,
  recordFactorySeriesLaunchStarted,
  recordFactorySeriesLaunchStepSucceeded,
  recordFactoryLaunchStepFailed,
  recordFactoryLaunchStepStarted,
  recordFactoryLaunchStepSucceeded,
  releaseFactoryAccountLeaseRecord,
} from "../run-store";
import { resolveRepoPath } from "../shared/repo";
import type { LaunchGameSummary, LaunchRotationSummary } from "../types";

const ENV_KEYS = [
  "GITHUB_ACTIONS",
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "GITHUB_API_URL",
  "GITHUB_SHA",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_WORKFLOW",
  "GITHUB_JOB",
  "GITHUB_SERVER_URL",
  "GITHUB_REF_NAME",
  "FACTORY_RUN_STORE_BRANCH",
  "FACTORY_RUN_LEASE_DURATION_SECONDS",
  "FACTORY_ACCOUNT_LEASE_DURATION_SECONDS",
] as const;

const originalEnv = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const summaryPaths = [
  resolveSummaryPath("slot.blitz", "bltz-flux-730"),
  resolveSummaryPath("mainnet.blitz", "bltz-mainnet-730"),
  resolveRotationSummaryPath("slot.blitz", "bltz-rotationx"),
  resolveRotationSummaryPath("slot.blitz", "bltz-recovery-case"),
];

beforeEach(() => {
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY = "bibliotheca/eternum";
  process.env.GITHUB_API_URL = "https://api.github.example";
  process.env.GITHUB_SHA = "deadbeef";
  process.env.GITHUB_RUN_ID = "101";
  process.env.GITHUB_RUN_ATTEMPT = "1";
  process.env.GITHUB_WORKFLOW = "Game Launch";
  process.env.GITHUB_JOB = "launch";
  process.env.GITHUB_SERVER_URL = "https://github.example";
  process.env.GITHUB_REF_NAME = "credence0x/factory-run-store";
  process.env.FACTORY_RUN_STORE_BRANCH = "factory-runs";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  globalThis.fetch = originalFetch;

  for (const summaryPath of summaryPaths) {
    if (fs.existsSync(summaryPath)) {
      fs.unlinkSync(summaryPath);
    }
  }
});

describe("factory run store", () => {
  test("records launch input and initializes a run record on the storage branch", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const inputRecord = branchStore.readJson("inputs/slot/blitz/bltz-flux-730/101-1.json");
    const runRecord = branchStore.readJson("runs/slot/blitz/bltz-flux-730.json");

    expect(inputRecord.launchRequestId).toBe("101-1");
    expect(runRecord.status).toBe("running");
    expect(runRecord.currentStepId).toBe("create-world");
    expect(runRecord.executionMode).toBe("fast_trial");
    expect(runRecord.steps.map((step: { id: string }) => step.id)).toEqual([
      "create-world",
      "wait-for-factory-index",
      "configure-world",
      "grant-lootchest-role",
      "create-indexer",
    ]);
  });

  test("adds the paymaster step for mainnet blitz launches", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "mainnet.blitz",
      gameName: "bltz-mainnet-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "mainnet.blitz",
        gameName: "bltz-mainnet-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/mainnet/blitz/bltz-mainnet-730.json");

    expect(runRecord.steps.map((step: { id: string }) => step.id)).toEqual([
      "create-world",
      "wait-for-factory-index",
      "configure-world",
      "grant-lootchest-role",
      "create-indexer",
      "sync-paymaster",
    ]);
  });

  test("keeps eternum launch steps and adds paymaster for mainnet eternum", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "mainnet.eternum",
      gameName: "etrn-mainnet-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "mainnet.eternum",
        gameName: "etrn-mainnet-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/mainnet/eternum/etrn-mainnet-730.json");

    expect(runRecord.steps.map((step: { id: string }) => step.id)).toEqual([
      "create-world",
      "wait-for-factory-index",
      "configure-world",
      "grant-lootchest-role",
      "grant-village-pass-role",
      "create-banks",
      "create-indexer",
      "sync-paymaster",
    ]);
  });

  test("persists map config overrides inside the stored launch request", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "slot.eternum",
      gameName: "etrn-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.eternum",
        gameName: "etrn-flux-730",
        startTime: "2026-03-18T10:00:00Z",
        mapConfigOverrides: {
          bitcoinMineWinProbability: 1638,
          bitcoinMineFailProbability: 63897,
        },
      },
    });

    const inputRecord = branchStore.readJson("inputs/slot/eternum/etrn-flux-730/101-1.json");

    expect(inputRecord.request.mapConfigOverrides).toEqual({
      bitcoinMineWinProbability: 1638,
      bitcoinMineFailProbability: 63897,
    });
  });

  test("persists blitz registration overrides inside the stored launch request", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-731",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-731",
        startTime: "2026-03-18T10:00:00Z",
        blitzRegistrationOverrides: {
          registration_count_max: 12,
          fee_token: "0x1234",
          fee_amount: "40000",
        },
      },
    });

    const inputRecord = branchStore.readJson("inputs/slot/blitz/bltz-flux-731/101-1.json");

    expect(inputRecord.request.blitzRegistrationOverrides).toEqual({
      registration_count_max: 12,
      fee_token: "0x1234",
      fee_amount: "40000",
    });
  });

  test("records successful step output into the run artifacts", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    writeLaunchSummaryFile({
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      gameName: "bltz-flux-730",
      startTime: 1710756000,
      startTimeIso: "2026-03-18T10:00:00.000Z",
      rpcUrl: "https://rpc.example",
      factoryAddress: "0x123",
      createGameTxHash: "0xabc",
      indexerCreated: false,
      configMode: "batched",
      configSteps: [],
      dryRun: false,
    });

    await recordFactoryLaunchStepSucceeded({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "create-world",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/slot/blitz/bltz-flux-730.json");

    expect(runRecord.artifacts.createGameTxHash).toBe("0xabc");
    expect(runRecord.artifacts.summaryPath).toBe(".context/game-launch/slot-blitz-bltz-flux-730.json");
    expect(runRecord.status).toBe("running");
    expect(runRecord.currentStepId).toBe("wait-for-factory-index");
    expect(runRecord.activeLease).toBeUndefined();
    expect(runRecord.steps.find((step: { id: string }) => step.id === "create-world")?.status).toBe("succeeded");
  });

  test("records paymaster completion in launch artifacts", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "mainnet.blitz",
      gameName: "bltz-mainnet-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "mainnet.blitz",
        gameName: "bltz-mainnet-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    writeLaunchSummaryFile({
      environment: "mainnet.blitz",
      chain: "mainnet",
      gameType: "blitz",
      gameName: "bltz-mainnet-730",
      startTime: 1710756000,
      startTimeIso: "2026-03-18T10:00:00.000Z",
      rpcUrl: "https://rpc.example",
      factoryAddress: "0x123",
      paymasterSynced: true,
      indexerCreated: true,
      configMode: "batched",
      configSteps: [],
      dryRun: false,
    });

    await recordFactoryLaunchStepSucceeded({
      environmentId: "mainnet.blitz",
      gameName: "bltz-mainnet-730",
      requestedLaunchStep: "full",
      stepId: "sync-paymaster",
      request: {
        environmentId: "mainnet.blitz",
        gameName: "bltz-mainnet-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/mainnet/blitz/bltz-mainnet-730.json");

    expect(runRecord.artifacts.paymasterSynced).toBe(true);
    expect(runRecord.artifacts.summaryPath).toBe(".context/game-launch/mainnet-blitz-bltz-mainnet-730.json");
  });

  test("preserves the current rotation summary when a new workflow starts for an existing rotation", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    const existingSummary = {
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      rotationName: "bltz-rotationx",
      seriesName: "bltz-rotationx",
      firstGameStartTime: 4_070_908_800,
      firstGameStartTimeIso: "2099-01-01T00:00:00.000Z",
      gameIntervalMinutes: 60,
      maxGames: 12,
      advanceWindowGames: 5,
      evaluationIntervalMinutes: 15,
      rpcUrl: "https://rpc.example",
      factoryAddress: "0x123",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      dryRun: false,
      configMode: "batched",
      seriesCreated: true,
      seriesCreatedAt: "2098-12-31T23:50:00.000Z",
      games: [
        buildRotationTestGame("bltz-rotationx-01", 1, 4_070_908_800),
        buildRotationTestGame("bltz-rotationx-02", 2, 4_070_912_400),
        buildRotationTestGame("bltz-rotationx-03", 3, 4_070_916_000),
        buildRotationTestGame("bltz-rotationx-04", 4, 4_070_919_600),
        buildRotationTestGame("bltz-rotationx-05", 5, 4_070_923_200),
      ],
      outputPath: ".context/game-launch/rotation-slot-blitz-bltz-rotationx.json",
    } as const;

    branchStore.writeJson("runs/slot/blitz/rotations/bltz-rotationx.json", {
      version: 1,
      kind: "rotation",
      runId: "slot.blitz:rotation:bltz-rotationx",
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      rotationName: "bltz-rotationx",
      seriesName: "bltz-rotationx",
      status: "attention",
      executionMode: "guided_recovery",
      requestedLaunchStep: "full",
      inputPath: "inputs/slot/blitz/rotations/bltz-rotationx/101-1.json",
      latestLaunchRequestId: "101-1",
      currentStepId: "create-worlds",
      createdAt: "2098-12-31T23:50:00.000Z",
      updatedAt: "2098-12-31T23:55:00.000Z",
      workflow: { workflowName: "game-launch.yml" },
      autoRetry: { enabled: true, intervalMinutes: 15, nextRetryAt: "2099-01-01T00:10:00.000Z" },
      evaluation: { intervalMinutes: 15, nextEvaluationAt: "2099-01-01T00:10:00.000Z" },
      steps: [
        buildRotationTestRunStep("create-series", "succeeded"),
        buildRotationTestRunStep("create-worlds", "pending"),
        buildRotationTestRunStep("wait-for-factory-indexes", "pending"),
        buildRotationTestRunStep("configure-worlds", "pending"),
        buildRotationTestRunStep("grant-lootchest-roles", "pending"),
        buildRotationTestRunStep("grant-village-pass-roles", "pending"),
        buildRotationTestRunStep("create-banks", "pending"),
        buildRotationTestRunStep("create-indexers", "pending"),
        buildRotationTestRunStep("sync-paymaster", "pending"),
      ],
      summary: existingSummary,
      artifacts: {
        summaryPath: existingSummary.outputPath,
        seriesCreated: true,
        seriesCreatedAt: existingSummary.seriesCreatedAt,
      },
    });

    await recordFactoryRotationLaunchStarted({
      environmentId: "slot.blitz",
      rotationName: "bltz-rotationx",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        rotationName: "bltz-rotationx",
        firstGameStartTime: "2099-01-01T00:00:00Z",
        gameIntervalMinutes: 60,
        maxGames: 12,
        advanceWindowGames: 5,
        evaluationIntervalMinutes: 15,
      },
    });

    const inputRecord = branchStore.readJson("inputs/slot/blitz/rotations/bltz-rotationx/101-1.json");
    const runRecord = branchStore.readJson("runs/slot/blitz/rotations/bltz-rotationx.json");

    expect(inputRecord.request.resumeSummary).toBeUndefined();
    expect(runRecord.summary.seriesCreated).toBe(true);
    expect(runRecord.summary.games.map((game: { gameName: string }) => game.gameName)).toEqual(
      existingSummary.games.map((game) => game.gameName),
    );
    expect(runRecord.summary.games.map((game: { seriesGameNumber: number }) => game.seriesGameNumber)).toEqual(
      existingSummary.games.map((game) => game.seriesGameNumber),
    );
    expect(runRecord.summary.games.map((game: { startTimeIso: string }) => game.startTimeIso)).toEqual(
      existingSummary.games.map((game) => game.startTimeIso),
    );
  });

  test("returns grouped rotation indexers to pending after the selected child recovers", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    branchStore.writeJson("runs/slot/blitz/rotations/bltz-recovery-case.json", {
      version: 1,
      kind: "rotation",
      runId: "slot.blitz:rotation:bltz-recovery-case",
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      rotationName: "bltz-recovery-case",
      seriesName: "bltz-recovery-case",
      status: "attention",
      executionMode: "guided_recovery",
      requestedLaunchStep: "create-indexers",
      inputPath: "inputs/slot/blitz/rotations/bltz-recovery-case/101-1.json",
      latestLaunchRequestId: "101-1",
      currentStepId: "create-indexers",
      createdAt: "2098-12-31T23:50:00.000Z",
      updatedAt: "2098-12-31T23:55:00.000Z",
      workflow: { workflowName: "game-launch.yml" },
      autoRetry: { enabled: true, intervalMinutes: 15, nextRetryAt: "2099-01-01T00:10:00.000Z" },
      evaluation: { intervalMinutes: 15, nextEvaluationAt: "2099-01-01T00:10:00.000Z" },
      steps: [
        buildRotationTestRunStep("create-series", "succeeded"),
        buildRotationTestRunStep("create-worlds", "succeeded"),
        buildRotationTestRunStep("wait-for-factory-indexes", "succeeded"),
        buildRotationTestRunStep("configure-worlds", "succeeded"),
        buildRotationTestRunStep("grant-lootchest-roles", "succeeded"),
        buildRotationTestRunStep("grant-village-pass-roles", "succeeded"),
        buildRotationTestRunStep("create-banks", "succeeded"),
        buildRotationTestRunStep("create-indexers", "failed"),
        buildRotationTestRunStep("sync-paymaster", "pending"),
      ],
      summary: {
        environment: "slot.blitz",
        chain: "slot",
        gameType: "blitz",
        rotationName: "bltz-recovery-case",
        seriesName: "bltz-recovery-case",
        firstGameStartTime: 4_070_908_800,
        firstGameStartTimeIso: "2099-01-01T00:00:00.000Z",
        gameIntervalMinutes: 60,
        maxGames: 12,
        advanceWindowGames: 5,
        evaluationIntervalMinutes: 15,
        rpcUrl: "https://rpc.example",
        factoryAddress: "0x123",
        autoRetryEnabled: true,
        autoRetryIntervalMinutes: 15,
        dryRun: false,
        configMode: "batched",
        seriesCreated: true,
        games: [
          {
            ...buildRotationTestGame("bltz-recovery-case-01", 1, 4_070_908_800),
            status: "succeeded",
            steps: [{ id: "create-indexers", status: "succeeded" }],
          },
          {
            ...buildRotationTestGame("bltz-recovery-case-02", 2, 4_070_912_400),
            currentStepId: "create-indexers",
            latestEvent: "create-indexers failed",
            status: "failed",
            steps: [{ id: "create-indexers", status: "failed" }],
          },
        ],
        outputPath: ".context/game-launch/rotation-slot-blitz-bltz-recovery-case.json",
      },
      artifacts: {
        summaryPath: ".context/game-launch/rotation-slot-blitz-bltz-recovery-case.json",
        seriesCreated: true,
        seriesCreatedAt: "2098-12-31T23:50:00.000Z",
      },
    });

    writeRotationSummaryFile({
      environment: "slot.blitz",
      chain: "slot",
      gameType: "blitz",
      rotationName: "bltz-recovery-case",
      seriesName: "bltz-recovery-case",
      firstGameStartTime: 4_070_908_800,
      firstGameStartTimeIso: "2099-01-01T00:00:00.000Z",
      gameIntervalMinutes: 60,
      maxGames: 12,
      advanceWindowGames: 5,
      evaluationIntervalMinutes: 15,
      rpcUrl: "https://rpc.example",
      factoryAddress: "0x123",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      dryRun: false,
      configMode: "batched",
      seriesCreated: true,
      games: [
        {
          ...buildRotationTestGame("bltz-recovery-case-01", 1, 4_070_908_800),
          status: "succeeded",
          steps: [{ id: "create-indexers", status: "succeeded" }],
        },
        {
          ...buildRotationTestGame("bltz-recovery-case-02", 2, 4_070_912_400),
          status: "succeeded",
          steps: [{ id: "create-indexers", status: "succeeded" }],
        },
      ],
      outputPath: ".context/game-launch/rotation-slot-blitz-bltz-recovery-case.json",
    });

    await recordFactoryRotationLaunchStepSucceeded({
      environmentId: "slot.blitz",
      rotationName: "bltz-recovery-case",
      requestedLaunchStep: "create-indexers",
      stepId: "create-indexers",
      request: {
        environmentId: "slot.blitz",
        rotationName: "bltz-recovery-case",
        firstGameStartTime: "2099-01-01T00:00:00Z",
        gameIntervalMinutes: 60,
        maxGames: 12,
        advanceWindowGames: 5,
        evaluationIntervalMinutes: 15,
      },
    });

    const runRecord = branchStore.readJson("runs/slot/blitz/rotations/bltz-recovery-case.json");
    const createIndexersStep = runRecord.steps.find((step: { id: string }) => step.id === "create-indexers");

    expect(runRecord.status).toBe("running");
    expect(createIndexersStep?.status).toBe("pending");
    expect(createIndexersStep?.latestEvent).toContain("Waiting to run");
  });

  test("rewrites a targeted series child indexer status without a refreshed workspace summary", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactorySeriesLaunchStarted({
      environmentId: "slot.blitz",
      seriesName: "bltz-series-recovery",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        seriesName: "bltz-series-recovery",
        games: [
          { gameName: "bltz-series-recovery-01", startTime: "2099-01-01T00:00:00Z" },
          { gameName: "bltz-series-recovery-02", startTime: "2099-01-01T01:00:00Z" },
        ],
      },
    });

    const runPath = "runs/slot/blitz/series/bltz-series-recovery.json";
    const staleRun = branchStore.readJson(runPath);
    branchStore.writeJson(runPath, {
      ...staleRun,
      status: "attention",
      currentStepId: "create-indexers",
      steps: staleRun.steps.map((step: { id: string }) =>
        step.id === "create-indexers"
          ? markTestRunStepStatus(step, "failed", "Create indexers failed", "Timed out waiting for torii")
          : step,
      ),
      summary: {
        ...staleRun.summary,
        games: [
          markTestGameStepStatus(
            staleRun.summary.games[0],
            "create-indexers",
            "succeeded",
            "Create indexers succeeded",
          ),
          markTestGameStepStatus(
            staleRun.summary.games[1],
            "create-indexers",
            "failed",
            "factory-torii-deployer #816 failed",
            "Timed out waiting for torii",
          ),
        ],
      },
    });

    await recordFactorySeriesLaunchStepSucceeded({
      environmentId: "slot.blitz",
      seriesName: "bltz-series-recovery",
      requestedLaunchStep: "create-indexers",
      stepId: "create-indexers",
      request: {
        environmentId: "slot.blitz",
        seriesName: "bltz-series-recovery",
        targetGameNames: ["bltz-series-recovery-02"],
        games: [
          { gameName: "bltz-series-recovery-01", startTime: "2099-01-01T00:00:00Z" },
          { gameName: "bltz-series-recovery-02", startTime: "2099-01-01T01:00:00Z" },
        ],
      },
    });

    const runRecord = branchStore.readJson(runPath);
    const recoveredGame = runRecord.summary.games.find(
      (game: { gameName: string }) => game.gameName === "bltz-series-recovery-02",
    );

    expect(recoveredGame?.status).toBe("succeeded");
    expect(recoveredGame?.currentStepId).toBeNull();
    expect(recoveredGame?.latestEvent).toContain("succeeded");
    expect(recoveredGame?.artifacts?.indexerCreated).toBe(true);
    expect(recoveredGame?.steps.find((step: { id: string }) => step.id === "create-indexers")?.status).toBe(
      "succeeded",
    );
    expect(
      recoveredGame?.steps.find((step: { id: string }) => step.id === "create-indexers")?.errorMessage,
    ).toBeUndefined();
  });

  test("rewrites a targeted rotation child indexer status without a refreshed workspace summary", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryRotationLaunchStarted({
      environmentId: "slot.blitz",
      rotationName: "bltz-rotation-recovery",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        rotationName: "bltz-rotation-recovery",
        firstGameStartTime: "2099-01-01T00:00:00Z",
        gameIntervalMinutes: 60,
        maxGames: 2,
        advanceWindowGames: 2,
        evaluationIntervalMinutes: 15,
      },
    });

    const runPath = "runs/slot/blitz/rotations/bltz-rotation-recovery.json";
    const staleRun = branchStore.readJson(runPath);
    branchStore.writeJson(runPath, {
      ...staleRun,
      status: "attention",
      currentStepId: "create-indexers",
      steps: staleRun.steps.map((step: { id: string }) =>
        step.id === "create-indexers"
          ? markTestRunStepStatus(step, "failed", "Create indexers failed", "Timed out waiting for torii")
          : step,
      ),
      summary: {
        ...staleRun.summary,
        games: [
          markTestGameStepStatus(
            staleRun.summary.games[0],
            "create-indexers",
            "succeeded",
            "Create indexers succeeded",
          ),
          markTestGameStepStatus(
            staleRun.summary.games[1],
            "create-indexers",
            "failed",
            "factory-torii-deployer #816 failed",
            "Timed out waiting for torii",
          ),
        ],
      },
    });

    await recordFactoryRotationLaunchStepSucceeded({
      environmentId: "slot.blitz",
      rotationName: "bltz-rotation-recovery",
      requestedLaunchStep: "create-indexers",
      stepId: "create-indexers",
      request: {
        environmentId: "slot.blitz",
        rotationName: "bltz-rotation-recovery",
        firstGameStartTime: "2099-01-01T00:00:00Z",
        gameIntervalMinutes: 60,
        maxGames: 2,
        advanceWindowGames: 2,
        evaluationIntervalMinutes: 15,
        targetGameNames: ["bltz-rotation-recovery-02"],
      },
    });

    const runRecord = branchStore.readJson(runPath);
    const recoveredGame = runRecord.summary.games.find(
      (game: { gameName: string }) => game.gameName === "bltz-rotation-recovery-02",
    );

    expect(recoveredGame?.status).toBe("succeeded");
    expect(recoveredGame?.currentStepId).toBeNull();
    expect(recoveredGame?.latestEvent).toContain("succeeded");
    expect(recoveredGame?.artifacts?.indexerCreated).toBe(true);
    expect(recoveredGame?.steps.find((step: { id: string }) => step.id === "create-indexers")?.status).toBe(
      "succeeded",
    );
    expect(
      recoveredGame?.steps.find((step: { id: string }) => step.id === "create-indexers")?.errorMessage,
    ).toBeUndefined();
  });

  test("marks a failed step as needing attention", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepFailed({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "wait-for-factory-index",
      errorMessage: "Timed out waiting for factory SQL",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/slot/blitz/bltz-flux-730.json");
    const failedStep = runRecord.steps.find((step: { id: string }) => step.id === "wait-for-factory-index");

    expect(runRecord.status).toBe("attention");
    expect(runRecord.currentStepId).toBe("wait-for-factory-index");
    expect(failedStep?.status).toBe("failed");
    expect(failedStep?.errorMessage).toContain("Timed out waiting for factory SQL");
  });

  test("blocks a conflicting launch while a fresh lease is active", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepSucceeded({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "create-world",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "wait-for-factory-index",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    process.env.GITHUB_RUN_ID = "202";

    await expect(
      recordFactoryLaunchStarted({
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        requestedLaunchStep: "full",
        request: {
          environmentId: "slot.blitz",
          gameName: "bltz-flux-730",
          startTime: "2026-03-18T10:00:00Z",
        },
      }),
    ).rejects.toThrow("Another launch is already running");
  });

  test("allows a new launch to take over when the old lease is stale", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;
    process.env.FACTORY_RUN_LEASE_DURATION_SECONDS = "1";

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "create-world",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const staleRun = branchStore.readJson("runs/slot/blitz/bltz-flux-730.json");
    branchStore.writeJson("runs/slot/blitz/bltz-flux-730.json", {
      ...staleRun,
      activeLease: {
        ...staleRun.activeLease,
        expiresAt: "2000-01-01T00:00:00.000Z",
      },
    });

    process.env.GITHUB_RUN_ID = "202";

    await recordFactoryLaunchStarted({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "slot.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/slot/blitz/bltz-flux-730.json");

    expect(runRecord.latestLaunchRequestId).toBe("202-1");
    expect(runRecord.activeLease).toBeUndefined();
  });

  test("acquires an account lease for nonce-writing steps", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    const lease = await acquireFactoryAccountLease({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    const leaseRecord = branchStore.readJson("locks/accounts/slot/0xabc123.json");

    expect(lease.owner.stepId).toBe("create-world");
    expect(leaseRecord.owner.gameName).toBe("bltz-flux-730");
    expect(leaseRecord.releasedAt).toBeUndefined();
  });

  test("blocks a conflicting account lease while the current owner is active", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await acquireFactoryAccountLease({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    process.env.GITHUB_RUN_ID = "202";

    await expect(
      acquireFactoryAccountLease({
        environmentId: "slot.eternum",
        gameName: "etrn-flux-730",
        accountAddress: "0xabc123",
        stepId: "configure-world",
      }),
    ).rejects.toThrow("Account 0xabc123 is already in use");
  });

  test("allows a stale account lease to be taken over", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;
    process.env.FACTORY_ACCOUNT_LEASE_DURATION_SECONDS = "1";

    await acquireFactoryAccountLease({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    const staleLease = branchStore.readJson("locks/accounts/slot/0xabc123.json");
    branchStore.writeJson("locks/accounts/slot/0xabc123.json", {
      ...staleLease,
      expiresAt: "2000-01-01T00:00:00.000Z",
    });

    process.env.GITHUB_RUN_ID = "202";

    const refreshedLease = await acquireFactoryAccountLease({
      environmentId: "slot.eternum",
      gameName: "etrn-flux-730",
      accountAddress: "0xabc123",
      stepId: "configure-world",
    });

    expect(refreshedLease.owner.gameName).toBe("etrn-flux-730");
    expect(refreshedLease.owner.launchRequestId).toBe("202-1");
  });

  test("heartbeats and releases the active account lease", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;
    process.env.FACTORY_ACCOUNT_LEASE_DURATION_SECONDS = "60";

    const lease = await acquireFactoryAccountLease({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    const originalLease = branchStore.readJson("locks/accounts/slot/0xabc123.json");
    branchStore.writeJson("locks/accounts/slot/0xabc123.json", {
      ...originalLease,
      heartbeatAt: "2000-01-01T00:00:00.000Z",
      expiresAt: "2000-01-01T00:01:00.000Z",
    });
    const staleLease = branchStore.readJson("locks/accounts/slot/0xabc123.json");

    await heartbeatFactoryAccountLease({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
      leaseId: lease.owner.leaseId,
    });

    const heartbeatedLease = branchStore.readJson("locks/accounts/slot/0xabc123.json");

    await releaseFactoryAccountLeaseRecord({
      environmentId: "slot.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
      leaseId: lease.owner.leaseId,
    });

    const releasedLease = branchStore.readJson("locks/accounts/slot/0xabc123.json");

    expect(Date.parse(heartbeatedLease.expiresAt)).toBeGreaterThan(Date.parse(staleLease.expiresAt));
    expect(releasedLease.releasedAt).toBeTruthy();
    expect(releasedLease.expiresAt).toBe(releasedLease.releasedAt);
  });
});

function writeLaunchSummaryFile(summary: LaunchGameSummary): void {
  fs.mkdirSync(resolveRepoPath(".context/game-launch"), { recursive: true });
  fs.writeFileSync(resolveSummaryPath(summary.environment, summary.gameName), `${JSON.stringify(summary, null, 2)}\n`);
}

function writeRotationSummaryFile(summary: LaunchRotationSummary): void {
  fs.mkdirSync(resolveRepoPath(".context/game-launch"), { recursive: true });
  fs.writeFileSync(
    resolveRotationSummaryPath(summary.environment, summary.rotationName),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
}

function resolveSummaryPath(environmentId: string, gameName: string): string {
  return resolveRepoPath(
    `.context/game-launch/${environmentId.replace(".", "-")}-${gameName.replace(/[^a-zA-Z0-9-_]/g, "-")}.json`,
  );
}

function resolveRotationSummaryPath(environmentId: string, rotationName: string): string {
  return resolveRepoPath(
    `.context/game-launch/rotation-${environmentId.replace(".", "-")}-${rotationName.replace(/[^a-zA-Z0-9-_]/g, "-")}.json`,
  );
}

function buildRotationTestRunStep(id: string, status: string) {
  return {
    id,
    title: id,
    status,
    workflowStepName: id,
    latestEvent: "Waiting to run",
  };
}

function buildRotationTestGame(gameName: string, seriesGameNumber: number, startTime: number) {
  return {
    gameName,
    startTime,
    startTimeIso: new Date(startTime * 1000).toISOString(),
    seriesGameNumber,
    currentStepId: null,
    latestEvent: "Waiting to run",
    status: "pending",
    configSteps: [],
    steps: [],
    artifacts: {},
  };
}

function markTestRunStepStatus(
  step: {
    id: string;
    title: string;
    workflowStepName: string;
    latestEvent: string;
    status: string;
    errorMessage?: string;
  },
  status: string,
  latestEvent: string,
  errorMessage?: string,
) {
  return {
    ...step,
    status,
    latestEvent,
    errorMessage,
  };
}

function markTestGameStepStatus(
  game: {
    currentStepId: string | null;
    latestEvent: string;
    status: string;
    steps: Array<{ id: string; status: string; latestEvent?: string; errorMessage?: string; updatedAt?: string }>;
    artifacts: Record<string, unknown>;
  },
  stepId: string,
  status: string,
  latestEvent: string,
  errorMessage?: string,
) {
  return {
    ...game,
    currentStepId: status === "succeeded" ? null : stepId,
    latestEvent,
    status,
    steps: game.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status,
            latestEvent,
            errorMessage,
          }
        : step,
    ),
    artifacts:
      stepId === "create-indexers" && status === "succeeded"
        ? {
            ...game.artifacts,
            indexerCreated: true,
          }
        : game.artifacts,
  };
}

function createBranchStoreFetch() {
  let branchExists = false;
  let version = 0;
  const files = new Map<string, { sha: string; content: string }>();

  return {
    fetch: (async (input, init) => {
      const url = String(input);

      if (url.endsWith("/git/ref/heads/factory-runs")) {
        if (!branchExists) {
          return new Response("Not Found", { status: 404 });
        }

        return Response.json({
          object: {
            sha: "branch-sha",
          },
        });
      }

      if (url.endsWith("/git/refs") && init?.method === "POST") {
        branchExists = true;
        return Response.json({
          ref: "refs/heads/factory-runs",
        });
      }

      if (url.includes("/contents/") && init?.method !== "PUT") {
        const filePath = decodeContentsPath(url);
        const file = files.get(filePath);
        if (!file) {
          return new Response("Not Found", { status: 404 });
        }

        return Response.json({
          sha: file.sha,
          encoding: "base64",
          content: Buffer.from(file.content, "utf8").toString("base64"),
        });
      }

      if (url.includes("/contents/") && init?.method === "PUT") {
        const filePath = decodeContentsPath(url);
        const body = JSON.parse(String(init.body || "{}")) as { content: string };
        version += 1;
        files.set(filePath, {
          sha: `sha-${version}`,
          content: Buffer.from(body.content, "base64").toString("utf8"),
        });

        return Response.json({
          content: {
            path: filePath,
          },
        });
      }

      if (url.includes("api.cartridge.gg") && url.includes("/torii/sql?query=")) {
        return Response.json([]);
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    }) as typeof fetch,
    readJson(path: string) {
      const file = files.get(path);
      if (!file) {
        throw new Error(`Missing stored file ${path}`);
      }

      return JSON.parse(file.content);
    },
    writeJson(path: string, value: unknown) {
      version += 1;
      files.set(path, {
        sha: `sha-${version}`,
        content: `${JSON.stringify(value, null, 2)}\n`,
      });
    },
  };
}

function decodeContentsPath(url: string): string {
  return url.replace(/^.+\/contents\//, "").replace(/\?ref=.*$/, "");
}
