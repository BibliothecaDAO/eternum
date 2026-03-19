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
  "launch-request": "Launch the game",
  "create-world": "Create the game",
  "wait-factory-index": "Wait for the game to appear",
  "wait-for-factory-index": "Wait for the game to appear",
  "apply-config": "Apply the game setup",
  "configure-world": "Apply the game setup",
  "grant-lootchest-role": "Enable loot chests",
  "create-indexer": "Start live updates",
  "wait-indexer": "Start live updates",
  "grant-village-pass": "Enable village pass",
  "grant-village-pass-role": "Enable village pass",
  "create-banks": "Create banks",
  "sync-paymaster": "Enable gas coverage",
  "publish-ready-state": "Mark the game ready",
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
  "launch-request": {
    pending: "The launch request has not been sent yet.",
    running: "We are sending the launch request now.",
    done: "The launch request was accepted.",
    failed: "The launch request could not be sent.",
  },
  "create-world": {
    pending: "The game has not been created yet.",
    running: "We are creating the game now.",
    done: "The game has been created.",
    failed: "The game could not be created.",
  },
  "wait-factory-index": {
    pending: "We have not checked for the new game yet.",
    running: "We are waiting for the game to appear.",
    done: "The game is showing up.",
    failed: "The game has not appeared yet.",
  },
  "wait-for-factory-index": {
    pending: "We have not checked for the new game yet.",
    running: "We are waiting for the game to appear.",
    done: "The game is showing up.",
    failed: "The game has not appeared yet.",
  },
  "apply-config": {
    pending: "The game setup has not been applied yet.",
    running: "We are applying the game setup.",
    done: "The game setup is in place.",
    failed: "The game setup did not finish.",
  },
  "configure-world": {
    pending: "The game setup has not been applied yet.",
    running: "We are applying the game setup.",
    done: "The game setup is in place.",
    failed: "The game setup did not finish.",
  },
  "grant-lootchest-role": {
    pending: "Loot chests are not enabled yet.",
    running: "We are enabling loot chests.",
    done: "Loot chests are enabled.",
    failed: "Loot chests could not be enabled.",
  },
  "grant-village-pass": {
    pending: "Village pass is not enabled yet.",
    running: "We are enabling village pass.",
    done: "Village pass is enabled.",
    failed: "Village pass could not be enabled.",
  },
  "grant-village-pass-role": {
    pending: "Village pass is not enabled yet.",
    running: "We are enabling village pass.",
    done: "Village pass is enabled.",
    failed: "Village pass could not be enabled.",
  },
  "create-banks": {
    pending: "Banks are not created yet.",
    running: "We are creating the banks.",
    done: "Banks are ready.",
    failed: "Banks could not be created.",
  },
  "create-indexer": {
    pending: "Live updates are not ready yet.",
    running: "We are starting live updates.",
    done: "Live updates are ready.",
    failed: "Live updates are not ready yet.",
    alreadyDone: "Live updates were already ready.",
  },
  "wait-indexer": {
    pending: "Live updates are not ready yet.",
    running: "We are starting live updates.",
    done: "Live updates are ready.",
    failed: "Live updates are not ready yet.",
    alreadyDone: "Live updates were already ready.",
  },
  "sync-paymaster": {
    pending: "Gas coverage is not ready yet.",
    running: "We are enabling gas coverage.",
    done: "Gas coverage is ready.",
    failed: "Gas coverage could not be enabled.",
  },
  "publish-ready-state": {
    pending: "This game is not marked ready yet.",
    running: "We are marking the game ready.",
    done: "This game is marked ready.",
    failed: "This game could not be marked ready.",
  },
};

export const getEnvironmentLabel = (environment: string) => (environment.startsWith("mainnet.") ? "Mainnet" : "Slot");

export const getRunStatusMeta = (status: FactoryRunStatus) => {
  switch (status) {
    case "attention":
      return {
        label: "Needs attention",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
      };
    case "waiting":
      return {
        label: "Getting Ready",
        className: "border border-black/8 bg-white/55 text-black/62",
      };
    case "complete":
      return {
        label: "Ready",
        className: "border border-black/8 bg-white/68 text-black/70",
      };
    case "running":
    default:
      return {
        label: "In progress",
        className:
          "border border-[#d4b487]/65 bg-[rgba(255,249,239,0.9)] text-[#8a5416] shadow-[0_8px_18px_rgba(186,129,44,0.12)]",
      };
  }
};

export const getStepStatusMeta = (status: FactoryStepStatus) => {
  switch (status) {
    case "succeeded":
      return {
        label: "Done",
        className: "border border-black/8 bg-white/58 text-black/58",
        railClassName: "bg-black/18",
      };
    case "already_done":
      return {
        label: "Done",
        className: "border border-black/8 bg-white/52 text-black/52",
        railClassName: "bg-black/16",
      };
    case "running":
      return {
        label: "Current",
        className:
          "border border-[#d4b487]/65 bg-[rgba(255,249,239,0.92)] text-[#8a5416] shadow-[0_8px_18px_rgba(186,129,44,0.12)]",
        railClassName: "bg-[#d9b16f]",
      };
    case "blocked":
      return {
        label: "Needs attention",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
        railClassName: "bg-rose-300",
      };
    case "failed":
      return {
        label: "Needs attention",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
        railClassName: "bg-rose-400",
      };
    case "pending":
    default:
      return {
        label: "Up next",
        className: "border border-black/8 bg-white/40 text-black/52",
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

export const resolveRunProgressMetrics = (run: FactoryRun) => {
  const totalSteps = Math.max(run.steps.length, 1);
  const currentStep = getCurrentStep(run);
  const settledSteps = countSatisfiedSteps(run);
  const currentStepIndex = currentStep ? run.steps.findIndex((step) => step.id === currentStep.id) : -1;
  const currentStepNumber =
    currentStepIndex >= 0 ? currentStepIndex + 1 : run.status === "complete" ? totalSteps : Math.max(settledSteps, 1);

  return {
    currentStepIndex,
    currentStepNumber,
    totalSteps,
  };
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
      return shouldRetryFullLaunch(run, currentStep) ? "This game needs a fresh start" : "This game needs attention";
    case "pending":
      return "Waiting on the next setup step";
    case "succeeded":
    case "already_done":
    default:
      return "That step is done";
  }
};

export const getRunDetailMessage = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return "Everything is ready for this game.";
  }

  switch (currentStep.status) {
    case "running":
      return "We are still finishing the setup.";
    case "blocked":
    case "failed":
      return shouldRetryFullLaunch(run, currentStep)
        ? "This launch stopped early, so it will need a full retry."
        : "This setup stalled on one step, so that step will need another try.";
    case "pending":
      return "The next setup step has not started yet.";
    case "succeeded":
    case "already_done":
    default:
      return "That step is finished.";
  }
};

export const getRunProgressLabel = (run: FactoryRun) => {
  const { currentStepNumber, totalSteps } = resolveRunProgressMetrics(run);
  return `${currentStepNumber} of ${totalSteps} parts`;
};

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
