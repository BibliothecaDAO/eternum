import { formatFactoryDurationLabel } from "./duration";
import {
  getDefaultPresetIdForModeSelection,
  getFactoryLaunchPresetsForMode,
  getFactoryPresetById,
  getPresetStartAtValue,
} from "./catalog";
import type {
  FactoryGameMode,
  FactoryLaunchPreset,
  FactoryRun,
  FactoryRunStatus,
  FactoryRunStep,
} from "./types";

const buildRun = (run: Omit<FactoryRun, "status" | "summary">): FactoryRun => {
  const { status, summary } = describeRunState(run.steps);
  return { ...run, status, summary };
};

const buildStep = (step: FactoryRunStep): FactoryRunStep => step;

const MINUTES_PER_HOUR = 60;

const formatLaunchStartLabel = (startAt: string) => {
  const date = new Date(startAt);

  if (Number.isNaN(date.getTime())) {
    return "the chosen time";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const factoryRuns: FactoryRun[] = [
  buildRun({
    id: "run-eternum-ironmist",
    mode: "eternum",
    name: "etrn-iron-mist-11",
    environment: "slot.eternum",
    owner: "credence",
    presetId: "eternum-ranked-season",
    updatedAt: "Updated 2 minutes ago",
    steps: [
      buildStep({
        id: "create-world",
        title: "Create world",
        summary: "Dispatch the onchain factory deployment request.",
        workflowName: "factory-v2-step-create-world",
        status: "succeeded",
        verification: "World address registered and deployment request observed.",
        latestEvent: "Observed deployment request #1182.",
      }),
      buildStep({
        id: "wait-factory-index",
        title: "Wait for factory index",
        summary: "Watch the factory indexer until the world is queryable for follow-up steps.",
        workflowName: "factory-v2-step-wait-factory-index",
        status: "succeeded",
        verification: "World profile resolved from factory data.",
        latestEvent: "Factory tables returned the world and selectors.",
      }),
      buildStep({
        id: "apply-config",
        title: "Apply config",
        summary: "Apply the immutable launch template to the deployed world.",
        workflowName: "factory-v2-step-apply-world-config",
        status: "succeeded",
        verification: "Config snapshot v2.4 applied.",
        latestEvent: "Config tx confirmed in block 928143.",
      }),
      buildStep({
        id: "create-indexer",
        title: "Create indexer",
        summary: "Provision or reconcile the Torii indexer for this world.",
        workflowName: "factory-v2-step-create-indexer",
        status: "succeeded",
        verification: "Indexer workspace created and endpoint recorded.",
        latestEvent: "Indexer exists and responded to the health probe.",
      }),
      buildStep({
        id: "wait-indexer",
        title: "Wait for indexer readiness",
        summary: "Pause follow-up work until indexing can support contract verification and role targeting.",
        workflowName: "factory-v2-step-wait-indexer-ready",
        status: "succeeded",
        verification: "Indexer is serving the world profile.",
        latestEvent: "Latest probe returned selector coverage.",
      }),
      buildStep({
        id: "grant-village-pass",
        title: "Grant village pass role",
        summary: "Grant MINTER_ROLE to realm_internal_systems using the game launch admin account.",
        workflowName: "factory-v2-step-grant-village-pass-role",
        status: "blocked",
        verification: "Waiting for operator retry after an RPC timeout.",
        latestEvent: "Grant call prepared but the provider timed out before confirmation.",
      }),
      buildStep({
        id: "create-banks",
        title: "Create banks",
        summary: "Create or reconcile the Eternum banks after role and indexer prerequisites are satisfied.",
        workflowName: "factory-v2-step-create-banks",
        status: "pending",
        verification: "Waiting for the village pass grant to clear.",
        latestEvent: "Prerequisites not satisfied yet.",
      }),
    ],
  }),
  buildRun({
    id: "run-eternum-sandbox",
    mode: "eternum",
    name: "etrn-live-cinder-02",
    environment: "mainnet.eternum",
    owner: "ops",
    presetId: "eternum-sandbox-world",
    updatedAt: "Updated 9 minutes ago",
    steps: [
      buildStep({
        id: "create-world",
        title: "Create world",
        summary: "Dispatch the onchain factory deployment request.",
        workflowName: "factory-v2-step-create-world",
        status: "succeeded",
        verification: "Deployment request observed.",
        latestEvent: "Factory accepted the request.",
      }),
      buildStep({
        id: "wait-factory-index",
        title: "Wait for factory index",
        summary: "Watch the factory indexer until the world is queryable for follow-up steps.",
        workflowName: "factory-v2-step-wait-factory-index",
        status: "running",
        verification: "Watching for world rows to appear in the indexer.",
        latestEvent: "Polling factory SQL every 30 seconds.",
      }),
      buildStep({
        id: "apply-config",
        title: "Apply config",
        summary: "Apply the immutable launch template to the deployed world.",
        workflowName: "factory-v2-step-apply-world-config",
        status: "pending",
        verification: "Waiting for factory indexing.",
        latestEvent: "No action taken yet.",
      }),
      buildStep({
        id: "grant-village-pass",
        title: "Grant village pass role",
        summary: "Grant MINTER_ROLE to realm_internal_systems using the game launch admin account.",
        workflowName: "factory-v2-step-grant-village-pass-role",
        status: "pending",
        verification: "Waiting for config and indexer prerequisites.",
        latestEvent: "No action taken yet.",
      }),
      buildStep({
        id: "create-banks",
        title: "Create banks",
        summary: "Create or reconcile the Eternum banks after role and indexer prerequisites are satisfied.",
        workflowName: "factory-v2-step-create-banks",
        status: "pending",
        verification: "Waiting for upstream steps to clear.",
        latestEvent: "No action taken yet.",
      }),
    ],
  }),
  buildRun({
    id: "run-blitz-nightly",
    mode: "blitz",
    name: "bltz-nightly-slate-28",
    environment: "slot.blitz",
    owner: "factory-bot",
    presetId: "blitz-open",
    updatedAt: "Updated 14 minutes ago",
    steps: [
      buildStep({
        id: "create-world",
        title: "Create world",
        summary: "Dispatch the onchain factory deployment request.",
        workflowName: "factory-v2-step-create-world",
        status: "succeeded",
        verification: "World deployment complete.",
        latestEvent: "Factory marked the deployment complete.",
      }),
      buildStep({
        id: "apply-config",
        title: "Apply config",
        summary: "Apply the immutable launch template to the deployed world.",
        workflowName: "factory-v2-step-apply-world-config",
        status: "succeeded",
        verification: "Config snapshot v1.9 applied.",
        latestEvent: "Config transaction settled.",
      }),
      buildStep({
        id: "create-indexer",
        title: "Create indexer",
        summary: "Provision or reconcile the Torii indexer for this world.",
        workflowName: "factory-v2-step-create-indexer",
        status: "already_done",
        verification: "Existing indexer was healthy and reused.",
        latestEvent: "Reconciler detected a matching healthy indexer.",
      }),
      buildStep({
        id: "sync-paymaster",
        title: "Sync paymaster policy",
        summary: "Diff and sync the paymaster policy for the blitz launch surface.",
        workflowName: "factory-v2-step-sync-paymaster",
        status: "running",
        verification: "Waiting for policy propagation.",
        latestEvent: "Policy sync dispatched and awaiting confirmation.",
      }),
    ],
  }),
  buildRun({
    id: "run-blitz-weekend",
    mode: "blitz",
    name: "bltz-weekend-opal-07",
    environment: "mainnet.blitz",
    owner: "ops",
    presetId: "blitz-live-open",
    updatedAt: "Updated 1 hour ago",
    steps: [
      buildStep({
        id: "create-world",
        title: "Create world",
        summary: "Dispatch the onchain factory deployment request.",
        workflowName: "factory-v2-step-create-world",
        status: "succeeded",
        verification: "World deployment complete.",
        latestEvent: "Factory marked the deployment complete.",
      }),
      buildStep({
        id: "apply-config",
        title: "Apply config",
        summary: "Apply the immutable launch template to the deployed world.",
        workflowName: "factory-v2-step-apply-world-config",
        status: "succeeded",
        verification: "Config snapshot applied.",
        latestEvent: "Config transaction settled.",
      }),
      buildStep({
        id: "wait-indexer",
        title: "Wait for indexer readiness",
        summary: "Pause release until the public read path is queryable.",
        workflowName: "factory-v2-step-wait-indexer-ready",
        status: "succeeded",
        verification: "Indexer responded to the readiness probe.",
        latestEvent: "Readiness checks passed.",
      }),
      buildStep({
        id: "publish-ready-state",
        title: "Publish ready state",
        summary: "Mark the run ready for operators and the front-end world list.",
        workflowName: "factory-v2-step-publish-ready-state",
        status: "succeeded",
        verification: "Run is complete and visible to operators.",
        latestEvent: "Run was promoted to ready state.",
      }),
    ],
  }),
];

const createDefaultRunName = (mode: FactoryGameMode, runCount: number) =>
  mode === "eternum" ? `etrn-v2-${runCount + 9}` : `bltz-v2-${runCount + 9}`;

const resolveRequestedRunName = (
  mode: FactoryGameMode,
  environment: string,
  existingRuns: FactoryRun[],
  requestedName?: string,
) => {
  const trimmedName = requestedName?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const selectionRunCount = getFactoryRunsForSelection(existingRuns, mode, environment).length;
  return createDefaultRunName(mode, selectionRunCount);
};

export const getDefaultRunIdForMode = (mode: FactoryGameMode, runs: FactoryRun[] = factoryRuns) =>
  runs.find((run) => run.mode === mode)?.id ?? runs[0]?.id ?? "";

export const getSuggestedGameName = (mode: FactoryGameMode, environment: string, runs: FactoryRun[] = factoryRuns) =>
  resolveRequestedRunName(mode, environment, runs);

export const getDefaultRunIdForSelection = (
  mode: FactoryGameMode,
  environment: string,
  runs: FactoryRun[] = factoryRuns,
) => runs.find((run) => run.mode === mode && run.environment === environment)?.id ?? getDefaultRunIdForMode(mode, runs);

export const getFactoryRunsForSelection = (runs: FactoryRun[], mode: FactoryGameMode, environment: string) =>
  runs.filter((run) => run.mode === mode && run.environment === environment);

export const launchMockRun = ({
  mode,
  environment,
  preset,
  existingRuns,
  requestedName,
  startAt,
  durationMinutes,
  twoPlayerMode,
  singleRealmMode,
}: {
  mode: FactoryGameMode;
  environment: string;
  preset: FactoryLaunchPreset;
  existingRuns: FactoryRun[];
  requestedName?: string;
  startAt: string;
  durationMinutes: number | null;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
}): FactoryRun[] => {
  const newRun = buildRun({
    id: `run-${mode}-${existingRuns.length + 1}`,
    mode,
    name: resolveRequestedRunName(mode, environment, existingRuns, requestedName),
    environment,
    owner: "you",
    presetId: preset.id,
    updatedAt: "Updated just now",
    steps: buildInitialSteps(mode, {
      startAt,
      durationMinutes,
      twoPlayerMode,
      singleRealmMode,
    }),
  });

  return [newRun, ...existingRuns];
};

export const continueFactoryRun = (run: FactoryRun): FactoryRun => {
  const nextRunningStep = run.steps.find((step) => step.status === "running");
  if (nextRunningStep) {
    return rebuildRun(run, completeStepAndStartNext(run.steps, nextRunningStep.id));
  }

  const nextPendingStep = run.steps.find((step) => step.status === "pending");
  if (!nextPendingStep) {
    return run;
  }

  return rebuildRun(run, startPendingStep(run.steps, nextPendingStep.id));
};

export const retryFactoryRun = (run: FactoryRun): FactoryRun => {
  const blockedStep = run.steps.find((step) => step.status === "blocked" || step.status === "failed");
  if (!blockedStep) {
    return run;
  }

  return rebuildRun(run, retryBlockedStep(run.steps, blockedStep.id));
};

export const refreshFactoryRun = (run: FactoryRun): FactoryRun =>
  rebuildRun(
    run,
    run.steps.map((step) =>
      step.status === "running"
        ? {
            ...step,
            verification: "Reconciler confirmed the step is still progressing.",
            latestEvent: "State refreshed from the watcher.",
          }
        : step,
    ),
  );

const buildLaunchQueuedEvent = ({
  mode,
  startAt,
  durationMinutes,
  twoPlayerMode,
  singleRealmMode,
}: {
  mode: FactoryGameMode;
  startAt: string;
  durationMinutes: number | null;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
}) => {
  const enabledModes = [twoPlayerMode ? "two-player on" : null, singleRealmMode ? "single realm on" : null].filter(
    Boolean,
  );

  if (mode === "eternum") {
    return `Queued for ${formatLaunchStartLabel(startAt)}.`;
  }

  const durationLabel = formatFactoryDurationLabel(durationMinutes ?? MINUTES_PER_HOUR);

  return enabledModes.length > 0
    ? `Queued for ${formatLaunchStartLabel(startAt)} for ${durationLabel}, with ${enabledModes.join(" and ")}.`
    : `Queued for ${formatLaunchStartLabel(startAt)} for ${durationLabel}.`;
};

const buildInitialSteps = (
  mode: FactoryGameMode,
  launchOptions: { startAt: string; durationMinutes: number | null; twoPlayerMode: boolean; singleRealmMode: boolean },
): FactoryRunStep[] => {
  const sharedSteps = [
    buildStep({
      id: "create-world",
      title: "Create world",
      summary: "Dispatch the onchain factory deployment request.",
      workflowName: "factory-v2-step-create-world",
      status: "running",
      verification: "Preparing to submit the deployment request.",
      latestEvent: buildLaunchQueuedEvent({ mode, ...launchOptions }),
    }),
    buildStep({
      id: "wait-factory-index",
      title: "Wait for factory index",
      summary: "Watch the factory indexer until the world is queryable for follow-up steps.",
      workflowName: "factory-v2-step-wait-factory-index",
      status: "pending",
      verification: "Waiting for world creation.",
      latestEvent: "No action taken yet.",
    }),
    buildStep({
      id: "apply-config",
      title: "Apply config",
      summary: "Apply the immutable launch template to the deployed world.",
      workflowName: "factory-v2-step-apply-world-config",
      status: "pending",
      verification: "Waiting for the world to exist.",
      latestEvent: "No action taken yet.",
    }),
    buildStep({
      id: "create-indexer",
      title: "Create indexer",
      summary: "Provision or reconcile the Torii indexer for this world.",
      workflowName: "factory-v2-step-create-indexer",
      status: "pending",
      verification: "Waiting for config to apply.",
      latestEvent: "No action taken yet.",
    }),
  ];

  const modeSteps =
    mode === "eternum"
      ? [
          buildStep({
            id: "grant-village-pass",
            title: "Grant village pass role",
            summary: "Grant MINTER_ROLE to realm_internal_systems using the game launch admin account.",
            workflowName: "factory-v2-step-grant-village-pass-role",
            status: "pending",
            verification: "Waiting for indexer and config readiness.",
            latestEvent: "No action taken yet.",
          }),
          buildStep({
            id: "create-banks",
            title: "Create banks",
            summary: "Create or reconcile the Eternum banks after role and indexer prerequisites are satisfied.",
            workflowName: "factory-v2-step-create-banks",
            status: "pending",
            verification: "Waiting for role grant.",
            latestEvent: "No action taken yet.",
          }),
        ]
      : [
          buildStep({
            id: "sync-paymaster",
            title: "Sync paymaster policy",
            summary: "Diff and sync the paymaster policy for the blitz launch surface.",
            workflowName: "factory-v2-step-sync-paymaster",
            status: "pending",
            verification: "Waiting for the indexer step.",
            latestEvent: "No action taken yet.",
          }),
        ];

  return [...sharedSteps, ...modeSteps];
};

function describeRunState(steps: FactoryRunStep[]): { status: FactoryRunStatus; summary: string } {
  if (steps.some((step) => step.status === "blocked" || step.status === "failed")) {
    return {
      status: "attention",
      summary: "This game needs your help.",
    };
  }

  if (steps.every((step) => step.status === "succeeded" || step.status === "already_done")) {
    return {
      status: "complete",
      summary: "This game is ready.",
    };
  }

  const runningStep = steps.find((step) => step.status === "running");
  if (runningStep) {
    return {
      status: runningStep.title.toLowerCase().includes("wait") ? "waiting" : "running",
      summary: runningStep.title.toLowerCase().includes("wait") ? "Waiting for the next step." : "Working on it now.",
    };
  }

  const pendingStep = steps.find((step) => step.status === "pending");
  return {
    status: "running",
    summary: pendingStep ? "Ready for the next step." : "Ready to go.",
  };
}

const rebuildRun = (run: FactoryRun, steps: FactoryRunStep[]) => {
  const { status: _status, summary: _summary, ...runBase } = run;
  return buildRun({
    ...runBase,
    updatedAt: "Updated just now",
    steps,
  });
};

const completeStepAndStartNext = (steps: FactoryRunStep[], stepId: string): FactoryRunStep[] => {
  const runningIndex = steps.findIndex((step) => step.id === stepId);
  const nextIndex = steps.findIndex((step, index) => index > runningIndex && step.status === "pending");

  return steps.map((step, index) => {
    if (index === runningIndex) {
      return {
        ...step,
        status: "succeeded",
        verification: "The workflow completed and the result was verified.",
        latestEvent: "Watcher marked the step successful after reconciliation.",
      };
    }

    if (index === nextIndex) {
      return {
        ...step,
        status: "running",
        verification: "Workflow dispatched and being watched.",
        latestEvent: "Reusable workflow is now active.",
      };
    }

    return step;
  });
};

const startPendingStep = (steps: FactoryRunStep[], stepId: string): FactoryRunStep[] =>
  steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          status: "running",
          verification: "Workflow dispatched and being watched.",
          latestEvent: "Reusable workflow is now active.",
        }
      : step,
  );

const retryBlockedStep = (steps: FactoryRunStep[], stepId: string): FactoryRunStep[] => {
  const blockedIndex = steps.findIndex((step) => step.id === stepId);
  const nextPendingIndex = steps.findIndex((step, index) => index > blockedIndex && step.status === "pending");

  return steps.map((step, index) => {
    if (index === blockedIndex) {
      return {
        ...step,
        status: "succeeded",
        verification: "Retry succeeded and the role state was verified.",
        latestEvent: "Retry workflow completed without requiring a manual workaround.",
      };
    }

    if (index === nextPendingIndex) {
      return {
        ...step,
        status: "running",
        verification: "Workflow dispatched and being watched.",
        latestEvent: "Reusable workflow is now active.",
      };
    }

    return step;
  });
};
