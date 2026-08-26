import type { FactoryRecoveryStepId, FactoryRun, FactoryRunStatus, FactoryRunStepId, FactoryStepStatus } from "./types";

type FactoryRunStep = FactoryRun["steps"][number];
type FactoryStepCopy = {
  title: string;
  pending: string;
  running: string;
  done: string;
  failed: string;
  alreadyDone?: string;
};

interface FactoryRunPrimaryAction {
  kind: "continue";
  label: string;
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
  "create-series": {
    title: "Preparing series",
    pending: "We have not started preparing this series yet.",
    running: "We’re preparing this series so games can be added.",
    done: "This series is ready for its games.",
    failed: "We could not prepare this series.",
  },
  "create-world": {
    title: "Deploying game",
    pending: "We have not started deploying this game yet.",
    running: "We’re deploying this game now.",
    done: "This game is deployed.",
    failed: "We could not deploy this game.",
  },
  "create-worlds": {
    title: "Deploying games",
    pending: "We have not started deploying these games yet.",
    running: "We’re deploying these games now.",
    done: "All planned games are deployed.",
    failed: "We could not finish deploying every planned game.",
  },
  "wait-for-factory-index": {
    title: "Checking GameRegistry",
    pending: "We have not started confirming this game in GameRegistry yet.",
    running: "We’re confirming this game is showing up in GameRegistry.",
    done: "This game is showing up in GameRegistry.",
    failed: "We could not confirm this game in GameRegistry yet.",
  },
  "wait-for-factory-indexes": {
    title: "Checking deployed games",
    pending: "We have not started confirming these deployed games in GameRegistry yet.",
    running: "We’re confirming the deployed games are showing up in GameRegistry.",
    done: "These deployed games are showing up in GameRegistry.",
    failed: "We could not confirm every deployed game in GameRegistry yet.",
  },
};

export const getEnvironmentLabel = (environment: string) =>
  environment.startsWith("madara.") ? "Madara" : environment.startsWith("appchain.") ? "Appchain" : "Unknown";

export const getRunStatusMeta = (status: FactoryRunStatus) => {
  switch (status) {
    case "attention":
      return {
        label: "Needs attention",
        className: "border border-rose-300/50 bg-rose-950/30 text-rose-400",
      };
    case "waiting":
      return {
        label: "Getting Ready",
        className: "border border-gold/10 bg-black/20 text-gold/62",
      };
    case "complete":
      return {
        label: "Ready",
        className: "border border-gold/10 bg-black/25 text-gold/70",
      };
    case "running":
    default:
      return {
        label: "In progress",
        className: "border border-gold/20 bg-[rgba(32,27,22,0.9)] text-[#dfaa54] shadow-[0_8px_18px_rgba(0,0,0,0.18)]",
      };
  }
};

export const getStepStatusMeta = (status: FactoryStepStatus) => {
  switch (status) {
    case "succeeded":
      return {
        label: "Done",
        className: "border border-gold/10 bg-black/20 text-gold/58",
        railClassName: "bg-gold/25",
      };
    case "already_done":
      return {
        label: "Done",
        className: "border border-gold/10 bg-black/20 text-gold/52",
        railClassName: "bg-gold/20",
      };
    case "running":
      return {
        label: "Current",
        className: "border border-gold/20 bg-[rgba(32,27,22,0.92)] text-[#dfaa54] shadow-[0_8px_18px_rgba(0,0,0,0.18)]",
        railClassName: "bg-[#dfaa54]",
      };
    case "blocked":
      return {
        label: "Needs attention",
        className: "border border-rose-300/50 bg-rose-950/30 text-rose-400",
        railClassName: "bg-rose-300",
      };
    case "failed":
      return {
        label: "Needs attention",
        className: "border border-rose-300/50 bg-rose-950/30 text-rose-400",
        railClassName: "bg-rose-400",
      };
    case "pending":
    default:
      return {
        label: "Up next",
        className: "border border-gold/10 bg-black/20 text-gold/52",
        railClassName: "bg-black/30",
      };
  }
};

const countSatisfiedSteps = (run: FactoryRun) =>
  run.steps.filter((step) => step.status === "succeeded" || step.status === "already_done").length;

function resolveRunChildStatusCounts(run: FactoryRun) {
  const counts = {
    ready: 0,
    working: 0,
    pending: 0,
    failed: 0,
  };

  for (const child of run.children || []) {
    switch (child.status) {
      case "succeeded":
        counts.ready += 1;
        break;
      case "running":
        counts.working += 1;
        break;
      case "failed":
        counts.failed += 1;
        break;
      case "pending":
      default:
        counts.pending += 1;
        break;
    }
  }

  return counts;
}

