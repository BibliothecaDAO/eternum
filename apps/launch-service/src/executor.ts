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
import { LaunchShard, type BlitzLaunch } from "./shard-client";
import type { LaunchServiceStore } from "./store";
import type { SlotResolver } from "./paid-blitz";

interface LaunchTarget {
  directory: ShardDirectory & import("@realms-world/value-ledger").RegistrationIdentity;
  accountAddress: string;
  privateKey: string;
  /** Joins the seater pool, the accounts Blitz games name to seat them, and returns their addresses in pool order. */
  seaters(): Promise<string[]>;
}
interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchServiceStore): Effect.Effect<LaunchGameSummary, LaunchExecutionFailure>;
}
export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}
export const launchTargetOf = (
  env: LaunchEnv,
  accountAddress: string,
  seaters: () => Promise<string[]>,
): LaunchTarget => ({
  directory: env.IDENTITY,
  accountAddress,
  privateKey: env.LAUNCH_DEPLOYER_PRIVATE_KEY,
  seaters,
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

export const launchExecutorLayer = (target: LaunchTarget, resolveSlot: SlotResolver) =>
  Layer.succeed(LaunchExecutor, {
    execute: (run, store) =>
      Effect.tryPromise({
        try: () => executeRun(run, store, target, resolveSlot),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
  });
const executeRun = async (
  run: LaunchRun,
  store: LaunchServiceStore,
  target: LaunchTarget,
  resolveSlot: SlotResolver,
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
  if (run.request.environment === "madara.blitz") return launchBlitz(run, store, target, resolveSlot, native);
  return store.saveGame(await native.create(run.request, Date.parse(run.createdAt)));
};

/**
 * A Blitz launches its whole slot in one run, whichever of the slot's game runs the registrar picked: the run that
 * executes returns its own summary, and every other game of the slot completes beside it. A test Blitz is a slot of one.
 */
const launchBlitz = async (
  run: LaunchRun,
  store: LaunchServiceStore,
  target: LaunchTarget,
  resolveSlot: SlotResolver,
  native: LaunchShard,
): Promise<LaunchGameSummary> => {
  const games = await blitzGamesOf(run, store, resolveSlot, target.seaters);
  const summaries = await native.launchBlitz(games.map(({ launch }) => launch));
  const others = games.flatMap(({ runId }, index) => (runId === run.id ? [] : [{ runId, summary: summaries[index]! }]));
  await store.completeGames(others);
  return summaries[games.findIndex(({ runId }) => runId === run.id)]!;
};

const blitzGamesOf = async (
  run: LaunchRun,
  store: LaunchServiceStore,
  resolveSlot: SlotResolver,
  joinSeaters: () => Promise<string[]>,
): Promise<{ runId: string; launch: BlitzLaunch }[]> => {
  const rosters = await blitzRostersOf(run, store, resolveSlot);
  const seaters = await joinSeaters();
  return rosters.map(({ game, players, groupIndex }) => ({
    runId: game.id,
    launch: {
      request: game.request,
      players,
      createdAt: Date.parse(game.createdAt),
      seater: seaters[groupIndex % seaters.length]!,
    },
  }));
};

const blitzRostersOf = async (run: LaunchRun, store: LaunchServiceStore, resolveSlot: SlotResolver) => {
  if (run.slotId === null) throw new Error("Blitz games require a closed paid slot");
  const { groups } = await resolveSlot({ chainId: run.chainId, slotId: run.slotId });
  return (await store.slotGames(run.slotId)).map((game) => {
    const groupIndex = game.request.groupIndex;
    if (!Number.isInteger(groupIndex)) throw new Error("Blitz games require a closed paid slot");
    const players = groups[groupIndex!];
    if (!players?.length) throw new Error("closed_slot_group_missing");
    return { game, players, groupIndex: groupIndex! };
  });
};
