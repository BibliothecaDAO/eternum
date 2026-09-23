import { finalizeGame } from "./results";
import { Context, Effect, Layer } from "effect";
import { shardChainId } from "@realms-world/chain/chain-guard";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchGameRequest } from "../../../config/deployer/clean/types";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import type { CreateGameRequest } from "./schemas";

/** The shard a launch writes to and the registrar key it writes with. */
interface LaunchTarget {
  rpcUrl: string;
  admissionUrl: string;
  heraldUrl: string;
  manifestUrl: string;
  accountAddress: string;
  privateKey: string;
}

interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchRunStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
}

export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}

export const launchTargetOf = (env: LaunchEnv): LaunchTarget => ({
  rpcUrl: env.RPC_URL,
  admissionUrl: env.ADMISSION_URL,
  heraldUrl: env.HERALD_URL,
  manifestUrl: env.NATIVE_WORLD_MANIFEST_URL,
  accountAddress: env.DEPLOYER_ACCOUNT_ADDRESS,
  privateKey: env.DEPLOYER_PRIVATE_KEY,
});

/** The shard's deployment document, read at each use so a redeployed world needs no Worker redeploy. */
export const loadWorldManifest = async (manifestUrl: string): Promise<NativeWorldManifest> => {
  const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`World manifest ${manifestUrl} answered ${response.status}`);
  const manifest = (await response.json()) as NativeWorldManifest;
  shardChainId(manifest);
  return manifest;
};

const requirePersistedStartTime = (request: CreateGameRequest): string => {
  if (!request.gameStartTime) throw new Error(`Launch request for ${request.gameName} has no persisted start time`);
  return request.gameStartTime;
};

const buildGameRequest = (
  request: CreateGameRequest,
  target: LaunchTarget,
  manifest: NativeWorldManifest,
): LaunchGameRequest => ({
  manifest,
  heraldUrl: target.heraldUrl,
  admissionUrl: target.admissionUrl,
  rpcUrl: target.rpcUrl,
  accountAddress: target.accountAddress,
  privateKey: target.privateKey,
  environmentId: request.environment,
  version: request.version,
  devModeOn: request.devModeOn,
  singleRealmMode: request.singleRealmMode,
  durationSeconds: request.durationSeconds,
  mapConfigOverrides: request.mapConfigOverrides,
  biomeClimateOverrides: request.biomeClimateOverrides,
  blitzRegistrationOverrides: request.blitzRegistrationOverrides,
  launchKind: "game",
  gameName: request.gameName,
  rosterOwners: request.rosterOwners,
  startTime: requirePersistedStartTime(request),
});

const executeRun = async (run: LaunchRun, store: LaunchRunStore, target: LaunchTarget): Promise<LaunchSummary> => {
  const manifest = await loadWorldManifest(target.manifestUrl);
  if (run.kind === "game" && !("gameId" in run.request)) {
    return launchGame(buildGameRequest(run.request, target, manifest), store);
  }
  if (run.kind === "result" && "gameId" in run.request) {
    return finalizeGame(
      run.request,
      { url: target.rpcUrl, admissionUrl: target.admissionUrl },
      { manifest, accountAddress: target.accountAddress, privateKey: target.privateKey },
    );
  }
  throw new Error(`Stored request does not match ${run.kind} launch ${run.id}`);
};

export const launchExecutorLayer = (target: LaunchTarget) =>
  Layer.succeed(LaunchExecutor, {
    execute: (run, store) =>
      Effect.tryPromise({
        try: () => executeRun(run, store, target),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
  });
