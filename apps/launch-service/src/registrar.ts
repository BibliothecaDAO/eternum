import { activeShards } from "@realms-world/value-ledger";
import { DurableObject } from "cloudflare:workers";
import { Effect, Layer, Semaphore } from "effect";
import { decodeLaunchEnv } from "./env";
import { launchExecutorLayer, launchTargetOf } from "./executor";
import { processNextLaunch } from "./process-launch";
import { joinLauncherAccount } from "./launcher-account";
import { D1LaunchStore, databaseLayer } from "./store";

/**
 * The registrar: the one object that executes launches, so the deployer account signs one transaction stream at a
 * time. Each alarm runs the next due launch to its end; a launch interrupted by a restart is resumed from chain state
 * on the next alarm, because creation, roster settlement and result batches each check the chain before writing.
 */
export class Registrar extends DurableObject<Record<string, unknown>> {
  private readonly signing = Semaphore.makeUnsafe(1);

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
    return Effect.runPromise(this.signing.withPermit(Effect.promise(() => this.processAlarm())));
  }
  private async processAlarm(): Promise<void> {
    console.log("registrar_alarm", { at: new Date().toISOString() });
    const env = decodeLaunchEnv(this.env);
    let next: number | null = null;
    for (const shard of await activeShards(env.IDENTITY)) {
      const store = new D1LaunchStore(
        env.DB,
        async () => shard.chainId,
        () => activeShards(env.IDENTITY).then((rows) => rows.map((row) => row.chainId)),
      );
      let accountAddress: string;
      try {
        accountAddress = await joinLauncherAccount(env, shard.chainId);
      } catch (error) {
        console.error("launcher_account_unavailable", { chainId: shard.chainId, error: String(error) });
        next = Math.min(next ?? Infinity, Date.now() + 30000);
        continue;
      }
      const target = launchTargetOf(env, accountAddress);
      const services = Layer.mergeAll(databaseLayer(store), launchExecutorLayer(target, env.VALUE_RELAY));
      await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(services)));
      const due = await store.nextDue();
      if (due !== null) next = Math.min(next ?? Infinity, due);
    }
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }
}
