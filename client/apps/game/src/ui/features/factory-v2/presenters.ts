import type { FactoryRecoveryStepId, FactoryRun, FactoryRunStatus, FactoryRunStepId, FactoryStepStatus } from "./types";

type FactoryRunStep = FactoryRun["steps"][number];
type FactoryRunLaunchScope = "full" | FactoryRecoveryStepId;
type FactoryStepCopy = {
  title: string;
  pending: string;
  running: string;
  done: string;
  failed: string;
  alreadyDone?: string;
};

interface FactoryRunPrimaryAction {
  kind: "retry" | "continue";
  label: string;
  launchScope: FactoryRunLaunchScope;
  stepId: FactoryRecoveryStepId;
}

const STEP_COPY_BY_ID: Record<FactoryRunStepId, FactoryStepCopy> = {
  "launch-request": {
    title: "Submitting request",
    pending: "We have not sent the request to start this game yet.",
    running: "We’re sending the request to start this game.",
    done: "The request to start this game was accepted.",
    failed: "We could not send the request to start this game.",
  },
  "create-world": {
    title: "Creating world",
    pending: "We have not started creating the new game world yet.",
    running: "We’re creating the new game world.",
    done: "The new game world is ready.",
    failed: "We could not create the new game world.",
  },
  "wait-factory-index": {
    title: "Waiting for game",
    pending: "We have not started checking for the new game yet.",
    running: "We’re waiting for the new game to appear in Factory.",
    done: "The new game is now showing up in Factory.",
    failed: "The new game has not appeared in Factory yet.",
  },
  "wait-for-factory-index": {
    title: "Waiting for game",
    pending: "We have not started checking for the new game yet.",
    running: "We’re waiting for the new game to appear in Factory.",
    done: "The new game is now showing up in Factory.",
    failed: "The new game has not appeared in Factory yet.",
  },
  "apply-config": {
    title: "Applying settings",
    pending: "We have not started applying this game’s settings yet.",
    running: "We’re applying this game’s settings.",
    done: "This game’s settings are in place.",
    failed: "We could not finish applying this game’s settings.",
  },
  "configure-world": {
    title: "Applying settings",
    pending: "We have not started applying this game’s settings yet.",
    running: "We’re applying this game’s settings.",
    done: "This game’s settings are in place.",
    failed: "We could not finish applying this game’s settings.",
  },
  "grant-lootchest-role": {
    title: "Setting up loot chests",
    pending: "We have not started turning on loot chests yet.",
    running: "We’re turning on loot chests for this game.",
    done: "Loot chests are ready for this game.",
    failed: "We could not turn on loot chests for this game.",
  },
  "grant-village-pass": {
    title: "Setting up village pass",
    pending: "We have not started turning on village pass yet.",
    running: "We’re turning on village pass for this game.",
    done: "Village pass is ready for this game.",
    failed: "We could not turn on village pass for this game.",
  },
  "grant-village-pass-role": {
    title: "Setting up village pass",
    pending: "We have not started turning on village pass yet.",
    running: "We’re turning on village pass for this game.",
    done: "Village pass is ready for this game.",
    failed: "We could not turn on village pass for this game.",
  },
  "create-banks": {
    title: "Preparing banks",
    pending: "We have not started preparing the banks yet.",
    running: "We’re preparing the banks for this game.",
    done: "The banks are ready for this game.",
    failed: "We could not prepare the banks for this game.",
  },
  "create-indexer": {
    title: "Finishing setup",
    pending: "We have not started the final setup step yet.",
    running: "We’re finishing the last setup step.",
    done: "The last setup step is done.",
    failed: "We could not finish the last setup step.",
    alreadyDone: "The last setup step was already done.",
  },
  "wait-indexer": {
    title: "Finishing setup",
    pending: "We have not started the final setup step yet.",
    running: "We’re finishing the last setup step.",
    done: "The last setup step is done.",
    failed: "We could not finish the last setup step.",
    alreadyDone: "The last setup step was already done.",
  },
  "sync-paymaster": {
    title: "Setting up gas coverage",
    pending: "We have not started turning on gas coverage yet.",
    running: "We’re turning on gas coverage for this game.",
    done: "Gas coverage is ready for this game.",
    failed: "We could not turn on gas coverage for this game.",
  },
  "publish-ready-state": {
    title: "Marking game ready",
    pending: "We have not marked this game ready yet.",
    running: "We’re marking this game ready.",
    done: "This game is marked ready.",
    failed: "We could not mark this game ready.",
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
    case "sync-paymaster":
      return "sync-paymaster";
    case "create-indexer":
    case "wait-indexer":
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
  STEP_COPY_BY_ID[step.id]?.title ?? step.title;

export const getStepStatusMessage = (stepId: FactoryRunStepId, status: FactoryStepStatus) => {
  const detailMessages = STEP_COPY_BY_ID[stepId];

  if (!detailMessages) {
    return null;
  }

  switch (status) {
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

export const getStepDetailMessage = (step: FactoryRun["steps"][number]) => {
  return getStepStatusMessage(step.id, step.status) ?? step.latestEvent;
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
