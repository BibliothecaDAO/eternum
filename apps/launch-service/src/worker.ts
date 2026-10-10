import { activeShards } from "@realms-world/value-ledger";
import { Effect } from "effect";
import { createLaunchApp } from "./app";
import { createIdentityResolver } from "./auth";
import { D1CalendarStore } from "./calendar-store";
import { decodeLaunchEnv, type LaunchEnv } from "./env";
import { shardChainOf } from "./executor";
import { runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";

/**
 * The launch Worker, served under the app's /api beside identity: /api/factory/* for launchers and /api/slots/* for
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
      for (const shard of await activeShards(env.VALUE_IDENTITY)) {
        const { launches, slots, calendar } = launchStoresOf(env, shard.chainId);
        await Effect.runPromise(runLaunchSchedule(launches, slots, calendar, new Date()));
      }
    } finally {
      await registrarOf(env).armFor(Date.now());
    }
  },
};

/** The launch service's stores on one D1, keyed to the chain the shard's /manifest names. */
const launchStoresOf = (env: LaunchEnv, chainId?: string | null) => {
  const launches = new D1LaunchStore(env.DB, shardChainOf(env, chainId), () =>
    activeShards(env.VALUE_IDENTITY).then((rows) => rows.map((row) => row.chainId)),
  );
  return { launches, slots: new D1SlotStore(env.DB, launches), calendar: new D1CalendarStore(env.DB) };
};

const registrarOf = (env: LaunchEnv) => env.REGISTRAR.get(env.REGISTRAR.idFromName("registrar"));

export { Registrar } from "./registrar";

const launchAppOf = (env: LaunchEnv, chainId?: string | null) => {
  const { launches, slots, calendar } = launchStoresOf(env, chainId);
  return createLaunchApp({
    config: {
      allowedOrigins: new Set([new URL(env.BASE_URL).origin]),
      launcherAllowlist: env.launchers,
      operatorToken: env.OPERATOR_TOKEN,
    },
    deployment: { environment: env.ENVIRONMENT, version: env.VERSION.id },
    identity: createIdentityResolver(env.BASE_URL, (url, init) => env.IDENTITY.fetch(url, init)),
    store: launches,
    slots,
    calendar,
    registrar: { armFor: (dueAt) => registrarOf(env).armFor(dueAt) },
    operatorLauncher: {
      enrol: (input) => registrarOf(env).enrol(input),
      check: (input) => registrarOf(env).check(input),
    },
  });
};
