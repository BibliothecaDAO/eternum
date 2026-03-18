import { describe, expect, it } from "vitest";

import { getRunDetailMessage, getStepDetailMessage, resolveRunPrimaryAction } from "./presenters";
import type { FactoryRun } from "./types";

function buildFactoryRun(overrides: Partial<FactoryRun> = {}): FactoryRun {
  return {
    id: "slot.blitz:bltz-test-1",
    syncKey: "slot.blitz:bltz-test-1|updated",
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

describe("factory run recovery actions", () => {
  it("restarts the full launch when the first step fails", () => {
    const run = buildFactoryRun();

    expect(resolveRunPrimaryAction(run)).toEqual({
      kind: "retry",
      label: "Retry full launch",
      launchScope: "full",
      stepId: "create-world",
    });
    expect(getRunDetailMessage(run)).toBe("This game stopped right away. Start the launch again from the top.");
  });

  it("keeps later failures on step-by-step recovery", () => {
    const run = buildFactoryRun({
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
          summary: "Wait for factory index failed.",
          workflowName: "wait-for-factory-index",
          status: "failed",
          verification: "Wait for factory index failed.",
          latestEvent: "Wait for factory index failed.",
        },
      ],
    });

    expect(resolveRunPrimaryAction(run)).toEqual({
      kind: "retry",
      label: "Retry this step",
      launchScope: "wait-for-factory-index",
      stepId: "wait-for-factory-index",
    });
    expect(getRunDetailMessage(run)).toBe("This game got stuck partway through. Try this part again.");
  });

  it("uses plain language for step detail rows", () => {
    const run = buildFactoryRun({
      steps: [
        {
          id: "create-indexer",
          title: "Create indexer",
          summary: "Indexer creation failed.",
          workflowName: "create-indexer",
          status: "failed",
          verification: "Indexer creation failed.",
          latestEvent: "Indexer creation failed.",
        },
        {
          id: "configure-world",
          title: "Configure world",
          summary: "Config pending.",
          workflowName: "configure-world",
          status: "pending",
          verification: "Config pending.",
          latestEvent: "Config pending.",
        },
      ],
    });

    expect(getStepDetailMessage(run.steps[0])).toBe("The game is not online yet.");
    expect(getStepDetailMessage(run.steps[1])).toBe("The setup has not been applied yet.");
  });
});
