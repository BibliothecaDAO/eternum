import { Context, Effect, Layer } from "effect";
import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchEnv } from "./env";
import { LaunchExecutionFailure } from "./errors";
import type { LaunchRun, LaunchSummary } from "./model";
import { LaunchShard } from "./shard-client";
import { launchPaidBlitz, type BlitzValuePort } from "./paid-blitz";
import type { BlitzRegistrationSource, D1BlitzRosterStore } from "./blitz-roster";
import { finalizeGame } from "./results";

interface LaunchTarget {
  shardUrl: string;
  accountAddress: string;
  privateKey: string;
}
interface LaunchExecutorService {
  execute(run: LaunchRun, store: LaunchRunStore): Effect.Effect<LaunchSummary, LaunchExecutionFailure>;
  refund(run: LaunchRun): Effect.Effect<number | null, LaunchExecutionFailure>;
}
export class LaunchExecutor extends Context.Service<LaunchExecutor, LaunchExecutorService>()("launch/LaunchExecutor") {}
export const launchTargetOf = (env: LaunchEnv): LaunchTarget => ({
  shardUrl: env.SHARD_URL,
  accountAddress: env.DEPLOYER_ACCOUNT_ADDRESS,
  privateKey: env.DEPLOYER_PRIVATE_KEY,
});

/** Runtime ABI is authoritative; a bundled pre-integration schema must not gate a newly built shard. */
export const readLaunchShard = async (shardUrl: string) => {
  const response = await fetch(new URL("/manifest", shardUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("launch_manifest_unavailable");
  const manifest = (await response.json()) as ShardManifest;
  if (
    manifest.version !== 1 ||
    !/^0x[0-9a-f]+$/i.test(manifest.chainId) ||
    !/^0x[0-9a-f]+$/i.test(manifest.contracts?.games ?? "") ||
    !/^0x[0-9a-f]+$/i.test(manifest.accountClassHash) ||
    !/^0x[0-9a-f]+$/i.test(manifest.guardianPublicKey)
  )
    throw new Error("invalid_launch_manifest");
  return { shard: { ...manifest, url: shardUrl }, world: { world: { address: manifest.contracts.games! } } };
};
export const shardChainOf = (env: LaunchEnv) => async () => (await readLaunchShard(env.SHARD_URL)).shard.chainId;

export const launchExecutorLayer = (
  target: LaunchTarget,
  value: BlitzValuePort,
  source: BlitzRegistrationSource,
  rosters: D1BlitzRosterStore,
) =>
  Layer.succeed(LaunchExecutor, {
    execute: (run, store) =>
      Effect.tryPromise({
        try: () => executeRun(run, store, target, value, source, rosters),
        catch: (cause) => new LaunchExecutionFailure({ runId: run.id, cause }),
      }),
    refund: (run) =>
      Effect.tryPromise({
        try: () =>
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
  store: LaunchRunStore,
  target: LaunchTarget,
  value: BlitzValuePort,
  source: BlitzRegistrationSource,
  rosters: D1BlitzRosterStore,
): Promise<LaunchSummary> => {
  const { shard } = await readLaunchShard(target.shardUrl);
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
      run.name,
      {
        create: () => native.create(request, Date.parse(run.createdAt)),
        install: (gameId, players) => native.installRoster(gameId, players),
        seat: (gameId) => native.seat(gameId),
        window: async (gameId) => {
          const game = await native.game(gameId);
          return { start: Number(game.start_main_at), end: Number(game.end_at) };
        },
      },
      value,
      source,
      rosters,
      store,
      Date.parse(request.gameStartTime!) / 1000,
    );
  return store.saveGame(await native.create(request, Date.parse(run.createdAt)));
};