function resolveRunChildStatusSummary(run: FactoryRun) {
  if (!run.children?.length) {
    return null;
  }

  const counts = resolveRunChildStatusCounts(run);
  const parts = [
    counts.ready > 0 ? `${counts.ready} ready` : null,
    counts.working > 0 ? `${counts.working} working` : null,
    counts.pending > 0 ? `${counts.pending} pending` : null,
    counts.failed > 0 ? `${counts.failed} failed` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function appendRunChildStatusSummary(run: FactoryRun, detail: string) {
  const summary = resolveRunChildStatusSummary(run);

  if (!summary) {
    return detail;
  }

  return `${capitalizeSummary(summary)}. ${detail}`;
}

function capitalizeSummary(summary: string) {
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

function resolveRunWithoutCurrentStepCopy(run: FactoryRun) {
  switch (run.status) {
    case "complete":
      return {
        headline: `This ${resolveRunSubject(run)} is ready`,
        currentStepLabel: "Everything is ready",
        detailMessage: `Everything is ready for this ${resolveRunSubject(run)}.`,
      };
    case "attention":
      return {
        headline: `This ${resolveRunSubject(run)} needs attention`,
        currentStepLabel: "Needs attention",
        detailMessage: resolveFailedRunDetailMessage(run),
      };
    case "waiting":
      return {
        headline: "Waiting on the next setup step",
        currentStepLabel: "Getting ready",
        detailMessage: "We are waiting for the next setup update.",
      };
    case "running":
    default:
      return {
        headline:
          run.kind === "rotation" ? "Keeping this rotation filled" : `Getting this ${resolveRunSubject(run)} ready`,
        currentStepLabel: "Working through setup",
        detailMessage:
          run.kind === "rotation"
            ? "We’re checking this rotation, filling any missing games, and finishing setup where needed."
            : "We’re still moving through setup.",
      };
  }
}

const resolveRunSubject = (run: FactoryRun) => {
  if (run.kind === "rotation") {
    return "rotation";
  }

  return run.kind === "series" ? "series" : "game";
};

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
    return resolveRunWithoutCurrentStepCopy(run).headline;
  }

  switch (currentStep.status) {
    case "running":
      if (run.kind === "rotation") {
        return "Keeping this rotation filled";
      }

      return run.kind === "series" ? "Getting this series ready" : "Getting this game ready";
    case "blocked":
    case "failed":
      return `This ${resolveRunSubject(run)} needs attention`;
    case "pending":
      return "Waiting on the next setup step";
    case "succeeded":
    case "already_done":
    default:
      return "That step is done";
  }
};

export const getRunCurrentStepLabel = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (currentStep) {
    return getSimpleStepTitle(currentStep);
  }

  return resolveRunWithoutCurrentStepCopy(run).currentStepLabel;
};

export const getRunDetailMessage = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return appendRunChildStatusSummary(run, resolveRunWithoutCurrentStepCopy(run).detailMessage);
  }

  switch (currentStep.status) {
    case "running":
      return appendRunChildStatusSummary(
        run,
        run.kind === "rotation"
          ? "We’re checking this rotation, filling any missing games, and finishing setup where needed."
          : "We’re still moving through setup.",
      );
    case "blocked":
    case "failed":
      return appendRunChildStatusSummary(run, resolveFailedRunDetailMessage(run));
    case "pending":
      return appendRunChildStatusSummary(run, "The next setup step has not started yet.");
    case "succeeded":
    case "already_done":
    default:
      return appendRunChildStatusSummary(run, "That step is finished.");
  }
};

export const getRunProgressLabel = (run: FactoryRun) => {
  const { currentStepNumber, totalSteps } = resolveRunProgressMetrics(run);
  return `${currentStepNumber} of ${totalSteps} parts`;
};

export const getRunStatusHighlights = (run: FactoryRun) => {
  if (!run.children?.length) {
    return [];
  }

  const counts = resolveRunChildStatusCounts(run);

  return [
    counts.ready > 0 ? `${counts.ready} ready` : null,
    counts.working > 0 ? `${counts.working} working` : null,
    counts.pending > 0 ? `${counts.pending} pending` : null,
    counts.failed > 0 ? `${counts.failed} failed` : null,
  ].filter((value): value is string => Boolean(value));
};

export const resolveRunPrimaryAction = (run: FactoryRun): FactoryRunPrimaryAction | null => {
  const continueStepId = resolveRunContinueStepId(run);

  if (continueStepId) {
    return {
      kind: "continue",
      label: "Continue",
      stepId: continueStepId,
    };
  }

  return null;
};

function resolveRunContinueStepId(run: FactoryRun): FactoryRecoveryStepId | null {
  if (isContinuePausedForCancelledAutoRetry(run)) {
    return null;
  }

  if (!run.recovery?.canContinue || !run.recovery.continueStepId) {
    return null;
  }

  return run.recovery.continueStepId;
}

function resolveFailedRunDetailMessage(run: FactoryRun) {
  if (isContinuePausedForCancelledAutoRetry(run)) {
    return `This ${resolveRunSubject(run)} stopped and auto-retry is off.`;
  }

  return `This ${resolveRunSubject(run)} stopped, but it can continue from the last unfinished step.`;
}

function isContinuePausedForCancelledAutoRetry(run: FactoryRun) {
  return Boolean((run.kind === "series" || run.kind === "rotation") && run.autoRetry?.cancelledAt);
}
