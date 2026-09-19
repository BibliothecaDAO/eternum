import { finalizeGame } from "./results";
import { Context, Effect, Layer } from "effect";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchGameRequest } from "../../../config/deployer/clean/types";
import type { LaunchServiceConfig } from "./config";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import type { CreateGameRequest } from "./schemas";

interface RpcTarget {
  url: string;
  admissionUrl: string;
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

const sharedRequest = (request: CreateGameRequest, rpc: RpcTarget, registrar: RegistrarCredentials) => ({
  environmentId: request.environment,
  rpcUrl: rpc.url,
  accountAddress: registrar.accountAddress,
  privateKey: registrar.privateKey,
  version: request.version,
  devModeOn: request.devModeOn,
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
  admissionUrl: rpc.admissionUrl,
  gameName: request.gameName,
  rosterOwners: request.rosterOwners,
  startTime: requirePersistedStartTime(request),
});

const executeRun = async (
  run: LaunchRun,
  store: LaunchRunStore,
  rpc: RpcTarget,
  herald: HeraldTarget,
  registrar: RegistrarCredentials,
): Promise<LaunchSummary> => {
  // Safe to set process-wide: the DB single-writer index keeps exactly one run executing at a time.
  process.env.HERALD_URL = herald.url;
  process.env.NATIVE_WORLD_MANIFEST = registrar.manifestPath;

  if (run.kind === "game" && !("gameId" in run.request)) {
    return launchGame(buildGameRequest(run.request, rpc, registrar), store);
  }
  if (run.kind === "result" && "gameId" in run.request) {
    return finalizeGame(run.request, rpc, registrar);
  }
  throw new Error(`Stored request does not match ${run.kind} launch ${run.id}`);
};

export const launchTargetLayers = (config: LaunchServiceConfig) =>
  Layer.mergeAll(
    Layer.succeed(LaunchRpc, { url: config.rpcUrl, admissionUrl: config.admissionUrl }),
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
