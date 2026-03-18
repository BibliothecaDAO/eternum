import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveFactoryAutoRecoveryLimitNotice, resolveFactoryAutoRecoveryPlan } from "./auto-recovery";
import type { FactoryRun } from "./types";

function buildFactoryRun(overrides: Partial<FactoryRun> = {}): FactoryRun {
  return {
    id: "slot.blitz:bltz-test-1",
    syncKey: "slot.blitz:bltz-test-1|run-1",
    mode: "blitz",
    name: "bltz-test-1",
    environment: "slot.blitz",
    owner: "Factory",
    presetId: "open",
    status: "attention",
    summary: "Needs help.",
    updatedAt: "Updated just now",
    steps: [
      {
        id: "create-world",
        title: "Create world",
        summary: "Create world failed.",
        workflowName: "create-world",
        status: "failed",
        verification: "Create world failed.",
        latestEvent: "Create world failed.",
      },
      {
        id: "wait-for-factory-index",
        title: "Wait for factory index",
        summary: "Waiting to run.",
        workflowName: "wait-for-factory-index",
        status: "pending",
        verification: "Waiting to run.",
        latestEvent: "Waiting to run.",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("factory auto recovery", () => {
  it("auto retries the whole launch when the first step fails", () => {
    expect(resolveFactoryAutoRecoveryPlan(buildFactoryRun())).toMatchObject({
      kind: "retry",
      launchScope: "full",
      stepId: "create-world",
      retryAttempt: 1,
    });
  });

  it("auto continues after a recovery step succeeds and work remains", () => {
    expect(
      resolveFactoryAutoRecoveryPlan(
        buildFactoryRun({
          status: "running",
          steps: [
            {
              id: "create-world",
              title: "Create world",
              summary: "Create world succeeded.",
              workflowName: "create-world",
              status: "succeeded",
              verification: "Create world succeeded.",
              latestEvent: "Create world succeeded.",
            },
            {
              id: "wait-for-factory-index",
              title: "Wait for factory index",
              summary: "Waiting to run.",
              workflowName: "wait-for-factory-index",
              status: "pending",
              verification: "Waiting to run.",
              latestEvent: "Waiting to run.",
            },
          ],
        }),
      ),
    ).toMatchObject({
      kind: "continue",
      launchScope: "wait-for-factory-index",
      stepId: "wait-for-factory-index",
    });
  });

  it("stops auto retrying after ten tries", () => {
    window.localStorage.setItem(
      "factory-v2:auto-recovery",
      JSON.stringify({
        "slot.blitz:bltz-test-1": {
          retryCounts: {
            full: 10,
          },
        },
      }),
    );

    expect(resolveFactoryAutoRecoveryPlan(buildFactoryRun())).toBeNull();
    expect(resolveFactoryAutoRecoveryLimitNotice(buildFactoryRun())).toBe(
      "We tried starting this game 10 times automatically. We need your help now.",
    );
  });
});
