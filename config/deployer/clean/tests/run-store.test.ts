import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  acquireFactoryAccountLease,
  heartbeatFactoryAccountLease,
  removeFactoryMaintenanceIndexEntry,
  recordFactoryLaunchStarted,
  recordFactoryRotationLaunchStarted,
  recordFactorySeriesLaunchStarted,
  recordFactoryLaunchStepFailed,
  recordFactoryLaunchStepStarted,
  recordFactoryLaunchStepSucceeded,
  releaseFactoryAccountLeaseRecord,
} from "../run-store";
import { requireGitHubBranchStoreConfig, updateGitHubBranchJsonFile } from "../run-store/github";
import { resolveRepoPath } from "../shared/repo";
import type { LaunchGameSummary, LaunchSeriesSummary } from "../types";

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
  "FACTORY_RUN_STORE_WRITE_RETRY_DELAY_MS",
  "FACTORY_RUN_LEASE_DURATION_SECONDS",
  "FACTORY_ACCOUNT_LEASE_DURATION_SECONDS",
] as const;

const originalEnv = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const summaryPaths = [
  resolveSummaryPath("appchain.blitz", "bltz-flux-730"),
  resolveSeriesSummaryPath("appchain.blitz", "bltz-series-duration"),
  resolveRotationSummaryPath("appchain.blitz", "bltz-rotationx"),
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
  test("retries transient branch JSON write conflicts before failing the deploy record", async () => {
    process.env.FACTORY_RUN_STORE_WRITE_RETRY_DELAY_MS = "0";

    let conflictCount = 0;
    let version = 0;
    let file = {
      sha: "sha-0",
      content: `${JSON.stringify({ count: 0 }, null, 2)}\n`,
    };

    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url.endsWith("/git/ref/heads/factory-runs")) {
        return Response.json({ object: { sha: "branch-sha" } });
      }

      if (url.includes("/contents/") && init?.method !== "PUT") {
        return Response.json({
          sha: file.sha,
          encoding: "base64",
          content: Buffer.from(file.content, "utf8").toString("base64"),
        });
      }

      if (url.includes("/contents/") && init?.method === "PUT") {
        if (conflictCount < 4) {
          conflictCount += 1;
          version += 1;
          file = {
            sha: `external-sha-${version}`,
            content: `${JSON.stringify({ count: conflictCount }, null, 2)}\n`,
          };
          return Response.json({ message: "sha does not match" }, { status: 409 });
        }

        const body = JSON.parse(String(init.body || "{}")) as { content: string };
        version += 1;
        file = {
          sha: `sha-${version}`,
          content: Buffer.from(body.content, "base64").toString("utf8"),
        };
        return Response.json({ content: { path: "indexes/appchain/blitz/games.json" } });
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    }) as typeof fetch;

    const result = await updateGitHubBranchJsonFile<{ count: number }>(
      requireGitHubBranchStoreConfig(),
      "indexes/appchain/blitz/games.json",
      (current) => ({ count: (current?.count || 0) + 1 }),
      "factory-runs: retry test",
    );

    expect(conflictCount).toBe(4);
    expect(result.count).toBe(5);
    expect(JSON.parse(file.content).count).toBe(5);
  });

  test("records launch input and initializes a run record on the storage branch", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
        accountAddress: "0xabc123",
        privateKey: "0xsecret",
      },
    });

    const inputRecord = branchStore.readJson("inputs/appchain/blitz/bltz-flux-730/101-1.json");
    const runRecord = branchStore.readJson("runs/appchain/blitz/bltz-flux-730.json");
    const maintenanceIndex = branchStore.readJson("indexes/appchain/blitz/games.json");

    expect(inputRecord.launchRequestId).toBe("101-1");
    expect(inputRecord.request.accountAddress).toBeUndefined();
    expect(inputRecord.request.privateKey).toBeUndefined();
    expect(runRecord.status).toBe("running");
    expect(runRecord.currentStepId).toBe("create-world");
    expect(runRecord.executionMode).toBe("fast_trial");
    expect(maintenanceIndex.entries["bltz-flux-730"]).toMatchObject({
      kind: "game",
      gameName: "bltz-flux-730",
      status: "running",
      currentStepId: "create-world",
    });
    expect(runRecord.steps.map((step: { id: string }) => step.id)).toEqual(["create-world", "wait-for-factory-index"]);
  });

  test("removes a stale rotation maintenance index entry", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    branchStore.writeJson("indexes/appchain/blitz/rotations.json", {
      version: 1,
      environment: "appchain.blitz",
      kind: "rotation",
      updatedAt: "2026-03-24T00:00:00.000Z",
      entries: {
        "bltz-blinkery": {
          kind: "rotation",
          environment: "appchain.blitz",
          rotationName: "bltz-blinkery",
          path: "runs/appchain/blitz/rotations/bltz-blinkery.json",
          inputPath: "inputs/appchain/blitz/rotations/bltz-blinkery/23423814592-1.json",
          status: "attention",
          updatedAt: "2026-03-24T00:00:00.000Z",
          workflowRef: "codex/factory-v2-rotation-review",
          currentStepId: "create-worlds",
          hasRunningStep: false,
          recoverableFailedStepId: "create-worlds",
          recoverablePendingStepId: "wait-for-factory-indexes",
          autoRetry: { enabled: true, intervalMinutes: 15 },
          evaluation: { intervalMinutes: 5 },
          games: [],
        },
      },
    });

    await removeFactoryMaintenanceIndexEntry(
      requireGitHubBranchStoreConfig(),
      "appchain.blitz",
      "rotation",
      "bltz-blinkery",
    );

    const maintenanceIndex = branchStore.readJson("indexes/appchain/blitz/rotations.json");

    expect(maintenanceIndex.entries["bltz-blinkery"]).toBeUndefined();
  });

  test("persists map config overrides inside the stored launch request", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "appchain.eternum",
      gameName: "etrn-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.eternum",
        gameName: "etrn-flux-730",
        startTime: "2026-03-18T10:00:00Z",
        mapConfigOverrides: {
          bitcoinMineWinProbability: 1638,
          bitcoinMineFailProbability: 63897,
        },
      },
    });

    const inputRecord = branchStore.readJson("inputs/appchain/eternum/etrn-flux-730/101-1.json");

    expect(inputRecord.request.mapConfigOverrides).toEqual({
      bitcoinMineWinProbability: 1638,
      bitcoinMineFailProbability: 63897,
    });
  });

  test("persists blitz registration overrides inside the stored launch request", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-731",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-731",
        startTime: "2026-03-18T10:00:00Z",
        blitzRegistrationOverrides: {
          registration_count_max: 12,
        },
      },
    });

    const inputRecord = branchStore.readJson("inputs/appchain/blitz/bltz-flux-731/101-1.json");

    expect(inputRecord.request.blitzRegistrationOverrides).toEqual({
      registration_count_max: 12,
    });
  });

  test("records successful step output into the run artifacts", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    writeLaunchSummaryFile({
      environment: "appchain.blitz",
      chain: "appchain",
      gameType: "blitz",
      gameName: "bltz-flux-730",
      startTime: 1710756000,
      startTimeIso: "2026-03-18T10:00:00.000Z",
      rpcUrl: "https://rpc.example",
      gameId: 7,
      createGameTxHash: "0xabc",
      configMode: "batched",
      configSteps: [],
      dryRun: false,
    });

    await recordFactoryLaunchStepSucceeded({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "create-world",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/appchain/blitz/bltz-flux-730.json");

    expect(runRecord.artifacts.createGameTxHash).toBe("0xabc");
    expect(runRecord.artifacts.gameId).toBe(7);
    expect(runRecord.artifacts.summaryPath).toBe(".context/game-launch/appchain-blitz-bltz-flux-730.json");
    expect(runRecord.status).toBe("running");
    expect(runRecord.currentStepId).toBe("wait-for-factory-index");
    expect(runRecord.activeLease).toBeUndefined();
    expect(runRecord.steps.find((step: { id: string }) => step.id === "create-world")?.status).toBe("succeeded");
  });

  test("preserves the current rotation summary when a new workflow starts for an existing rotation", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    const existingSummary = {
      environment: "appchain.blitz",
      chain: "appchain",
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
      outputPath: ".context/game-launch/rotation-appchain-blitz-bltz-rotationx.json",
    } as const;

    branchStore.writeJson("runs/appchain/blitz/rotations/bltz-rotationx.json", {
      version: 1,
      kind: "rotation",
      runId: "appchain.blitz:rotation:bltz-rotationx",
      environment: "appchain.blitz",
      chain: "appchain",
      gameType: "blitz",
      rotationName: "bltz-rotationx",
      seriesName: "bltz-rotationx",
      status: "attention",
      executionMode: "guided_recovery",
      requestedLaunchStep: "full",
      inputPath: "inputs/appchain/blitz/rotations/bltz-rotationx/101-1.json",
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
      ],
      summary: existingSummary,
      artifacts: {
        summaryPath: existingSummary.outputPath,
        seriesCreated: true,
        seriesCreatedAt: existingSummary.seriesCreatedAt,
      },
    });

    await recordFactoryRotationLaunchStarted({
      environmentId: "appchain.blitz",
      rotationName: "bltz-rotationx",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        rotationName: "bltz-rotationx",
        firstGameStartTime: "2099-01-01T00:00:00Z",
        gameIntervalMinutes: 60,
        maxGames: 12,
        advanceWindowGames: 5,
        evaluationIntervalMinutes: 15,
        accountAddress: "0xabc123",
        privateKey: "0xsecret",
      },
    });

    const inputRecord = branchStore.readJson("inputs/appchain/blitz/rotations/bltz-rotationx/101-1.json");
    const runRecord = branchStore.readJson("runs/appchain/blitz/rotations/bltz-rotationx.json");

    expect(inputRecord.request.resumeSummary).toBeUndefined();
    expect(inputRecord.request.accountAddress).toBeUndefined();
    expect(inputRecord.request.privateKey).toBeUndefined();
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
    expect(inputRecord.request.durationSeconds).toBe(3600);
  });

  test("persists the current series duration when a resumed request omits it", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    writeSeriesSummaryFile({
      environment: "appchain.blitz",
      chain: "appchain",
      gameType: "blitz",
      seriesName: "bltz-series-duration",
      rpcUrl: "https://rpc.example",
      autoRetryEnabled: true,
      autoRetryIntervalMinutes: 15,
      dryRun: false,
      configMode: "batched",
      seriesCreated: true,
      games: [
        {
          gameName: "bltz-series-duration-01",
          startTime: 4_070_908_800,
          startTimeIso: "2099-01-01T00:00:00.000Z",
          durationSeconds: 3600,
          seriesGameNumber: 1,
          currentStepId: null,
          latestEvent: "Waiting to run",
          status: "pending",
          configSteps: [],
          steps: [],
          artifacts: {},
        },
      ],
      outputPath: ".context/game-launch/series-appchain-blitz-bltz-series-duration.json",
    });

    await recordFactorySeriesLaunchStarted({
      environmentId: "appchain.blitz",
      seriesName: "bltz-series-duration",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        seriesName: "bltz-series-duration",
        games: [{ gameName: "bltz-series-duration-01", startTime: "2099-01-01T00:00:00Z" }],
        accountAddress: "0xabc123",
        privateKey: "0xsecret",
      },
    });

    const inputRecord = branchStore.readJson("inputs/appchain/blitz/series/bltz-series-duration/101-1.json");

    expect(inputRecord.request.durationSeconds).toBe(3600);
    expect(inputRecord.request.accountAddress).toBeUndefined();
    expect(inputRecord.request.privateKey).toBeUndefined();
  });

  test("marks a failed step as needing attention", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await recordFactoryLaunchStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepFailed({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "wait-for-factory-index",
      errorMessage: "Timed out waiting for factory SQL",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/appchain/blitz/bltz-flux-730.json");
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
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepSucceeded({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "create-world",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "wait-for-factory-index",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    process.env.GITHUB_RUN_ID = "202";

    await expect(
      recordFactoryLaunchStarted({
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        requestedLaunchStep: "full",
        request: {
          environmentId: "appchain.blitz",
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
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    await recordFactoryLaunchStepStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      stepId: "create-world",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const staleRun = branchStore.readJson("runs/appchain/blitz/bltz-flux-730.json");
    branchStore.writeJson("runs/appchain/blitz/bltz-flux-730.json", {
      ...staleRun,
      activeLease: {
        ...staleRun.activeLease,
        expiresAt: "2000-01-01T00:00:00.000Z",
      },
    });

    process.env.GITHUB_RUN_ID = "202";

    await recordFactoryLaunchStarted({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      requestedLaunchStep: "full",
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-flux-730",
        startTime: "2026-03-18T10:00:00Z",
      },
    });

    const runRecord = branchStore.readJson("runs/appchain/blitz/bltz-flux-730.json");

    expect(runRecord.latestLaunchRequestId).toBe("202-1");
    expect(runRecord.activeLease).toBeUndefined();
  });

  test("acquires an account lease for nonce-writing steps", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    const lease = await acquireFactoryAccountLease({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    const leaseRecord = branchStore.readJson("locks/accounts/appchain/0xabc123.json");

    expect(lease.owner.stepId).toBe("create-world");
    expect(leaseRecord.owner.gameName).toBe("bltz-flux-730");
    expect(leaseRecord.releasedAt).toBeUndefined();
  });

  test("blocks a conflicting account lease while the current owner is active", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;

    await acquireFactoryAccountLease({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    process.env.GITHUB_RUN_ID = "202";

    await expect(
      acquireFactoryAccountLease({
        environmentId: "appchain.eternum",
        gameName: "etrn-flux-730",
        accountAddress: "0xabc123",
        stepId: "create-world",
      }),
    ).rejects.toThrow("Account 0xabc123 is already in use");
  });

  test("allows a stale account lease to be taken over", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;
    process.env.FACTORY_ACCOUNT_LEASE_DURATION_SECONDS = "1";

    await acquireFactoryAccountLease({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    const staleLease = branchStore.readJson("locks/accounts/appchain/0xabc123.json");
    branchStore.writeJson("locks/accounts/appchain/0xabc123.json", {
      ...staleLease,
      expiresAt: "2000-01-01T00:00:00.000Z",
    });

    process.env.GITHUB_RUN_ID = "202";

    const refreshedLease = await acquireFactoryAccountLease({
      environmentId: "appchain.eternum",
      gameName: "etrn-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    expect(refreshedLease.owner.gameName).toBe("etrn-flux-730");
    expect(refreshedLease.owner.launchRequestId).toBe("202-1");
  });

  test("heartbeats and releases the active account lease", async () => {
    const branchStore = createBranchStoreFetch();
    globalThis.fetch = branchStore.fetch;
    process.env.FACTORY_ACCOUNT_LEASE_DURATION_SECONDS = "60";

    const lease = await acquireFactoryAccountLease({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
    });

    const originalLease = branchStore.readJson("locks/accounts/appchain/0xabc123.json");
    branchStore.writeJson("locks/accounts/appchain/0xabc123.json", {
      ...originalLease,
      heartbeatAt: "2000-01-01T00:00:00.000Z",
      expiresAt: "2000-01-01T00:01:00.000Z",
    });
    const staleLease = branchStore.readJson("locks/accounts/appchain/0xabc123.json");

    await heartbeatFactoryAccountLease({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
      leaseId: lease.owner.leaseId,
    });

    const heartbeatedLease = branchStore.readJson("locks/accounts/appchain/0xabc123.json");

    await releaseFactoryAccountLeaseRecord({
      environmentId: "appchain.blitz",
      gameName: "bltz-flux-730",
      accountAddress: "0xabc123",
      stepId: "create-world",
      leaseId: lease.owner.leaseId,
    });

    const releasedLease = branchStore.readJson("locks/accounts/appchain/0xabc123.json");

    expect(Date.parse(heartbeatedLease.expiresAt)).toBeGreaterThan(Date.parse(staleLease.expiresAt));
    expect(releasedLease.releasedAt).toBeTruthy();
    expect(releasedLease.expiresAt).toBe(releasedLease.releasedAt);
  });
});

function writeLaunchSummaryFile(summary: LaunchGameSummary): void {
  fs.mkdirSync(resolveRepoPath(".context/game-launch"), { recursive: true });
  fs.writeFileSync(resolveSummaryPath(summary.environment, summary.gameName), `${JSON.stringify(summary, null, 2)}\n`);
}

function writeSeriesSummaryFile(summary: LaunchSeriesSummary): void {
  fs.mkdirSync(resolveRepoPath(".context/game-launch"), { recursive: true });
  fs.writeFileSync(
    resolveSeriesSummaryPath(summary.environment, summary.seriesName),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
}

function resolveSummaryPath(environmentId: string, gameName: string): string {
  return resolveRepoPath(
    `.context/game-launch/${environmentId.replace(".", "-")}-${gameName.replace(/[^a-zA-Z0-9-_]/g, "-")}.json`,
  );
}

function resolveSeriesSummaryPath(environmentId: string, seriesName: string): string {
  return resolveRepoPath(
    `.context/game-launch/series-${environmentId.replace(".", "-")}-${seriesName.replace(/[^a-zA-Z0-9-_]/g, "-")}.json`,
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

function buildRotationTestGame(gameName: string, seriesGameNumber: number, startTime: number, durationSeconds = 3600) {
  return {
    gameName,
    startTime,
    startTimeIso: new Date(startTime * 1000).toISOString(),
    durationSeconds,
    seriesGameNumber,
    currentStepId: null,
    latestEvent: "Waiting to run",
    status: "pending",
    configSteps: [],
    steps: [],
    artifacts: {},
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

      if (url.includes("api.realms.world") && url.includes("/torii/sql?query=")) {
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
