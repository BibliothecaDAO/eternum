import { environmentL2, type ValueEnvironment } from "@realms-world/chain";
import { Effect } from "effect";
import { tellPeople, type Alerting } from "./alerts";
import { isStatusDocument, STATE_KEY, type MonitorState } from "./model";
import { probeServices, type PublicValueTargets } from "./probes";
import { nextMonitorState } from "./state";

interface Env {
  STATUS_BUCKET: R2Bucket;
  BASE_URL: string;
  L2_RPC_URL: string;
  ENVIRONMENT: ValueEnvironment;
  /** Set together by the deploy from its inputs; without them incidents are published but not emailed. */
  RESEND_API_KEY?: string;
  ALERT_EMAIL?: string;
}

/**
 * The monitor publishes one conditional object: counters, public document and the incidents already emailed cannot
 * diverge after a crash.
 */
export const monitor = (
  bucket: R2Bucket,
  network: typeof fetch,
  now: number,
  targets: PublicValueTargets,
  alerting?: Alerting,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { object, previous } = yield* Effect.promise(() => readMonitorState(bucket));
      if (previous && Math.floor(previous.document.checked_at / 60) >= Math.floor(now / 60)) return;
      const result = yield* Effect.promise(() => probeServices(network, now, previous?.targets ?? [], targets));
      const next = nextMonitorState(previous, now, result.probes, result.targets);
      if (!next) return;
      next.told = yield* Effect.promise(() => tellPeople(next.document, previous?.told ?? [], alerting, network));
      yield* Effect.promise(() => publishObservation(bucket, object, next));
    }),
  );

const readMonitorState = async (bucket: R2Bucket) => {
  const object = await bucket.get(STATE_KEY);
  const previous = object ? await object.json<MonitorState>() : null;
  if (
    previous &&
    (!isStatusDocument(previous.document) ||
      !Array.isArray(previous.targets) ||
      !previous.counters ||
      (previous.told !== undefined && !Array.isArray(previous.told)))
  )
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
      await monitor(env.STATUS_BUCKET, fetch, Math.floor(Date.now() / 1000), valueTargetsOf(env), alertingOf(env));
    } catch {
      console.error("status_monitor_failed");
      throw new Error("Status observation was not published");
    }
  },
};

const alertingOf = (env: Env): Alerting | undefined =>
  env.RESEND_API_KEY && env.ALERT_EMAIL
    ? { apiKey: env.RESEND_API_KEY, to: env.ALERT_EMAIL, environment: env.ENVIRONMENT }
    : undefined;

const valueTargetsOf = (env: Env): PublicValueTargets => {
  const values = [env.BASE_URL, env.L2_RPC_URL];
  if (values.some((value) => typeof value !== "string" || !value))
    throw new Error("Status target configuration missing");
  return {
    ledgerRpcUrl: env.L2_RPC_URL,
    ledgerAddress: environmentL2(env.ENVIRONMENT).ledger,
    playUrl: env.BASE_URL,
  };
};
