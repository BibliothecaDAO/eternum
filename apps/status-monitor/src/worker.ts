import { Effect } from "effect";
import { isStatusDocument, STATE_KEY, type MonitorState } from "./model";
import { probeServices, type PublicValueTargets } from "./probes";
import { nextMonitorState } from "./state";

interface Env {
  STATUS_BUCKET: R2Bucket;
  RELAY_HEALTH_URL: string;
  GUARDIAN_HEALTH_URL: string;
  LEDGER_RPC_URL: string;
  LEDGER_ADDRESS: string;
}

/** The monitor publishes one conditional object: counters and public document cannot diverge after a crash. */
export const monitor = (bucket: R2Bucket, network: typeof fetch, now: number, targets: PublicValueTargets) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { object, previous } = yield* Effect.promise(() => readMonitorState(bucket));
      if (previous && Math.floor(previous.document.checked_at / 60) >= Math.floor(now / 60)) return;
      const result = yield* Effect.promise(() => probeServices(network, now, previous?.targets ?? [], targets));
      const next = nextMonitorState(previous, now, result.probes, result.targets);
      if (next) yield* Effect.promise(() => publishObservation(bucket, object, next));
    }),
  );

const readMonitorState = async (bucket: R2Bucket) => {
  const object = await bucket.get(STATE_KEY);
  const previous = object ? await object.json<MonitorState>() : null;
  if (previous && (!isStatusDocument(previous.document) || !Array.isArray(previous.targets) || !previous.counters))
    throw new Error("Invalid monitor state");
  return { object, previous };
};
const publishObservation = async (bucket: R2Bucket, object: R2ObjectBody | null, next: MonitorState) => {
  const written = await bucket.put(STATE_KEY, JSON.stringify(next), {
    onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
  });
  if (!written) throw new Error("Monitor observation superseded; conditional publication refused");
};

export default {
  async scheduled(_controller: ScheduledController, env: Env) {
    try {
      await monitor(env.STATUS_BUCKET, fetch, Math.floor(Date.now() / 1000), valueTargetsOf(env));
    } catch {
      console.error("status_monitor_failed");
      throw new Error("Status observation was not published");
    }
  },
};

const valueTargetsOf = (env: Env): PublicValueTargets => {
  const values = [env.RELAY_HEALTH_URL, env.GUARDIAN_HEALTH_URL, env.LEDGER_RPC_URL, env.LEDGER_ADDRESS];
  if (values.some((value) => typeof value !== "string" || !value))
    throw new Error("Status target configuration missing");
  return {
    relayHealthUrl: env.RELAY_HEALTH_URL,
    guardianHealthUrl: env.GUARDIAN_HEALTH_URL,
    ledgerRpcUrl: env.LEDGER_RPC_URL,
    ledgerAddress: env.LEDGER_ADDRESS,
  };
};
