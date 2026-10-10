import { Context, Effect, Layer } from "effect";
import { activeShards, requireActiveChain, readRegisteredShard, type ShardDirectory } from "@realms-world/value-ledger";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import { LaunchShard } from "./shard-client";
import { closedSlotGroups, type BlitzValuePort } from "./paid-blitz";
import { finalizeGame } from "./results";

interface LaunchTarget {
  directory: ShardDirectory & import("@realms-world/value-ledger").RegistrationIdentity;
  accountAddress: string;
  privateKey: string;
}
interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchRunStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
}
export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}
export const launchTargetOf = (env: LaunchEnv): LaunchTarget => ({
  directory: env.VALUE_IDENTITY,
  accountAddress: env.DEPLOYER_ACCOUNT_ADDRESS,
  privateKey: env.DEPLOYER_PRIVATE_KEY,
});

/** Directory membership owns selection; runtime ABI owns command encoding. */
export const readLaunchShard = async (directory: ShardDirectory, chainId: string) => {
  const shard = await readRegisteredShard(directory, chainId);
  return { shard, world: { world: { address: shard.contracts.games! } } };
};
export const shardChainOf = (env: LaunchEnv, requested?: string | null) => async () => {
  if (requested) return (await requireActiveChain(env.VALUE_IDENTITY, requested)).chainId;
  const shards = await activeShards(env.VALUE_IDENTITY);
  if (shards.length !== 1) throw new Error("select_official_shard_chain");
  return shards[0]!.chainId;
};

export const launchExecutorLayer = (target: LaunchTarget, value: BlitzValuePort) =>
  Layer.succeed(LaunchExecutor, {
    execute: (run, store) =>
      Effect.tryPromise({
        try: () => executeRun(run, store, target, value),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
  });
const executeRun = async (
  run: LaunchRun,
  store: LaunchRunStore,
  target: LaunchTarget,
  value: BlitzValuePort,
): Promise<LaunchSummary> => {
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
  if (run.kind === "result" && "gameId" in run.request) return finalizeGame(run.request, native);
  if (run.kind !== "game" || "gameId" in run.request) throw new Error("stored_launch_kind_differs");
  const request = run.request;
  if (request.environment === "madara.blitz") {
    if (!run.slotId || !Number.isInteger(request.groupIndex)) throw new Error("Blitz games require a closed paid slot");
    const { groups } = await closedSlotGroups({ chainId: run.chainId, slotId: run.slotId }, value, target.directory);
    const players = groups[request.groupIndex!];
    if (!players?.length) throw new Error("closed_slot_group_missing");
    const created = await native.create(request, Date.parse(run.createdAt), undefined, players);
    const settlementTransactions = await native.seat(created.gameId!);
    const game = await native.game(created.gameId!);
    const startTime = Number(game.start_main_at);
    return store.saveGame({
      ...created,
      startTime,
      startTimeIso: new Date(startTime * 1000).toISOString(),
      durationSeconds: Number(game.end_at) - startTime,
      finalizeAt: Number(game.end_at),
      settlementTransactions,
    });
  }
  return store.saveGame(await native.create(request, Date.parse(run.createdAt)));
};
