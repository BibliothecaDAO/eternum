import type { FactoryRun, FactoryRunStatus, FactoryStepStatus } from "./types";

const SIMPLE_STEP_TITLES: Record<string, string> = {
  "create-world": "Make the world",
  "wait-factory-index": "Wait for the world",
  "wait-for-factory-index": "Wait for the world",
  "apply-config": "Set the game rules",
  "configure-world": "Set the game rules",
  "grant-lootchest-role": "Open loot chest",
  "create-indexer": "Connect live data",
  "wait-indexer": "Wait for live data",
  "grant-village-pass": "Open village pass",
  "grant-village-pass-role": "Open village pass",
  "create-banks": "Place banks",
  "sync-paymaster": "Turn on gas help",
  "publish-ready-state": "Show game as ready",
};

export const getEnvironmentLabel = (environment: string) => (environment.startsWith("mainnet.") ? "Mainnet" : "Slot");

export const getRunStatusMeta = (status: FactoryRunStatus) => {
  switch (status) {
    case "attention":
      return {
        label: "Needs You",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
      };
    case "waiting":
      return {
        label: "Waiting",
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
        label: "In Progress",
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
        label: "Already Done",
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
        label: "Stuck",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
        railClassName: "bg-rose-300",
      };
    case "failed":
      return {
        label: "Stuck",
        className: "border border-rose-300/50 bg-rose-50 text-rose-700",
        railClassName: "bg-rose-400",
      };
    case "pending":
    default:
      return {
        label: "Later",
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

export const getCurrentStep = (run: FactoryRun) =>
  run.steps.find((step) => step.status === "running") ??
  run.steps.find((step) => step.status === "blocked" || step.status === "failed") ??
  run.steps.find((step) => step.status === "pending") ??
  null;

export const getSimpleStepTitle = (step: Pick<FactoryRun["steps"][number], "id" | "title">) =>
  SIMPLE_STEP_TITLES[step.id] ?? step.title;

export const getRunHeadline = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return "Game is ready";
  }

  const title = getSimpleStepTitle(currentStep).toLowerCase();

  switch (currentStep.status) {
    case "running":
      return `Working on ${title}`;
    case "blocked":
    case "failed":
      return `${getSimpleStepTitle(currentStep)} needs another try`;
    case "pending":
      return `${getSimpleStepTitle(currentStep)} comes next`;
    case "succeeded":
    case "already_done":
    default:
      return `${getSimpleStepTitle(currentStep)} is done`;
  }
};

export const getRunDetailMessage = (run: FactoryRun) => {
  const currentStep = getCurrentStep(run);

  if (!currentStep) {
    return "Everything needed for this game has finished.";
  }

  switch (currentStep.status) {
    case "running":
      return "The page is watching this part and will move forward when it sees the next state.";
    case "blocked":
    case "failed":
      return "This part got stuck. The safe next move is to try that one part again.";
    case "pending":
      return "The earlier parts need to finish before this one can start.";
    case "succeeded":
    case "already_done":
    default:
      return "That part is complete.";
  }
};

export const getRunProgressLabel = (run: FactoryRun) => `${countSatisfiedSteps(run)} of ${run.steps.length} parts done`;

export const resolveRunPrimaryAction = (run: FactoryRun) => {
  if (hasRetryableStep(run)) {
    return {
      kind: "retry" as const,
      label: "Try again",
    };
  }

  if (hasContinuableStep(run)) {
    return {
      kind: "continue" as const,
      label: "Do next step",
    };
  }

  return null;
};
