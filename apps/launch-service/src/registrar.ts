import { accountJoinErrors } from "@bibliothecadao/eternum/realms-account";
import { officialChain, readRegisteredShard, serviceFailure, type RegisteredShard } from "@realms-world/value-ledger";
import { DurableObject } from "cloudflare:workers";
import { Effect, Layer, Semaphore } from "effect";
import { decodeLaunchEnv, type LaunchEnv } from "./env";
import { launchExecutorLayer, launchTargetOf } from "./executor";
import { processNextLaunch } from "./process-launch";
import { joinLauncherAccount } from "./launcher-account";
import { advanceGames, openForNewGames, type ReleaseIdentity, type ReleaseReport } from "./release";
import { LaunchShard } from "./shard-client";
import { D1LaunchStore, databaseLayer } from "./store";

export interface JoinFailure {
  chainId: string;
  code: string;
  checkedAt: number;
}
const joinErrors = [
  "launcher_approval_refused",
  "unlisted_shard",
  "directory_shard_manifest_fetch_failed",
  "directory_shard_manifest_unavailable",
  "directory_manifest_chain_differs",
  "invalid_directory_shard_manifest",
  "invalid_directory_shard_rpc",
  "invalid_directory_shard_url",
  ...accountJoinErrors,
];

interface ChainPass {
  next: number | null;
  joinFailure: JoinFailure | null;
}
const IDLE: ChainPass = { next: null, joinFailure: null };
const launcherJoinFailure = (env: LaunchEnv, chainId: string, error: unknown): JoinFailure => {
  const diagnostic = serviceFailure(error, joinErrors, "launcher_join_failed", [
    env.OPERATOR_TOKEN,
    env.LAUNCH_DEPLOYER_PRIVATE_KEY,
  ]);
  const failure = { chainId, code: diagnostic.code, checkedAt: Date.now() };
  console.error("launcher_account_unavailable", { ...failure, ...diagnostic });
  return failure;
};

export class Registrar extends DurableObject<Record<string, unknown>> {
  private readonly signing = Semaphore.makeUnsafe(1);
  private processing = false;

  async wakeAt(): Promise<number | null> {
    return this.processing ? Date.now() : this.ctx.storage.getAlarm();
  }

  async joinFailure(): Promise<JoinFailure | null> {
    return (await this.ctx.storage.get<JoinFailure | null>("joinFailure")) ?? null;
  }

  async armFor(dueAt: number): Promise<void> {
    const alarm = await this.ctx.storage.getAlarm();
    // Written every time, never trusted: an alarm left at a moment that has passed without firing is armed again.
    await this.ctx.storage.setAlarm(alarm === null ? dueAt : Math.min(alarm, dueAt));
  }

  override alarm(): Promise<void> {
    return this.signingAlone(async () => {
      this.processing = true;
      try {
        await this.processAlarm();
      } finally {
        this.processing = false;
      }
    });
  }

  applyRelease(release: ReleaseIdentity | null, shard: RegisteredShard | null): Promise<ReleaseReport> {
    return this.signingAlone(async () => {
      const env = decodeLaunchEnv(this.env);
      if (!shard) return { shard: null };
      if (!release) throw new Error("release_unverified");
      const chainId = shard.chainId;
      const deployed = { shard: async () => shard };
      const store = new D1LaunchStore(env.DB, async () => chainId);
      const herald = await readRegisteredShard(deployed, chainId);
      const launcher = new LaunchShard({
        rpcUrl: herald.rpcUrl,
        chainId: herald.chainId,
        gamesAddress: herald.contracts.games!,
        accountAddress: await joinLauncherAccount(env, deployed, chainId),
        privateKey: env.LAUNCH_DEPLOYER_PRIVATE_KEY,
      });
      const games = await advanceGames(launcher, herald, release, await store.gameNames("madara.frontier"));
      const opened = await openForNewGames(launcher, release);
      return { shard: { chainId, releaseId: release.releaseId, games, opened } };
    });
  }

  private async signingAlone<T>(work: () => Promise<T>): Promise<T> {
    const outcome = await Effect.runPromise(
      this.signing.withPermit(
        Effect.promise(() =>
          work().then(
            (value) => ({ value }),
            (error: unknown) => ({ error }),
          ),
        ),
      ),
    );
    if ("error" in outcome) throw outcome.error;
    return outcome.value;
  }
  private async processAlarm(): Promise<void> {
    console.log("registrar_alarm", { at: new Date().toISOString() });
    const env = decodeLaunchEnv(this.env);
    const official = await officialChain(env.IDENTITY);
    const { next, joinFailure } = official ? await this.advanceChain(env, official.chainId) : IDLE;
    await this.ctx.storage.put("joinFailure", joinFailure);
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }

  private async advanceChain(env: LaunchEnv, chainId: string): Promise<ChainPass> {
    const store = new D1LaunchStore(env.DB, async () => chainId);
    let accountAddress: string;
    try {
      accountAddress = await joinLauncherAccount(env, env.IDENTITY, chainId);
    } catch (error) {
      return { next: Date.now() + 30000, joinFailure: launcherJoinFailure(env, chainId, error) };
    }
    const target = launchTargetOf(env, accountAddress);
    const services = Layer.mergeAll(databaseLayer(store), launchExecutorLayer(target));
    await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(services)));
    return { next: await store.nextDue(), joinFailure: null };
  }
}
