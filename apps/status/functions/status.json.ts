import { isStatusDocument, STATE_KEY, type MonitorState } from "../../status-monitor/src/model";

interface Env {
  STATUS_BUCKET: R2Bucket;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** The static site's own read: it needs neither the app nor the monitor Worker to serve the last observation. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const object = await env.STATUS_BUCKET.get(STATE_KEY);
    if (!object) return json({ error: "status_unavailable" }, 503);
    const state = await object.json<MonitorState>();
    if (!isStatusDocument(state.document)) return json({ error: "status_unavailable" }, 503);
    const age = Math.floor(Date.now() / 1000) - state.document.checked_at;
    if (age > 300 || age < -60) return json({ error: "status_stale", checked_at: state.document.checked_at }, 503);
    return json(state.document);
  } catch {
    return json({ error: "status_unavailable" }, 503);
  }
};
