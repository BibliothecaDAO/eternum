import type { FactoryRecoveryStepId, FactoryRun, FactoryRunStatus, FactoryRunStepId, FactoryStepStatus } from "./types";

type FactoryRunStep = FactoryRun["steps"][number];
type FactoryRunLaunchScope = "full" | FactoryRecoveryStepId;

interface FactoryRunPrimaryAction {
  kind: "retry" | "continue";
  label: string;
  launchScope: FactoryRunLaunchScope;
  stepId: FactoryRecoveryStepId;
}

const SIMPLE_STEP_TITLES: Record<string, string> = {
  "create-world": "Start the game",
  "wait-factory-index": "Confirm game deployment",
  "wait-for-factory-index": "Confirm game deployment",
  "apply-config": "Apply game setup",
  "configure-world": "Apply game setup",
  "grant-lootchest-role": "Turn on loot chests",
  "create-indexer": "Bring it online",
  "wait-indexer": "Bring it online",
  "grant-village-pass": "Deploy village pass",
  "grant-village-pass-role": "Deploy village pass",
  "create-banks": "Place banks",
  "sync-paymaster": "Cover gas (paymaster)",
  "publish-ready-state": "Mark it ready",
};

const STEP_DETAIL_MESSAGES: Record<
  FactoryRunStepId,
  {
    pending: string;
    running: string;
    done: string;
    failed: string;
    alreadyDone?: string;
  }
> = {
  "create-world": {
    pending: "This game has not been started yet.",
    running: "We are starting the game.",
    done: "The game has been started.",
    failed: "The game could not be started.",
  },
  "wait-factory-index": {
    pending: "We have not checked the game yet.",
    running: "We are confirming the game is there.",
    done: "The game is confirmed.",
    failed: "We could not confirm the game yet.",
  },
  "wait-for-factory-index": {
    pending: "We have not checked the game yet.",
    running: "We are confirming the game is there.",
    done: "The game is confirmed.",
    failed: "We could not confirm the game yet.",
  },
  "apply-config": {
    pending: "The setup has not been applied yet.",
    running: "We are applying the setup.",
    done: "The setup is in place.",
    failed: "The setup did not finish.",
  },
  "configure-world": {
    pending: "The setup has not been applied yet.",
    running: "We are applying the setup.",
    done: "The setup is in place.",
    failed: "The setup did not finish.",
  },
  "grant-lootchest-role": {
    pending: "Rewards are not turned on yet.",
    running: "We are turning rewards on.",
    done: "Rewards are turned on.",
    failed: "Rewards could not be turned on.",
  },
  "grant-village-pass": {
    pending: "Village pass is not open yet.",
    running: "We are opening village pass.",
    done: "Village pass is open.",
    failed: "Village pass could not be opened.",
  },
  "grant-village-pass-role": {
    pending: "Village pass is not open yet.",
    running: "We are opening village pass.",
    done: "Village pass is open.",
    failed: "Village pass could not be opened.",
  },
  "create-banks": {
    pending: "Banks are not placed yet.",
    running: "We are placing banks.",
    done: "Banks are in place.",
    failed: "Banks could not be placed.",
  },
  "create-indexer": {
    pending: "The game is not online yet.",
    running: "We are bringing the game online.",
    done: "The game is online.",
    failed: "The game is not online yet.",
    alreadyDone: "The game was already online.",
  },
  "wait-indexer": {
    pending: "The game is not online yet.",
    running: "We are bringing the game online.",
    done: "The game is online.",
    failed: "The game is not online yet.",
    alreadyDone: "The game was already online.",
  },
  "sync-paymaster": {
    pending: "Gas help is not ready yet.",
    running: "We are turning on gas help.",
    done: "Gas help is ready.",
    failed: "Gas help could not be turned on.",
  },
  "publish-ready-state": {
    pending: "This game is not marked ready yet.",
    running: "We are marking this game ready.",
    done: "This game is marked ready.",
    failed: "This game could not be marked ready.",
  },
};

export const getEnvironmentLabel = (environment: string) => (environment.startsWith("mainnet.") ? "Mainnet" : "Slot");

export const getRunStatusMeta = (status: FactoryRunStatus) => {
  switch (status) {
    case "attention":
      return {
        label: "Needs Help",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
      };
    case "waiting":
      return {
        label: "Getting Ready",
        className: "border border-sky-300/50 bg-sky-50 text-sky-700",
      };
    case "complete":
      return {
        label: "Done",
        className: "border border-emerald-300/50 bg-emerald-50 text-emerald-700",
      };
    case "running":
    default:
      return {
        label: "Working",
        className: "border border-amber-300/50 bg-amber-50 text-amber-700",
      };
  }
};

export const getStepStatusMeta = (status: FactoryStepStatus) => {
  switch (status) {
    case "succeeded":
      return {
        label: "Done",
        className: "border border-emerald-300/50 bg-emerald-50 text-emerald-700",
        railClassName: "bg-emerald-300",
      };
    case "already_done":
      return {
        label: "Done",
        className: "border border-amber-300/50 bg-amber-50 text-amber-700",
        railClassName: "bg-amber-300",
      };
    case "running":
      return {
        label: "Now",
        className: "border border-sky-300/50 bg-sky-50 text-sky-700",
        railClassName: "bg-sky-300",
      };
    case "blocked":
      return {
        label: "Needs Help",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
        railClassName: "bg-rose-300",
      };
    case "failed":
      return {
        label: "Needs Help",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
        railClassName: "bg-rose-400",
      };
    case "pending":
    default:
      return {
        label: "Not Yet",
        className: "border border-black/10 bg-black/[0.04] text-black/55",
        railClassName: "bg-black/12",
      };
  }
};

