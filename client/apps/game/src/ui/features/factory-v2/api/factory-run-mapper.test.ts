import { describe, expect, it } from "vitest";
import { mapFactoryWorkerRun } from "./factory-run-mapper";
import type { FactoryWorkerRunRecord } from "./factory-worker";

const buildRunRecord = (overrides: Partial<FactoryWorkerRunRecord> = {}): FactoryWorkerRunRecord => ({
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

describe("mapFactoryWorkerRun", () => {
  it("maps wait steps to the calmer waiting status", () => {
    const run = mapFactoryWorkerRun(buildRunRecord());

    expect(run.status).toBe("waiting");
    expect(run.summary).toBe("Waiting for the next step.");
  });

  it("keeps failed steps retryable in the UI model", () => {
    const run = mapFactoryWorkerRun(
      buildRunRecord({
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
});
