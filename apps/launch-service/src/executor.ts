import { Context, Effect, Layer } from "effect";
import { activeShards, requireActiveChain, readRegisteredShard, type ShardDirectory } from "@realms-world/value-ledger";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import { LaunchShard, type BlitzLaunch } from "./shard-client";
import type { LaunchServiceStore } from "./store";
import { closedSlotGroups, type BlitzValuePort } from "./paid-blitz";
import { finalizeGame } from "./results";
import type { CreateGameRequest } from "./schemas";
import { testBlitzRoster } from "./test-blitz";

interface LaunchTarget {
  directory: ShardDirectory & import("@realms-world/value-ledger").RegistrationIdentity;
  accountAddress: string;
  privateKey: string;
}
interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchServiceStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
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
  const shards = await activeShards(env.IDENTITY);
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
  store: LaunchServiceStore,
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
  if (request.environment === "madara.blitz") return launchBlitz(run, store, target, value, native);
  return store.saveGame(await native.create(request, Date.parse(run.createdAt)));
};

/**
 * A Blitz launches its whole slot in one run, whichever of the slot's game runs the registrar picked: the run that
 * executes returns its own summary, and every other game of the slot completes beside it. A test Blitz is a slot of one.
 */
const launchBlitz = async (
  run: LaunchRun,
  store: LaunchServiceStore,
  target: LaunchTarget,
  value: BlitzValuePort,
  native: LaunchShard,
): Promise<LaunchSummary> => {
  const games = await blitzGamesOf(run, store, target, value);
  const summaries = await native.launchBlitz(games.map(({ launch }) => launch));
  const others = games.flatMap(({ runId }, index) => (runId === run.id ? [] : [{ runId, summary: summaries[index]! }]));
  await store.completeGames(others);
  return summaries[games.findIndex(({ runId }) => runId === run.id)]!;
};

/**
 * The games a Blitz run launches, each with its frozen roster. A paid slot's groups are re-resolved from the ledger
 * once per run, never copied; a test game names its own roster.
 */
const blitzGamesOf = async (
  run: LaunchRun,
  store: LaunchServiceStore,
  target: LaunchTarget,
  value: BlitzValuePort,
): Promise<{ runId: string; launch: BlitzLaunch }[]> => {
  const launchOf = (game: LaunchRun, players: BlitzLaunch["players"]) => ({
    runId: game.id,
    launch: { request: game.request as CreateGameRequest, players, createdAt: Date.parse(game.createdAt) },
  });
  if (run.slotId === null) return [launchOf(run, testBlitzRoster(run.request as CreateGameRequest, run.chainId))];
  const { groups } = await closedSlotGroups({ chainId: run.chainId, slotId: run.slotId }, value, target.directory);
  return (await store.slotGames(run.slotId)).map((game) => {
    const groupIndex = (game.request as CreateGameRequest).groupIndex;
    if (!Number.isInteger(groupIndex)) throw new Error("Blitz games require a closed paid slot");
    const players = groups[groupIndex!];
    if (!players?.length) throw new Error("closed_slot_group_missing");
    return launchOf(game, players);
  });
};
