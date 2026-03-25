import type {
  FactoryRunRecord,
  FactoryRotationRunRecord,
  FactoryRunStepRecord,
  FactorySeriesRunRecord,
} from "./run-store/types";
import type { SeriesLaunchGameSummary, SeriesLaunchGameStepState } from "./types";

interface PrizeFundingReadiness {
  ready: boolean;
  reason?: string;
}

type SeriesLikeRunRecord = FactorySeriesRunRecord | FactoryRotationRunRecord;

const GAME_PRIZE_FUNDING_STEP_ID = "configure-world";
const SERIES_LIKE_PRIZE_FUNDING_STEP_ID = "configure-worlds";

export function resolveGamePrizeFundingReadiness(
  runRecord: Pick<FactoryRunRecord, "gameName" | "artifacts" | "steps">,
): PrizeFundingReadiness {
  if (!runRecord.artifacts.worldAddress) {
    return {
      ready: false,
      reason: `Game "${runRecord.gameName}" is missing a world address`,
    };
  }

  if (!hasSucceededRunStep(runRecord.steps, GAME_PRIZE_FUNDING_STEP_ID)) {
    return {
      ready: false,
      reason: `Game "${runRecord.gameName}" must finish world configuration before prize funding`,
    };
  }

  return { ready: true };
}

export function resolveSeriesLikeGamePrizeFundingReadiness(
  game: Pick<SeriesLaunchGameSummary, "gameName" | "artifacts" | "steps">,
): PrizeFundingReadiness {
  if (!game.artifacts.worldAddress) {
    return {
      ready: false,
      reason: `Game "${game.gameName}" is missing a world address`,
    };
  }

  if (!hasSucceededSeriesLikeGameStep(game.steps, SERIES_LIKE_PRIZE_FUNDING_STEP_ID)) {
    return {
      ready: false,
      reason: `Game "${game.gameName}" must finish world configuration before prize funding`,
    };
  }

  return { ready: true };
}

export function resolveDefaultSeriesLikePrizeFundingGameNames(runRecord: SeriesLikeRunRecord): string[] {
  return runRecord.summary.games
    .filter((game) => {
      const readiness = resolveSeriesLikeGamePrizeFundingReadiness(game);
      return readiness.ready && (game.artifacts.prizeFunding?.transfers.length ?? 0) === 0;
    })
    .map((game) => game.gameName);
}

export function resolveSelectedSeriesLikePrizeFundingGameNames(
  runRecord: SeriesLikeRunRecord,
  requestedGameNames: string[],
): string[] {
  const selectedGameNames =
    requestedGameNames.length > 0 ? requestedGameNames : resolveDefaultSeriesLikePrizeFundingGameNames(runRecord);

  if (selectedGameNames.length === 0) {
    throw new Error(`No eligible unfunded games are ready in "${resolveSeriesLikeRunDisplayName(runRecord)}"`);
  }

  const selectedGameNameSet = new Set(selectedGameNames);
  const orderedGames = runRecord.summary.games.filter((game) => selectedGameNameSet.has(game.gameName));

  if (orderedGames.length !== selectedGameNameSet.size) {
    throw new Error(`One or more selected games were not found in "${resolveSeriesLikeRunDisplayName(runRecord)}"`);
  }

  for (const game of orderedGames) {
    const readiness = resolveSeriesLikeGamePrizeFundingReadiness(game);

    if (!readiness.ready) {
      throw new Error(readiness.reason ?? `Game "${game.gameName}" is not ready for prize funding`);
    }
  }

  return orderedGames.map((game) => game.gameName);
}

function hasSucceededRunStep(steps: FactoryRunStepRecord[], stepId: string) {
  return steps.some((step) => step.id === stepId && step.status === "succeeded");
}

function hasSucceededSeriesLikeGameStep(steps: SeriesLaunchGameStepState[], stepId: string) {
  return steps.some((step) => step.id === stepId && step.status === "succeeded");
}

function resolveSeriesLikeRunDisplayName(runRecord: SeriesLikeRunRecord) {
  return runRecord.kind === "rotation" ? runRecord.rotationName : runRecord.seriesName;
}
