import { setTimeout as sleep } from "node:timers/promises";
import { Account, RpcProvider, shortString } from "starknet";
import { isMainnetDeploymentEnvironment, resolveDeploymentEnvironment } from "../environment";
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

const DEFAULT_MAINNET_STEP_DELAY_MS = 1_500;
const DEFAULT_SLOT_STEP_DELAY_MS = 250;

type SeriesLikeRequest = LaunchSeriesRequest | LaunchRotationRequest;
type SeriesLikeSummary = LaunchSeriesSummary | LaunchRotationSummary;

function resolveSeriesLikeEnvironmentId(request: SeriesLikeRequest): DeploymentEnvironmentId {
  return request.environmentId;
}

export function resolveSeriesLikeStepDelayMs(request: SeriesLikeRequest): number {
  const environment = resolveDeploymentEnvironment(resolveSeriesLikeEnvironmentId(request));
  return isMainnetDeploymentEnvironment(environment) ? DEFAULT_MAINNET_STEP_DELAY_MS : DEFAULT_SLOT_STEP_DELAY_MS;
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
      worldAddress: gameSummary.worldAddress || game.artifacts.worldAddress,
      createGameTxHash: gameSummary.createGameTxHash || game.artifacts.createGameTxHash,
      configureTxHash: gameSummary.configureTxHash || game.artifacts.configureTxHash,
      lootChestRoleTxHash: gameSummary.lootChestRoleTxHash || game.artifacts.lootChestRoleTxHash,
      villagePassRoleTxHash: gameSummary.villagePassRoleTxHash || game.artifacts.villagePassRoleTxHash,
      createBanksTxHash: gameSummary.createBanksTxHash || game.artifacts.createBanksTxHash,
      paymasterSynced: gameSummary.paymasterSynced ?? game.artifacts.paymasterSynced,
      indexerCreated: gameSummary.indexerCreated || game.artifacts.indexerCreated,
      indexerMode: gameSummary.indexerMode || game.artifacts.indexerMode,
      indexerTier: gameSummary.indexerTier || game.artifacts.indexerTier,
      indexerRequest: gameSummary.indexerRequest || game.artifacts.indexerRequest,
      indexerWorkflowRun: gameSummary.indexerWorkflowRun || game.artifacts.indexerWorkflowRun,
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

function buildSeriesLikeGameRequest(
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
    factoryAddress: summary.factoryAddress,
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    mapConfigOverrides: request.mapConfigOverrides,
    blitzRegistrationOverrides: request.blitzRegistrationOverrides,
    cartridgeApiBase: request.cartridgeApiBase,
    toriiNamespaces: request.toriiNamespaces,
    vrfProviderAddress: request.vrfProviderAddress,
    executionMode: request.executionMode,
    verboseConfigLogs: request.verboseConfigLogs,
    version: request.version,
    maxActions: request.maxActions,
    seriesName: summary.seriesName,
    seriesGameNumber: game.seriesGameNumber,
    waitForFactoryIndexTimeoutMs: request.waitForFactoryIndexTimeoutMs,
    waitForFactoryIndexPollMs: request.waitForFactoryIndexPollMs,
    skipIndexer: request.skipIndexer,
    skipLootChestRoleGrant: request.skipLootChestRoleGrant,
    skipBanks: request.skipBanks,
    dryRun: request.dryRun,
    workflowFile: request.workflowFile,
    ref: request.ref,
  };
}

function shouldSkipSeriesLikeGameStep(game: SeriesLaunchGameSummary, stepId: LaunchSeriesStepId): boolean {
  return game.steps.some((step) => step.id === stepId && step.status === "succeeded");
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
  const { accountAddress, privateKey } = resolveAccountCredentials({
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    fallbackAccountAddress: environment.accountAddress,
    fallbackPrivateKey: environment.privateKey,
    context: `environment "${environment.id}"`,
  });
  const account = new Account({
    provider: new RpcProvider({ nodeUrl: summary.rpcUrl }),
    address: accountAddress,
    signer: privateKey,
  });

  const encodedSeriesName = shortString.encodeShortString(summary.seriesName);
  const receipt = await account.execute({
    contractAddress: summary.factoryAddress,
    entrypoint: "set_series_config",
    calldata: [encodedSeriesName],
  });
  await account.waitForTransaction(receipt.transaction_hash);

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
}: {
  request: SeriesLikeRequest;
  summary: TSummary;
  stepId: Exclude<LaunchSeriesStepId, "create-series">;
  persistSummary: (summary: TSummary) => TSummary;
}): Promise<TSummary> {
  const mappedGameStepId = SERIES_GAME_STEP_BY_GROUPED_STEP[stepId];
  const delayMs = resolveSeriesLikeStepDelayMs(request);
  const nextGames: SeriesLaunchGameSummary[] = [];
  let executedChildren = 0;
  let failureCount = 0;

  for (const game of summary.games) {
    if (shouldSkipSeriesLikeGameStep(game, stepId)) {
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

    try {
      const gameSummary = await runLaunchStep({
        ...buildSeriesLikeGameRequest(request, inFlightSummary, runningGame),
        stepId: mappedGameStepId,
      });
      nextGames[nextGames.length - 1] = updateSeriesLikeGameSuccess(runningGame, stepId, gameSummary);
    } catch (error) {
      failureCount += 1;
      nextGames[nextGames.length - 1] = updateSeriesLikeGameFailure(runningGame, stepId, error);
    }

    persistSummary({
      ...summary,
      games: [...nextGames, ...summary.games.slice(nextGames.length)],
    } as TSummary);
  }

  const nextSummary = persistSummary({
    ...summary,
    games: nextGames,
  } as TSummary);

  if (failureCount > 0) {
    throw new Error(`${failureCount} rotation or series game${failureCount === 1 ? "" : "s"} failed during ${stepId}`);
  }

  return nextSummary;
}