const countSatisfiedSteps = (run: FactoryRun) =>
  run.steps.filter((step) => step.status === "succeeded" || step.status === "already_done").length;

const hasRetryableStep = (run: FactoryRun) =>
  run.steps.some((step) => step.status === "blocked" || step.status === "failed");

const hasContinuableStep = (run: FactoryRun) =>
  !hasRetryableStep(run) &&
  !run.steps.some((step) => step.status === "running") &&
  run.steps.some((step) => step.status === "pending");

const resolveRetryableStep = (run: FactoryRun) =>
  run.steps.find((step) => step.status === "blocked" || step.status === "failed") ?? null;

const resolveContinuableStep = (run: FactoryRun) =>
  run.steps.find((step) => step.status === "pending") ?? run.steps.find((step) => step.status === "running") ?? null;

const resolveFirstStep = (run: FactoryRun) => run.steps[0] ?? null;

const resolveRecoveryStepId = (stepId: FactoryRunStepId): FactoryRecoveryStepId | null => {
  switch (stepId) {
    case "create-world":
      return "create-world";
    case "wait-factory-index":
    case "wait-for-factory-index":
      return "wait-for-factory-index";
    case "apply-config":
    case "configure-world":
      return "configure-world";
    case "grant-lootchest-role":
      return "grant-lootchest-role";
    case "grant-village-pass":
    case "grant-village-pass-role":
      return "grant-village-pass-role";
    case "create-banks":
      return "create-banks";
    case "create-indexer":
    case "wait-indexer":
    case "sync-paymaster":
    case "publish-ready-state":
      return "create-indexer";
    default:
      return null;
  }
};

const shouldRetryFullLaunch = (run: FactoryRun, step: FactoryRunStep) => resolveFirstStep(run)?.id === step.id;

export const getCurrentStep = (run: FactoryRun) =>
  run.steps.find((step) => step.status === "running") ??
  run.steps.find((step) => step.status === "blocked" || step.status === "failed") ??
  run.steps.find((step) => step.status === "pending") ??
  null;

export const getCompletedStep = (run: FactoryRun) =>
  [...run.steps].reverse().find((step) => step.status === "succeeded" || step.status === "already_done") ?? null;

export const getNextStep = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return null;
  }

  const currentStepIndex = run.steps.findIndex((step) => step.id === currentStep.id);

  if (currentStepIndex === -1) {
    return null;
  }

  return run.steps.slice(currentStepIndex + 1).find((step) => step.status === "pending") ?? null;
};

export const getSimpleStepTitle = (step: Pick<FactoryRun["steps"][number], "id" | "title">) =>
  SIMPLE_STEP_TITLES[step.id] ?? step.title;

export const getStepDetailMessage = (step: FactoryRun["steps"][number]) => {
  const detailMessages = STEP_DETAIL_MESSAGES[step.id];

  if (!detailMessages) {
    return step.latestEvent;
  }

  switch (step.status) {
    case "running":
      return detailMessages.running;
    case "succeeded":
      return detailMessages.done;
    case "already_done":
      return detailMessages.alreadyDone ?? detailMessages.done;
    case "blocked":
    case "failed":
      return detailMessages.failed;
    case "pending":
    default:
      return detailMessages.pending;
  }
};

export const getRunHeadline = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return "This game is ready";
  }

  switch (currentStep.status) {
    case "running":
      return "Getting this game ready";
    case "blocked":
    case "failed":
      return shouldRetryFullLaunch(run, currentStep)
        ? "This game needs a fresh start"
        : "This game needs a little help";
    case "pending":
      return "There is still more to do";
    case "succeeded":
    case "already_done":
    default:
      return "That part is done";
  }
};

export const getRunDetailMessage = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return "Everything is ready for this game.";
  }

  switch (currentStep.status) {
    case "running":
      return "We are still getting this game ready.";
    case "blocked":
    case "failed":
      return shouldRetryFullLaunch(run, currentStep)
        ? "This game stopped right away. Start the launch again from the top."
        : "This game got stuck partway through. Try this part again.";
    case "pending":
      return "This part has not started yet.";
    case "succeeded":
    case "already_done":
    default:
      return "That part is finished.";
  }
};

export const getRunProgressLabel = (run: FactoryRun) =>
  `${countSatisfiedSteps(run)} of ${run.steps.length} parts finished`;

export const resolveRunPrimaryAction = (run: FactoryRun): FactoryRunPrimaryAction | null => {
  const retryableStep = resolveRetryableStep(run);
  const retryStepId = retryableStep ? resolveRecoveryStepId(retryableStep.id) : null;

  if (retryableStep && retryStepId) {
    return shouldRetryFullLaunch(run, retryableStep)
      ? {
          kind: "retry",
          label: "Retry full launch",
          launchScope: "full",
          stepId: retryStepId,
        }
      : {
          kind: "retry",
          label: "Retry this step",
          launchScope: retryStepId,
          stepId: retryStepId,
        };
  }

  const continuableStep = hasContinuableStep(run) ? resolveContinuableStep(run) : null;
  const continueStepId = continuableStep ? resolveRecoveryStepId(continuableStep.id) : null;

  if (continuableStep && continueStepId) {
    return {
      kind: "continue",
      label: "Continue",
      launchScope: continueStepId,
      stepId: continueStepId,
    };
  }

  return null;
};
