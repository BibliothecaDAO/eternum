import { Effect } from "effect";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { createLaunchApp } from "./app";
import { createIdentityResolver } from "./auth";
import { D1CalendarStore } from "./calendar-store";
import { decodeLaunchEnv, type LaunchEnv } from "./env";
import { readLaunchShard } from "./executor";
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
    return launchAppOf(decodeLaunchEnv(rawEnv)).fetch(request);
  },
  async scheduled(_controller: ScheduledController, rawEnv: Record<string, unknown>): Promise<void> {
    const env = decodeLaunchEnv(rawEnv);
    await Effect.runPromise(
      runLaunchSchedule(new D1LaunchStore(env.DB), new D1SlotStore(env.DB), new D1CalendarStore(env.DB), new Date()),
    );
    // The backstop: whatever a tick queued, and anything due that no queueing path armed, runs now.
    await registrarOf(env).armFor(Date.now());
  },
};

const registrarOf = (env: LaunchEnv) => env.REGISTRAR.get(env.REGISTRAR.idFromName("registrar"));

export { Registrar } from "./registrar";

const launchAppOf = (env: LaunchEnv) =>
  createLaunchApp({
    config: {
      allowedOrigins: new Set([new URL(env.BASE_URL).origin]),
      launcherAllowlist: env.launchers,
      operatorToken: env.OPERATOR_TOKEN,
    },
    deployment: { environment: env.ENVIRONMENT, version: env.VERSION.id },
    identity: createIdentityResolver(env.BASE_URL, (url, init) => env.IDENTITY.fetch(url, init)),
    store: new D1LaunchStore(env.DB),
    slots: new D1SlotStore(env.DB),
    calendar: new D1CalendarStore(env.DB),
    registrar: { armFor: (dueAt) => registrarOf(env).armFor(dueAt) },
    playerAccount: async (realmsId) => {
      const { shard } = await readLaunchShard(env.SHARD_URL);
      return realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey);
    },
  });
