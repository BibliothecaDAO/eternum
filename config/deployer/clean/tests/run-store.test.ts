import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  acquireFactoryAccountLease,
  heartbeatFactoryAccountLease,
  recordFactoryLaunchStarted,
  recordFactoryLaunchStepFailed,
  recordFactoryLaunchStepStarted,
  recordFactoryLaunchStepSucceeded,
  releaseFactoryAccountLeaseRecord,
} from "../run-store";
import { resolveRepoPath } from "../shared/repo";
import type { LaunchGameSummary } from "../types";

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

function resolveSummaryPath(environmentId: string, gameName: string): string {
  return resolveRepoPath(
    `.context/game-launch/${environmentId.replace(".", "-")}-${gameName.replace(/[^a-zA-Z0-9-_]/g, "-")}.json`,
  );
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
