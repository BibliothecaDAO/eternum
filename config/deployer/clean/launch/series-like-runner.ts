import { setTimeout as sleep } from "node:timers/promises";
import { Account, RpcProvider, shortString } from "starknet";
import { assertProviderChain } from "@realms-world/chain";
import { resolveDeploymentEnvironment } from "../environment";
import {
  assertRegistrarAvailable,
  isRegistrarAlreadyRegisteredError,
  registerSeries,
  resolveRegistrarEnvironmentId,
} from "../registrar/calls";
import { resolveAccountCredentials } from "../shared/credentials";
import type {
  DeploymentEnvironmentId,
  LaunchGameRequest,
  LaunchRotationRequest,
  LaunchRotationSummary,
  LaunchSeriesRequest,
  LaunchSeriesStepId,
  LaunchSeriesSummary,
  SeriesLaunchGameStepState,
  SeriesLaunchGameSummary,
} from "../types";
import { runLaunchStep } from "./runner";
import { SERIES_GAME_STEP_BY_GROUPED_STEP } from "./series-plan";

const DEFAULT_REGISTRAR_STEP_DELAY_MS = 250;

type SeriesLikeRequest = LaunchSeriesRequest | LaunchRotationRequest;
type SeriesLikeSummary = LaunchSeriesSummary | LaunchRotationSummary;

function resolveSeriesLikeEnvironmentId(request: SeriesLikeRequest): DeploymentEnvironmentId {
  return request.environmentId;
}

export function resolveSeriesLikeStepDelayMs(request: SeriesLikeRequest): number {
  resolveDeploymentEnvironment(resolveSeriesLikeEnvironmentId(request));
  return DEFAULT_REGISTRAR_STEP_DELAY_MS;
}

function updateSeriesLikeGameStepState(
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
  status: SeriesLaunchGameStepState["status"],
  latestEvent: string,
  errorMessage?: string,
): SeriesLaunchGameSummary {
  return {
    ...game,
    currentStepId: status === "succeeded" ? null : stepId,
    status,
    latestEvent,
    steps: game.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status,
            latestEvent,
            updatedAt: new Date().toISOString(),
            errorMessage,
          }
        : step,
    ),
  };
}

function updateSeriesLikeGameSuccess(
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
  gameSummary: Awaited<ReturnType<typeof runLaunchStep>>,
): SeriesLaunchGameSummary {
  return {
    ...updateSeriesLikeGameStepState(game, stepId, "succeeded", `Completed ${stepId}`),
    durationSeconds: gameSummary.durationSeconds ?? game.durationSeconds,
    configSteps: gameSummary.configSteps,
    artifacts: {
      ...game.artifacts,
      gameId: gameSummary.gameId ?? game.artifacts.gameId,
      worldAddress: gameSummary.worldAddress || game.artifacts.worldAddress,
      createGameTxHash: gameSummary.createGameTxHash || game.artifacts.createGameTxHash,
      openLedgerTxHash: gameSummary.openLedgerTxHash || game.artifacts.openLedgerTxHash,
      sponsorLedgerTxHash: gameSummary.sponsorLedgerTxHash || game.artifacts.sponsorLedgerTxHash,
    },
  };
}

function updateSeriesLikeGameFailure(
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
  error: unknown,
): SeriesLaunchGameSummary {
  const message = error instanceof Error ? error.message : String(error);
  return updateSeriesLikeGameStepState(game, stepId, "failed", message, message);
}

