import { Context, Effect, Layer } from "effect";
import { activeShards, requireActiveChain, readRegisteredShard, type ShardDirectory } from "@realms-world/value-ledger";
import type { LaunchEntryStore } from "./entry";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import { LaunchShard } from "./shard-client";
import { launchPaidBlitz, type BlitzValuePort } from "./paid-blitz";
import { finalizeGame } from "./results";

interface LaunchTarget {
  directory: ShardDirectory;
  accountAddress: string;
  privateKey: string;
}
interface LaunchExecutorService {
  deadline(run: LaunchRun): Effect.Effect<number, LaunchExecutionFailure>;
  execute(run: LaunchRun, store: LaunchEntryStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
  refund(run: LaunchRun): Effect.Effect<number | null, LaunchExecutionFailure>;
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
    deadline: (run) =>
      Effect.tryPromise({
        try: () => {
          if (run.entry?.kind !== "paid") throw new Error("paid_launch_entry_missing");
          return value.blitzDeadline({ chainId: run.entry.ledger.shard, gameId: run.entry.ledger.gameId });
        },
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
    execute: (run, store) =>
      Effect.tryPromise({
        try: () => executeRun(run, store, target, value),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
    refund: (run) =>
      Effect.tryPromise({
        try: () =>
          run.kind === "game" &&
          run.environment === "madara.blitz" &&
          ("gameId" in run.request || (run.summary && "gameId" in run.summary && run.summary.gameId))
            ? value.refundBlitz({
                chainId: run.chainId,
                gameId: "gameId" in run.request ? run.request.gameId : run.summary!.gameId!,
              })
            : Promise.resolve(null),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
  });
const executeRun = async (
  run: LaunchRun,
  store: LaunchEntryStore,
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
  if (request.environment === "madara.blitz")
    return launchPaidBlitz(
      run.chainId,
      {
        create: () => native.create(request, Date.parse(run.createdAt)),
        roster: (gameId) => native.roster(gameId),
        install: (gameId, players) => native.installRoster(gameId, players),
        seat: (gameId) => native.seat(gameId),
        window: async (gameId) => {
          const game = await native.game(gameId);
          return { start: Number(game.start_main_at), end: Number(game.end_at) };
        },
      },
      value,
      store,
      Date.parse(request.gameStartTime!) / 1000,
    );
  return store.saveGame(await native.create(request, Date.parse(run.createdAt)));
};
