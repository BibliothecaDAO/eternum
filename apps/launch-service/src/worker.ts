import { officialChain } from "@realms-world/value-ledger";
import { Effect } from "effect";
import { createLaunchApp } from "./app";
import { D1CalendarStore } from "./calendar-store";
import { decodeLaunchEnv, type LaunchEnv } from "./env";
import { shardChainOf } from "./executor";
import { runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";

export default {
  fetch(request: Request, rawEnv: Record<string, unknown>): Response | Promise<Response> {
    return launchAppOf(decodeLaunchEnv(rawEnv), new URL(request.url).searchParams.get("chainId")).fetch(request);
  },
  async scheduled(_controller: ScheduledController, rawEnv: Record<string, unknown>): Promise<void> {
    const env = decodeLaunchEnv(rawEnv);
    try {
      const chain = await officialChain(env.IDENTITY);
      if (chain) {
        const { launches, calendar } = launchStoresOf(env, chain.chainId);
        await Effect.runPromise(runLaunchSchedule(launches, calendar));
      }
    } finally {
      await registrarOf(env).armFor(Date.now());
    }
  },
};

/** The launch service's stores on one D1, keyed to the chain the shard's /manifest names. */
const launchStoresOf = (env: LaunchEnv, chainId?: string | null) => {
  const launches = new D1LaunchStore(env.DB, shardChainOf(env, chainId));
  return {
    launches,
    slots: new D1SlotStore(env.DB, launches, env.VALUE_RELAY),
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
    deployment: { environment: env.ENVIRONMENT, version: env.VERSION.id, revision: env.VERSION.tag ?? "" },
    store: launches,
    slots,
    calendar,
    registrar: {
      armFor: (dueAt) => registrarOf(env).armFor(dueAt),
      joinFailure: () => registrarOf(env).joinFailure(),
      wakeAt: () => registrarOf(env).wakeAt(),
      applyRelease: (release, shard) => registrarOf(env).applyRelease(release, shard),
    },
  });
};
