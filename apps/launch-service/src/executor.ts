import { Context, Effect, Layer } from "effect";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import { launchRotation } from "../../../config/deployer/clean/launch/rotation-runner";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import { launchSeries } from "../../../config/deployer/clean/launch/series-runner";
import type {
  LaunchGameRequest,
  LaunchRotationRequest,
  LaunchSeriesRequest,
} from "../../../config/deployer/clean/types";
import type { LaunchServiceConfig } from "./config";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import type { CreateGameRequest, CreateRotationRequest, CreateSeriesRequest } from "./schemas";

interface RpcTarget {
  url: string;
}

interface HeraldTarget {
  url: string;
}

interface RegistrarCredentials {
  accountAddress: string;
  privateKey: string;
  manifestPath: string;
}

class LaunchRpc extends Context.Service<LaunchRpc, RpcTarget>()("launch/LaunchRpc") {}
class LaunchHerald extends Context.Service<LaunchHerald, HeraldTarget>()("launch/LaunchHerald") {}
class LaunchRegistrar extends Context.Service<LaunchRegistrar, RegistrarCredentials>()("launch/LaunchRegistrar") {}

interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchRunStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
}

export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}

const requirePersistedStartTime = (request: CreateGameRequest): string => {
  if (!request.gameStartTime) throw new Error(`Launch request for ${request.gameName} has no persisted start time`);
  return request.gameStartTime;
};

const sharedRequest = (
  request: CreateGameRequest | CreateSeriesRequest | CreateRotationRequest,
  rpc: RpcTarget,
  registrar: RegistrarCredentials,
) => ({
  environmentId: request.environment,
  rpcUrl: rpc.url,
  accountAddress: registrar.accountAddress,
  privateKey: registrar.privateKey,
  version: request.version ?? "6",
  devModeOn: request.devModeOn ?? true,
  twoPlayerMode: request.twoPlayerMode,
  singleRealmMode: request.singleRealmMode,
  durationSeconds: request.durationSeconds,
  mapConfigOverrides: request.mapConfigOverrides,
  biomeClimateOverrides: request.biomeClimateOverrides,
  blitzRegistrationOverrides: request.blitzRegistrationOverrides,
});

const buildGameRequest = (
  request: CreateGameRequest,
  rpc: RpcTarget,
  registrar: RegistrarCredentials,
): LaunchGameRequest => ({
  ...sharedRequest(request, rpc, registrar),
  launchKind: "game",
  gameName: request.gameName,
  startTime: requirePersistedStartTime(request),
});

const buildSeriesRequest = (
  request: CreateSeriesRequest,
  rpc: RpcTarget,
  registrar: RegistrarCredentials,
): LaunchSeriesRequest => ({
  ...sharedRequest(request, rpc, registrar),
  launchKind: "series",
  seriesName: request.seriesName,
  games: request.games.map((game) => ({ ...game })),
  autoRetryEnabled: true,
  autoRetryIntervalMinutes: request.autoRetryIntervalMinutes,
});

const buildRotationRequest = (
  request: CreateRotationRequest,
  rpc: RpcTarget,
  registrar: RegistrarCredentials,
): LaunchRotationRequest => ({
  ...sharedRequest(request, rpc, registrar),
  launchKind: "rotation",
  rotationName: request.rotationName,
  firstGameStartTime: request.firstGameStartTime,
  gameIntervalMinutes: request.gameIntervalMinutes,
  maxGames: request.maxGames,
  advanceWindowGames: request.advanceWindowGames,
  evaluationIntervalMinutes: request.evaluationIntervalMinutes,
  weeklyCadence: request.weeklyCadence?.map((entry) => ({ ...entry })),
  biomeClimateOverridesByGameNumber: request.biomeClimateOverridesByGameNumber,
  autoRetryEnabled: true,
  autoRetryIntervalMinutes: request.autoRetryIntervalMinutes,
});

const executeRun = async (
  run: LaunchRun,
  store: LaunchRunStore,
  rpc: RpcTarget,
  herald: HeraldTarget,
  registrar: RegistrarCredentials,
): Promise<LaunchSummary> => {
  process.env.HERALD_URL = herald.url;
  process.env.GAME_MANIFEST_PATH = registrar.manifestPath;

  if (run.kind === "game" && "gameName" in run.request) {
    return launchGame(buildGameRequest(run.request, rpc, registrar), store);
  }
  if (run.kind === "series" && "seriesName" in run.request) {
    return launchSeries(buildSeriesRequest(run.request, rpc, registrar), store);
  }
  if (run.kind === "rotation" && "rotationName" in run.request) {
    return launchRotation(buildRotationRequest(run.request, rpc, registrar), store);
  }
  throw new Error(`Stored request does not match ${run.kind} launch ${run.id}`);
};

export const launchTargetLayers = (config: LaunchServiceConfig) =>
  Layer.mergeAll(
    Layer.succeed(LaunchRpc, { url: config.rpcUrl }),
    Layer.succeed(LaunchHerald, { url: config.heraldUrl }),
    Layer.succeed(LaunchRegistrar, {
      accountAddress: config.accountAddress,
      privateKey: config.privateKey,
      manifestPath: config.manifestPath,
    }),
  );

export const LaunchExecutorLive = Layer.effect(
  LaunchExecutor,
  Effect.gen(function* () {
    const rpc = yield* LaunchRpc;
    const herald = yield* LaunchHerald;
    const registrar = yield* LaunchRegistrar;
    return {
      execute: (run, store) =>
        Effect.tryPromise({
          try: () => executeRun(run, store, rpc, herald, registrar),
          catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
        }),
    };
  }),
);
