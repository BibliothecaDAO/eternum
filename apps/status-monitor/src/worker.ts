import { environmentL2, type ValueEnvironment } from "@realms-world/chain";
import { Effect } from "effect";
import { NO_ALERTS, recordNotices, sendNotices, type Alerting } from "./alerts";
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
 * The monitor publishes one conditional object: counters, public document and alert notices cannot diverge after a
 * crash. A notice is recorded in that object before it is sent, and only an observation whose write won sends: an
 * overlapping, superseded run sends nothing. A send whose confirmation is not written is retried, exactly as recorded,
 * under its idempotency key.
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
      next.alerts = recordNotices(next.document, previous?.alerts ?? NO_ALERTS, alerting);
      const written = yield* Effect.promise(() => publishObservation(bucket, object, next));
      if (!alerting || next.alerts.outbox.length === 0) return;
      const sent = yield* Effect.promise(() => sendNotices(next.alerts!.outbox, alerting.apiKey, network));
      if (sent.size === 0) return;
      const outbox = next.alerts.outbox.filter((notice) => !sent.has(notice.key));
      yield* Effect.promise(() => recordSent(bucket, written, { ...next, alerts: { ...next.alerts!, outbox } }));
    }),
  );

/** A newer observation already holds these notices; it confirms them itself, and Resend drops the repeated keys. */
const recordSent = (bucket: R2Bucket, written: { etag: string }, next: MonitorState) =>
  publishObservation(bucket, written, next).catch(() =>
    console.error(JSON.stringify({ event: "status_alert_confirmation_superseded" })),
  );

const readMonitorState = async (bucket: R2Bucket) => {
  const object = await bucket.get(STATE_KEY);
  const previous = object ? await object.json<MonitorState>() : null;
  if (
    previous &&
    (!isStatusDocument(previous.document) ||
      !Array.isArray(previous.targets) ||
      !previous.counters ||
      (previous.alerts !== undefined &&
        (!Array.isArray(previous.alerts.told) || !Array.isArray(previous.alerts.outbox))))
  )
    throw new Error("Invalid monitor state");
  return { object, previous };
};
const publishObservation = async (bucket: R2Bucket, object: { etag: string } | null, next: MonitorState) => {
  const written = await bucket.put(STATE_KEY, JSON.stringify(next), {
    onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
  });
  if (!written) throw new Error("Monitor observation superseded; conditional publication refused");
  return written;
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
