import { accountJoinErrors } from "@bibliothecadao/eternum/realms-account";
import {
  activeShards,
  LAUNCHER_LABEL,
  readRegisteredShard,
  seaterLabels,
  serviceFailure,
} from "@realms-world/value-ledger";
import { DurableObject } from "cloudflare:workers";
import { Effect, Layer, Semaphore } from "effect";
import { decodeLaunchEnv } from "./env";
import { launchExecutorLayer, launchTargetOf } from "./executor";
import { processNextLaunch } from "./process-launch";
import { joinBotAccount } from "./launcher-account";
import { slotResolver } from "./paid-blitz";
import { D1SlotStore, FREEZE_RETRY_MS } from "./slot-store";
import { launchFailure } from "./errors";
import { advanceGames, type ReleaseIdentity, type ReleaseReport, type ShardRelease } from "./release";
import { LaunchShard } from "./shard-client";
import { D1LaunchStore, databaseLayer } from "./store";

export interface JoinFailure {
  chainId: string;
  code: string;
  checkedAt: number;
}
const joinErrors = [
  "launcher_approval_refused",
  "launcher_shard_inactive",
  "unlisted_shard",
  "directory_shard_manifest_fetch_failed",
  "directory_shard_manifest_unavailable",
  "directory_manifest_chain_differs",
  "invalid_directory_shard_manifest",
  "invalid_directory_shard_rpc",
  "invalid_directory_shard_url",
  ...accountJoinErrors,
];

/**
 * The registrar: the one object that executes launches, so the launcher signs one transaction stream at a time and each
 * seater its own. Each alarm first freezes every slot whose registration has closed, then runs the next due launch to
 * its end, from the same read of the ledger the freeze made. It wakes at the next due freeze (a slot's close, or the
 * retry of a failed one) as well as the next due run. A launch interrupted by a restart is resumed from chain state on
 * the next alarm, because creation, roster settlement and result batches each check the chain before writing.
 */
export class Registrar extends DurableObject<Record<string, unknown>> {
  private readonly signing = Semaphore.makeUnsafe(1);
  private processing = false;

  async wakeAt(): Promise<number | null> {
    return this.processing ? Date.now() : this.ctx.storage.getAlarm();
  }

  async joinFailures(): Promise<JoinFailure[]> {
    return (await this.ctx.storage.get<JoinFailure[]>("joinFailures")) ?? [];
  }

  /**
   * Arms the alarm for a run due at `dueAt`. Every path that queues a run calls this, so the alarm is always the
   * earliest due run, whoever queued it: a ready run never waits behind a result sleeping until its game's end.
   */
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

  /**
   * Advances every active shard's running Frontier games to the deployed commit's release, as the launcher, between
   * launches: the deployment's release step, after the box half registered the release and Herald published it.
   */
  applyRelease(release: ReleaseIdentity | null): Promise<ReleaseReport> {
    return this.signingAlone(async () => {
      const env = decodeLaunchEnv(this.env);
      const shards: ShardRelease[] = [];
      for (const { chainId } of await activeShards(env.IDENTITY)) {
        if (!release) throw new Error("release_unverified");
        const store = new D1LaunchStore(
          env.DB,
          async () => chainId,
          () => activeShards(env.IDENTITY).then((rows) => rows.map((row) => row.chainId)),
        );
        const herald = await readRegisteredShard(env.IDENTITY, chainId);
        const launcher = new LaunchShard({
          rpcUrl: herald.rpcUrl,
          chainId: herald.chainId,
          gamesAddress: herald.contracts.games!,
          accountAddress: await joinBotAccount(env, chainId, LAUNCHER_LABEL),
          privateKey: env.LAUNCH_DEPLOYER_PRIVATE_KEY,
        });
        const games = await advanceGames(launcher, herald, release, await store.gameNames("madara.frontier"));
        shards.push({ chainId, releaseId: release.releaseId, games });
      }
      return { shards };
    });
  }

  /** The launcher and the seaters sign one transaction stream at a time: launches and release steps never overlap. */
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
    let next: number | null = null;
    const failures: JoinFailure[] = [];
    for (const shard of await activeShards(env.IDENTITY)) {
      const store = new D1LaunchStore(
        env.DB,
        async () => shard.chainId,
        () => activeShards(env.IDENTITY).then((rows) => rows.map((row) => row.chainId)),
      );
      const resolveSlot = slotResolver(env.VALUE_RELAY, env.IDENTITY);
      const slots = new D1SlotStore(env.DB, store, env.VALUE_RELAY, resolveSlot);
      const freeze = await this.freezeClosedSlots(slots);
      if (freeze !== null) next = Math.min(next ?? Infinity, freeze);
      let accountAddress: string;
      try {
        accountAddress = await joinBotAccount(env, shard.chainId, LAUNCHER_LABEL);
      } catch (error) {
        const diagnostic = serviceFailure(error, joinErrors, "launcher_join_failed", [
          env.OPERATOR_TOKEN,
          env.LAUNCH_DEPLOYER_PRIVATE_KEY,
        ]);
        const failure = {
          chainId: shard.chainId,
          code: diagnostic.code,
          checkedAt: Date.now(),
        };
        failures.push(failure);
        await this.ctx.storage.put("joinFailures", failures);
        console.error("launcher_account_unavailable", { ...failure, ...diagnostic });
        next = Math.min(next ?? Infinity, Date.now() + 30000);
        continue;
      }
      const seaters = () => Promise.all(seaterLabels.map((label) => joinBotAccount(env, shard.chainId, label)));
      const target = launchTargetOf(env, accountAddress, seaters);
      const services = Layer.mergeAll(databaseLayer(store), launchExecutorLayer(target, resolveSlot));
      await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(services)));
      const due = await store.nextDue();
      if (due !== null) next = Math.min(next ?? Infinity, due);
    }
    await this.ctx.storage.put("joinFailures", failures);
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }

  /**
   * Freezes every closed slot and returns when the next freeze is due. Each slot's freeze records its own failure and
   * its retry; a pass that cannot reach its database is retried as a whole, and the launches still run meanwhile.
   */
  private async freezeClosedSlots(slots: D1SlotStore): Promise<number | null> {
    try {
      await slots.freezeDueSlots();
      return await slots.nextFreeze();
    } catch (error) {
      console.error("slot_freeze_unavailable", launchFailure(error));
      return Date.now() + FREEZE_RETRY_MS;
    }
  }
}
