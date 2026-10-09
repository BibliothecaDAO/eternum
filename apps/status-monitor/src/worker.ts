import { isStatusDocument, STATE_KEY, type MonitorState } from "./model";
import { probeServices } from "./probes";
import { nextMonitorState } from "./state";

interface Env {
  STATUS_BUCKET: R2Bucket;
}

/** The monitor publishes one conditional object: counters and public document cannot diverge after a crash. */
export async function monitor(bucket: R2Bucket, network: typeof fetch, now: number) {
  const object = await bucket.get(STATE_KEY);
  const previous = object ? await object.json<MonitorState>() : null;
  if (previous && (!isStatusDocument(previous.document) || !Array.isArray(previous.targets) || !previous.counters))
    throw new Error("Invalid monitor state");
  if (previous && Math.floor(previous.document.checked_at / 60) >= Math.floor(now / 60)) return;
  const result = await probeServices(network, now, previous?.targets ?? []);
  const next = nextMonitorState(previous, now, result.probes, result.targets);
  if (!next) return;
  const written = await bucket.put(STATE_KEY, JSON.stringify(next), {
    onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
  });
  if (!written) throw new Error("Monitor observation superseded; conditional publication refused");
}

export default {
  async scheduled(_controller: ScheduledController, env: Env) {
    try {
      await monitor(env.STATUS_BUCKET, fetch, Math.floor(Date.now() / 1000));
    } catch {
      console.error("status_monitor_failed");
      throw new Error("Status observation was not published");
    }
  },
};
