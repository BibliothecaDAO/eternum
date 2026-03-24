import { describe, expect, it } from "vitest";

import {
  getRunDetailMessage,
  getRunProgressLabel,
  getRunStatusHighlights,
  getSimpleStepTitle,
  getStepDetailMessage,
  resolveRunPrimaryAction,
} from "./presenters";
import type { FactoryRun } from "./types";

function buildFactoryRun(overrides: Partial<FactoryRun> = {}): FactoryRun {
  return {
    id: "slot.blitz:bltz-test-1",
    syncKey: "slot.blitz:bltz-test-1|updated",
    kind: "game",
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
  it("continues from the first failed step when the first step fails", () => {
    const run = buildFactoryRun({
      recovery: {
        state: "failed",
        canContinue: true,
        continueStepId: "create-world",
      },
    });

    expect(resolveRunPrimaryAction(run)).toEqual({
      kind: "continue",
      label: "Continue",
      stepId: "create-world",
    });
    expect(getRunDetailMessage(run)).toBe("This game stopped, but it can continue from the last unfinished step.");
  });

  it("continues from the stored failed step for later setup failures", () => {
    const run = buildFactoryRun({
      recovery: {
        state: "failed",
        canContinue: true,
        continueStepId: "wait-for-factory-index",
      },
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
      kind: "continue",
      label: "Continue",
      stepId: "wait-for-factory-index",
    });
    expect(getRunDetailMessage(run)).toBe("This game stopped, but it can continue from the last unfinished step.");
  });

  it("does not show continue during a normal transition gap", () => {
    const run = buildFactoryRun({
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
      recovery: {
        state: "transitioning",
        canContinue: false,
        continueStepId: null,
      },
    });

    expect(resolveRunPrimaryAction(run)).toBeNull();
  });

  it("shows continue only when recovery marks the run stalled", () => {
    const run = buildFactoryRun({
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
      recovery: {
        state: "stalled",
        canContinue: true,
        continueStepId: "wait-for-factory-index",
      },
    });

    expect(resolveRunPrimaryAction(run)).toEqual({
      kind: "continue",
      label: "Continue",
      stepId: "wait-for-factory-index",
    });
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

    expect(getSimpleStepTitle(run.steps[0])).toBe("Deploying indexer");
    expect(getStepDetailMessage(run.steps[0])).toBe("We could not deploy the indexer.");
    expect(getStepDetailMessage(run.steps[1])).toBe("We have not started applying this game’s settings yet.");
  });

  it("uses verification language for factory visibility steps", () => {
    const run = buildFactoryRun({
      steps: [
        {
          id: "wait-for-factory-indexes",
          title: "Wait for factory indexes",
          summary: "Waiting for games.",
          workflowName: "wait-for-factory-indexes",
          status: "running",
          verification: "Waiting for games.",
          latestEvent: "Waiting for games.",
        },
      ],
    });

    expect(getSimpleStepTitle(run.steps[0])).toBe("Checking deployed games");
    expect(getStepDetailMessage(run.steps[0])).toBe("We’re confirming the deployed games are showing up in Factory.");
  });

  it("adds child status highlights to multi-game run descriptions", () => {
    const run = buildFactoryRun({
      kind: "rotation",
      status: "running",
      children: [
        {
          id: "child-1",
          gameName: "bltz-franky-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-23T10:00:00Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
        },
        {
          id: "child-2",
          gameName: "bltz-franky-02",
          seriesGameNumber: 2,
          startTimeIso: "2026-03-23T10:30:00Z",
          status: "running",
          latestEvent: "Configuring",
          currentStepId: "configure-worlds",
          steps: [],
        },
        {
          id: "child-3",
          gameName: "bltz-franky-03",
          seriesGameNumber: 3,
          startTimeIso: "2026-03-23T11:00:00Z",
          status: "pending",
          latestEvent: "Queued",
          currentStepId: "create-worlds",
          steps: [],
        },
        {
          id: "child-4",
          gameName: "bltz-franky-04",
          seriesGameNumber: 4,
          startTimeIso: "2026-03-23T11:30:00Z",
          status: "failed",
          latestEvent: "Failed",
          currentStepId: "create-worlds",
          steps: [],
        },
      ],
      steps: [
        {
          id: "create-worlds",
          title: "Create worlds",
          summary: "Running.",
          workflowName: "create-worlds",
          status: "running",
          verification: "Running.",
          latestEvent: "Running.",
        },
      ],
    });

    expect(getRunStatusHighlights(run)).toEqual(["1 ready", "1 working", "1 pending", "1 failed"]);
    expect(getRunDetailMessage(run)).toBe(
      "1 ready, 1 working, 1 pending, 1 failed. We’re checking this rotation, filling any missing games, and finishing setup where needed.",
    );
  });

  it("keeps grouped indexer continues on the grouped launch step", () => {
    const run = buildFactoryRun({
      kind: "rotation",
      recovery: {
        state: "failed",
        canContinue: true,
        continueStepId: "create-indexers",
      },
      steps: [
        {
          id: "create-indexers",
          title: "Create indexers",
          summary: "Grouped indexer setup failed.",
          workflowName: "create-indexers",
          status: "failed",
          verification: "Grouped indexer setup failed.",
          latestEvent: "Grouped indexer setup failed.",
        },
      ],
    });

    expect(resolveRunPrimaryAction(run)).toEqual({
      kind: "continue",
      label: "Continue",
      stepId: "create-indexers",
    });
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
