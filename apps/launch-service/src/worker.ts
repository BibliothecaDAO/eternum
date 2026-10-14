import { WorkerEntrypoint } from "cloudflare:workers";
import { activeShards } from "@realms-world/value-ledger";
import { Effect } from "effect";
import { createLaunchApp } from "./app";
import { D1CalendarStore } from "./calendar-store";
import { decodeLaunchEnv, type LaunchEnv } from "./env";
import { shardChainOf } from "./executor";
import { runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";

/**
 * The launch Worker, served under the app's /api beside identity: /api/factory/* for operators and /api/slots/* for
 * players. Its cron tick follows the season calendar: it creates the Frontier season game at its start and the next
 * Blitz slot inside the Blitz window, freezes closed slots, and wakes the registrar that executes launches.
 */
export default {
  fetch(request: Request, rawEnv: Record<string, unknown>): Response | Promise<Response> {
    return launchAppOf(decodeLaunchEnv(rawEnv), new URL(request.url).searchParams.get("chainId")).fetch(request);
  },
  async scheduled(_controller: ScheduledController, rawEnv: Record<string, unknown>): Promise<void> {
    const env = decodeLaunchEnv(rawEnv);
    try {
      for (const shard of await activeShards(env.IDENTITY)) {
        const { launches, slots, calendar } = launchStoresOf(env, shard.chainId);
        await Effect.runPromise(runLaunchSchedule(launches, slots, calendar));
      }
    } finally {
      await registrarOf(env).armFor(Date.now());
    }
  },
};

/** The launch service's stores on one D1, keyed to the chain the shard's /manifest names. */
const launchStoresOf = (env: LaunchEnv, chainId?: string | null) => {
  const launches = new D1LaunchStore(env.DB, shardChainOf(env, chainId), () =>
    activeShards(env.IDENTITY).then((rows) => rows.map((row) => row.chainId)),
  );
  return {
    launches,
    slots: new D1SlotStore(env.DB, launches, env.VALUE_RELAY, env.IDENTITY),
    calendar: new D1CalendarStore(env.DB),
  };
};

const registrarOf = (env: LaunchEnv) => env.REGISTRAR.get(env.REGISTRAR.idFromName("registrar"));

export { Registrar } from "./registrar";

const launchAppOf = (env: LaunchEnv, chainId?: string | null) => {
  const { launches, slots, calendar } = launchStoresOf(env, chainId);
  return createLaunchApp({
    config: {
      operatorToken: env.OPERATOR_TOKEN,
    },
    deployment: { environment: env.ENVIRONMENT, version: env.VERSION.id },
    store: launches,
    slots,
    calendar,
    registrar: {
      armFor: (dueAt) => registrarOf(env).armFor(dueAt),
      joinFailures: () => registrarOf(env).joinFailures(),
      wakeAt: () => registrarOf(env).wakeAt(),
    },
  });
};

/** Private immutable game-to-slot metadata; player ownership is read from the ledger and shard. */
export class ValueLaunchDirectory extends WorkerEntrypoint<Record<string, unknown>> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  rosterCohorts() {
    return launchStoresOf(decodeLaunchEnv(this.env)).launches.rosterCohorts();
  }
  directoryGames() {
    return launchStoresOf(decodeLaunchEnv(this.env)).launches.playerDirectoryGames();
  }
}
