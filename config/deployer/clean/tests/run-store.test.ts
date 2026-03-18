import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  recordFactoryLaunchStarted,
  recordFactoryLaunchStepFailed,
  recordFactoryLaunchStepStarted,
  recordFactoryLaunchStepSucceeded,
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
] as const;

const originalEnv = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

const summaryPath = resolveRepoPath(".context/game-launch/slot-blitz-bltz-flux-730.json");

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

  if (fs.existsSync(summaryPath)) {
    fs.unlinkSync(summaryPath);
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
});

function writeLaunchSummaryFile(summary: LaunchGameSummary): void {
  fs.mkdirSync(resolveRepoPath(".context/game-launch"), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
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
  return url
    .replace(/^.+\/contents\//, "")
    .replace(/\?ref=.*$/, "");
}
