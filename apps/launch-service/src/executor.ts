import { Context, Effect, Layer } from "effect";
import {
  officialChain,
  requireActiveChain,
  readRegisteredShard,
  type ShardDirectory,
} from "@realms-world/value-ledger";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import type { LaunchRun } from "./model";
import { LaunchShard } from "./shard-client";
import type { LaunchServiceStore } from "./store";

interface LaunchTarget {
  directory: ShardDirectory;
  accountAddress: string;
  privateKey: string;
}
interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchServiceStore): Effect.Effect<LaunchGameSummary, LaunchExecutionFailure>;
}
export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}
export const launchTargetOf = (env: LaunchEnv, accountAddress: string): LaunchTarget => ({
  directory: env.IDENTITY,
  accountAddress,
  privateKey: env.LAUNCH_DEPLOYER_PRIVATE_KEY,
});

/** Directory membership owns selection; runtime ABI owns command encoding. */
export const readLaunchShard = async (directory: ShardDirectory, chainId: string) => {
  const shard = await readRegisteredShard(directory, chainId);
  return { shard, world: { world: { address: shard.contracts.games! } } };
};
export const shardChainOf = (env: LaunchEnv, requested?: string | null) => async () => {
  if (requested) return (await requireActiveChain(env.IDENTITY, requested)).chainId;
  return (await officialChain(env.IDENTITY))?.chainId ?? null;
};

export const launchExecutorLayer = (target: LaunchTarget) =>
  Layer.succeed(LaunchExecutor, {
    execute: (run, store) =>
      Effect.tryPromise({
        try: () => executeRun(run, store, target),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
  });
const executeRun = async (
  run: LaunchRun,
  store: LaunchServiceStore,
  target: LaunchTarget,
): Promise<LaunchGameSummary> => {
  await requireActiveChain(target.directory, run.chainId);
  const { shard } = await readLaunchShard(target.directory, run.chainId);
  if (BigInt(run.chainId) !== BigInt(shard.chainId)) throw new Error("queued_launch_shard_changed");
  const native = new LaunchShard({
    rpcUrl: shard.rpcUrl,
    chainId: shard.chainId,
    gamesAddress: shard.contracts.games!,
    accountAddress: target.accountAddress,
    privateKey: target.privateKey,
  });
  return store.saveGame(await native.create(run.request, Date.parse(run.createdAt)));
};
