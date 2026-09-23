import { finalizeGame } from "./results";
import { Context, Effect, Layer } from "effect";
import { openShard, type Shard } from "@bibliothecadao/eternum/shard";
import { launchGame } from "../../../config/deployer/clean/launch/runner";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchGameRequest } from "../../../config/deployer/clean/types";
import { registrarWorldOf } from "../../../config/deployer/clean/world/native/manifest";
import type { RegistrarWorld } from "../../../config/deployer/clean/world/native/types";
import type { NativeSchema } from "../../../apps/herald/src/native/schema";
import schema from "../../../contracts/l3/world-native/schema/schema.json";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import type { CreateGameRequest } from "./schemas";

/** The shard a launch writes to and the registrar key it writes with. */
interface LaunchTarget {
  shardUrl: string;
  accountAddress: string;
  privateKey: string;
}

interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchRunStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
}

export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}

export const launchTargetOf = (env: LaunchEnv): LaunchTarget => ({
  shardUrl: env.SHARD_URL,
  accountAddress: env.DEPLOYER_ACCOUNT_ADDRESS,
  privateKey: env.DEPLOYER_PRIVATE_KEY,
});

const RELEASE_SCHEMA = schema as unknown as NativeSchema;

/**
 * The shard as its Herald's /manifest describes it, read at each use so a redeployed world needs no Worker redeploy.
 * The ABIs are the ones this release was built with; a shard running another release is refused.
 */
export const readLaunchShard = async (shardUrl: string): Promise<{ shard: Shard; world: RegistrarWorld }> => {
  const shard = await openShard(shardUrl, RELEASE_SCHEMA.identity);
  return { shard, world: registrarWorldOf(shard, RELEASE_SCHEMA) };
};

const requirePersistedStartTime = (request: CreateGameRequest): string => {
  if (!request.gameStartTime) throw new Error(`Launch request for ${request.gameName} has no persisted start time`);
  return request.gameStartTime;
};

const buildGameRequest = (
  request: CreateGameRequest,
  target: LaunchTarget,
  { shard, world }: Awaited<ReturnType<typeof readLaunchShard>>,
): LaunchGameRequest => ({
  manifest: world,
  heraldUrl: shard.url,
  admissionUrl: shard.admissionUrl,
  rpcUrl: shard.rpcUrl,
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
  const launchShard = await readLaunchShard(target.shardUrl);
  if (run.kind === "game" && !("gameId" in run.request)) {
    return launchGame(buildGameRequest(run.request, target, launchShard), store);
  }
  if (run.kind === "result" && "gameId" in run.request) {
    return finalizeGame(
      run.request,
      { url: launchShard.shard.rpcUrl, admissionUrl: launchShard.shard.admissionUrl },
      { manifest: launchShard.world, accountAddress: target.accountAddress, privateKey: target.privateKey },
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