export function buildSeriesLikeGameLaunchRequest(
  request: SeriesLikeRequest,
  summary: SeriesLikeSummary,
  game: SeriesLaunchGameSummary,
): LaunchGameRequest {
  return {
    launchKind: "game",
    environmentId: request.environmentId,
    gameName: game.gameName,
    startTime: game.startTime,
    rpcUrl: summary.rpcUrl,
    ledgerAddress: request.ledgerAddress,
    ledgerRpcUrl: request.ledgerRpcUrl,
    lordsAddress: request.lordsAddress,
    sponsoredPoolLords: request.sponsoredPoolLords,
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    mapConfigOverrides: request.mapConfigOverrides,
    biomeClimateOverrides: game.biomeClimateOverrides ?? request.biomeClimateOverrides,
    blitzRegistrationOverrides: game.blitzRegistrationOverrides ?? request.blitzRegistrationOverrides,
    executionMode: request.executionMode,
    version: request.version,
    seriesName: summary.seriesName,
    seriesGameNumber: game.seriesGameNumber,
    waitForFactoryIndexTimeoutMs: request.waitForFactoryIndexTimeoutMs,
    waitForFactoryIndexPollMs: request.waitForFactoryIndexPollMs,
    dryRun: request.dryRun,
  };
}

function hasCompletedSeriesLikeGameStep(game: SeriesLaunchGameSummary, stepId: LaunchSeriesStepId): boolean {
  return game.steps.some((step) => step.id === stepId && step.status === "succeeded");
}

function hasSeriesLikeGameStep(game: SeriesLaunchGameSummary, stepId: LaunchSeriesStepId): boolean {
  return resolveSeriesLikeGameStepIndex(game, stepId) >= 0;
}

function resolveSeriesLikeGameStepIndex(game: SeriesLaunchGameSummary, stepId: LaunchSeriesStepId): number {
  return game.steps.findIndex((step) => step.id === stepId);
}

function resolveRequiredSeriesLikeGameStepId(
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
): LaunchSeriesStepId | null {
  const stepIndex = resolveSeriesLikeGameStepIndex(game, stepId);
  if (stepIndex <= 0) {
    return null;
  }

  return game.steps[stepIndex - 1]?.id ?? null;
}

function hasCompletedSeriesLikeGamePrerequisite(
  summary: SeriesLikeSummary,
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
): boolean {
  const requiredStepId = resolveRequiredSeriesLikeGameStepId(game, stepId);
  if (!requiredStepId) {
    return true;
  }

  if (requiredStepId === "create-series") {
    return summary.seriesCreated;
  }

  return hasCompletedSeriesLikeGameStep(game, requiredStepId);
}

function resolveTargetedSeriesLikeGameNames(
  request: SeriesLikeRequest,
  summary: SeriesLikeSummary,
  stepId: LaunchSeriesStepId,
): Set<string> | null {
  if (!request.targetGameNames || request.targetGameNames.length === 0) {
    return null;
  }

  const availableGameNames = new Set(summary.games.map((game) => game.gameName));
  const missingGameNames = request.targetGameNames.filter((gameName) => !availableGameNames.has(gameName));

  if (missingGameNames.length > 0) {
    throw new Error(
      `Requested game${missingGameNames.length === 1 ? "" : "s"} not found in ${
        summary.seriesName
      }: ${missingGameNames.join(", ")}`,
    );
  }

  return new Set(request.targetGameNames);
}

function shouldRunSeriesLikeGameStep(
  summary: SeriesLikeSummary,
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
  targetedGameNames: Set<string> | null,
): boolean {
  if (!hasSeriesLikeGameStep(game, stepId)) {
    return false;
  }

  if (!hasCompletedSeriesLikeGamePrerequisite(summary, game, stepId)) {
    return false;
  }

  if (!targetedGameNames) {
    return !hasCompletedSeriesLikeGameStep(game, stepId);
  }

  if (!targetedGameNames.has(game.gameName)) {
    return false;
  }

  return !hasCompletedSeriesLikeGameStep(game, stepId);
}

function requiresContiguousSeriesGameCreation(stepId: LaunchSeriesStepId): boolean {
  return stepId === "create-worlds";
}

async function waitBetweenSeriesLikeGameCalls(delayMs: number, isFirstExecution: boolean): Promise<void> {
  if (isFirstExecution || delayMs <= 0) {
    return;
  }

  await sleep(delayMs);
}

