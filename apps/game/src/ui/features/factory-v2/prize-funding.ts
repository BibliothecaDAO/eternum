import type { FactoryRun, FactoryRunStepId, FactorySeriesChildRun } from "./types";

export type FactoryPrizeFundingEligibleRun = FactoryRun & {
  kind: "game" | "series" | "rotation";
};

const GAME_PRIZE_FUNDING_STEP_ID: FactoryRunStepId = "configure-world";

export function canFundFactoryRunPrize(run: FactoryRun): run is FactoryPrizeFundingEligibleRun {
  if (run.kind === "game") {
    return Boolean(run.worldAddress) && hasSucceededRunStep(run, GAME_PRIZE_FUNDING_STEP_ID);
  }

  if (run.kind !== "series" && run.kind !== "rotation") {
    return false;
  }

  return (run.children ?? []).some(isFactoryPrizeFundingChildReady);
}

export function isFactoryPrizeFundingChildReady(child: FactorySeriesChildRun) {
  return Boolean(child.worldAddress) && Boolean(child.configReady);
}

export function resolveDefaultFactoryPrizeFundingGameNames(run: FactoryPrizeFundingEligibleRun): string[] {
  if (run.kind === "game") {
    return [];
  }

  return (run.children ?? [])
    .filter((child) => isFactoryPrizeFundingChildReady(child) && (child.prizeFunding?.transfers.length ?? 0) === 0)
    .map((child) => child.gameName);
}

function hasSucceededRunStep(run: FactoryRun, stepId: FactoryRunStepId) {
  return run.steps.some((step) => step.id === stepId && step.status === "succeeded");
}
