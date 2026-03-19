import { describe, expect, it } from "vitest";

import {
  getRunDetailMessage,
  getRunProgressLabel,
  getSimpleStepTitle,
  getStepDetailMessage,
  resolveRunPrimaryAction,
} from "./presenters";
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
    expect(getRunDetailMessage(run)).toBe("This launch stopped early, so it will need a full retry.");
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
    expect(getRunDetailMessage(run)).toBe("This setup stalled on one step, so that step will need another try.");
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

    expect(getSimpleStepTitle(run.steps[0])).toBe("Start live updates");
    expect(getStepDetailMessage(run.steps[0])).toBe("Live updates are not ready yet.");
    expect(getStepDetailMessage(run.steps[1])).toBe("The game setup has not been applied yet.");
  });

  it("counts the active setup step in progress labels", () => {
    expect(
      getRunProgressLabel(
        buildFactoryRun({
          status: "running",
          steps: [
            {
              id: "create-world",
              title: "Create world",
              summary: "Creating the game.",
              workflowName: "create-world",
              status: "running",
              verification: "Creating the game.",
              latestEvent: "Creating the game.",
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
    ).toBe("1 of 2 parts");

    expect(
      getRunProgressLabel(
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
              summary: "Waiting for factory index.",
              workflowName: "wait-for-factory-index",
              status: "running",
              verification: "Waiting for factory index.",
              latestEvent: "Waiting for factory index.",
            },
            {
              id: "configure-world",
              title: "Configure world",
              summary: "Waiting to run.",
              workflowName: "configure-world",
              status: "pending",
              verification: "Waiting to run.",
              latestEvent: "Waiting to run.",
            },
          ],
        }),
      ),
    ).toBe("2 of 3 parts");
  });
});
