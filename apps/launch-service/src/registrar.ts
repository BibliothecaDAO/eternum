import { DurableObject } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { decodeLaunchEnv } from "./env";
import { launchExecutorLayer, launchTargetOf, shardChainOf } from "./executor";
import { processNextLaunch } from "./process-launch";
import { D1LaunchStore, databaseLayer } from "./store";

/**
 * The registrar: the one object that executes launches, so the deployer account signs one transaction stream at a
 * time. Each alarm runs the next due launch to its end; a launch interrupted by a restart is resumed from chain state
 * on the next alarm, because creation, roster settlement and result batches each check the chain before writing.
 */
export class Registrar extends DurableObject<Record<string, unknown>> {
  /**
   * Arms the alarm for a run due at `dueAt`. Every path that queues a run calls this, so the alarm is always the
   * earliest due run, whoever queued it: a ready run never waits behind a result sleeping until its game's end.
   */
  async armFor(dueAt: number): Promise<void> {
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > dueAt) await this.ctx.storage.setAlarm(dueAt);
  }

  override async alarm(): Promise<void> {
    const env = decodeLaunchEnv(this.env);
    const store = new D1LaunchStore(env.DB, shardChainOf(env));
    const services = Layer.mergeAll(databaseLayer(store), launchExecutorLayer(launchTargetOf(env)));
    await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(services)));
    const next = await store.nextDue();
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }
}