export async function createSeriesIfNeededForSeriesLikeSummary<TSummary extends SeriesLikeSummary>(
  request: SeriesLikeRequest,
  summary: TSummary,
  persistSummary: (summary: TSummary) => TSummary,
): Promise<TSummary> {
  if (summary.seriesCreated) {
    return persistSummary(summary);
  }

  const environment = resolveDeploymentEnvironment(request.environmentId);
  const registrarEnvironmentId = resolveRegistrarEnvironmentId(environment.id);
  assertRegistrarAvailable(registrarEnvironmentId);
  const { accountAddress, privateKey } = resolveAccountCredentials({
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    fallbackAccountAddress: environment.accountAddress,
    fallbackPrivateKey: environment.privateKey,
    context: `environment "${environment.id}"`,
  });
  const provider = new RpcProvider({ nodeUrl: summary.rpcUrl });
  await assertProviderChain(provider, environment.chain, "RPC_URL");
  const account = new Account({
    provider,
    address: accountAddress,
    signer: privateKey,
  });

  const encodedSeriesName = shortString.encodeShortString(summary.seriesName);
  const numGames = "maxGames" in summary ? summary.maxGames : summary.games.length;
  try {
    await registerSeries(
      account,
      {
        seriesId: encodedSeriesName,
        owner: accountAddress,
        numGames,
      },
      registrarEnvironmentId,
    );
  } catch (error) {
    if (!isRegistrarAlreadyRegisteredError(error)) {
      throw error;
    }
  }

  return persistSummary({
    ...summary,
    seriesCreated: true,
    seriesCreatedAt: new Date().toISOString(),
  });
}

export async function runGroupedSeriesLikeGameStep<TSummary extends SeriesLikeSummary>({
  request,
  summary,
  stepId,
  persistSummary,
  runGameStep = runLaunchStep,
}: {
  request: SeriesLikeRequest;
  summary: TSummary;
  stepId: Exclude<LaunchSeriesStepId, "create-series">;
  persistSummary: (summary: TSummary) => TSummary;
  runGameStep?: typeof runLaunchStep;
}): Promise<TSummary> {
  const mappedGameStepId = SERIES_GAME_STEP_BY_GROUPED_STEP[stepId];
  const targetedGameNames = resolveTargetedSeriesLikeGameNames(request, summary, stepId);
  const delayMs = resolveSeriesLikeStepDelayMs(request);
  const nextGames: SeriesLaunchGameSummary[] = [];
  let executedChildren = 0;
  let failureCount = 0;

  for (const game of summary.games) {
    if (!shouldRunSeriesLikeGameStep(summary, game, stepId, targetedGameNames)) {
      nextGames.push(game);
      continue;
    }

    await waitBetweenSeriesLikeGameCalls(delayMs, executedChildren === 0);
    executedChildren += 1;

    const runningGame = updateSeriesLikeGameStepState(game, stepId, "running", `Running ${stepId}`);
    nextGames.push(runningGame);

    const inFlightSummary = persistSummary({
      ...summary,
      games: [...nextGames, ...summary.games.slice(nextGames.length)],
    } as TSummary);

    let shouldStopAfterFailure = false;

    try {
      const gameSummary = await runGameStep({
        ...buildSeriesLikeGameLaunchRequest(request, inFlightSummary, runningGame),
        stepId: mappedGameStepId,
      });
      nextGames[nextGames.length - 1] = updateSeriesLikeGameSuccess(runningGame, stepId, gameSummary);
    } catch (error) {
      failureCount += 1;
      nextGames[nextGames.length - 1] = updateSeriesLikeGameFailure(runningGame, stepId, error);
      shouldStopAfterFailure = requiresContiguousSeriesGameCreation(stepId);
    }

    persistSummary({
      ...summary,
      games: [...nextGames, ...summary.games.slice(nextGames.length)],
    } as TSummary);

    if (shouldStopAfterFailure) {
      break;
    }
  }

  const finalGames = [...nextGames, ...summary.games.slice(nextGames.length)];
  const nextSummary = persistSummary({
    ...summary,
    games: finalGames,
  } as TSummary);

  if (failureCount > 0) {
    throw new Error(`${failureCount} rotation or series game${failureCount === 1 ? "" : "s"} failed during ${stepId}`);
  }

  return nextSummary;
}
