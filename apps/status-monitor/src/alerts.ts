import type { Incident, StatusDocument } from "./model";

/** An incident reaches people once it has lasted this long, so one slow minute wakes no one. */
export const SUSTAINED_SECONDS = 120;

/**
 * Resend keeps an idempotency key for 24 hours and answers a repeated key with its first answer, sending nothing. A
 * notice not confirmed within this long is dropped, never sent again: past the key's life a resend would be a second
 * email, and a send whose answer was lost may already have delivered.
 */
export const NOTICE_LIFETIME_SECONDS = 23 * 3600;

/** Where alerts go: the operator's address, through the Resend account the identity Worker already sends from. */
export interface Alerting {
  apiKey: string;
  to: string;
  environment: string;
}

/** One email, fixed when its incident changed: every retry sends exactly this, under this key. */
export interface Notice {
  key: string;
  recorded_at: number;
  to: string;
  subject: string;
  text: string;
}

/** The incidents told and not yet resolved, and the notices recorded and not yet confirmed sent. */
export interface AlertState {
  told: string[];
  outbox: Notice[];
}

export const NO_ALERTS: AlertState = { told: [], outbox: [] };

/**
 * Records a notice for each incident sustained and untold, and for each told incident now resolved, beside the notices
 * still unconfirmed. The monitor writes this state before any send, so a notice is decided once, whatever happens to
 * a send or a later write. Without an address, nothing is recorded and the changes wait untold.
 */
export function recordNotices(
  document: StatusDocument,
  previous: AlertState,
  alerting: Alerting | undefined,
): AlertState {
  const told = new Set(previous.told.filter((id) => document.incidents.some((incident) => incident.id === id)));
  const outbox = previous.outbox.filter((notice) => {
    const live = document.checked_at - notice.recorded_at < NOTICE_LIFETIME_SECONDS;
    if (!live) console.error(JSON.stringify({ event: "status_alert_expired", key: notice.key }));
    return live;
  });
  const opened = document.incidents.filter(
    (incident) =>
      incident.status !== "resolved" &&
      !told.has(incident.id) &&
      document.checked_at - incident.started_at >= SUSTAINED_SECONDS,
  );
  const resolved = document.incidents.filter((incident) => incident.status === "resolved" && told.has(incident.id));
  if (!opened.length && !resolved.length) return { told: [...told], outbox };
  if (!alerting) {
    console.error(JSON.stringify({ event: "status_alerts_unconfigured", untold: opened.length + resolved.length }));
    return { told: [...told], outbox };
  }
  for (const incident of opened) {
    told.add(incident.id);
    outbox.push(noticeOf(alerting, incident, "opened", document.checked_at));
  }
  for (const incident of resolved) {
    told.delete(incident.id);
    outbox.push(noticeOf(alerting, incident, "resolved", document.checked_at));
  }
  return { told: [...told], outbox };
}

/** Sends each recorded notice, exactly as recorded; returns the keys Resend confirmed. */
export async function sendNotices(outbox: readonly Notice[], apiKey: string, network: typeof fetch) {
  const confirmed = new Set<string>();
  for (const notice of outbox) if (await sendNotice(notice, apiKey, network)) confirmed.add(notice.key);
  return confirmed;
}

function noticeOf(alerting: Alerting, incident: Incident, news: "opened" | "resolved", now: number): Notice {
  const at = new Date((news === "resolved" ? incident.resolved_at! : incident.started_at) * 1000).toISOString();
  return {
    key: `${alerting.environment}:${incident.id}:${news}`,
    recorded_at: now,
    to: alerting.to,
    subject: `[${alerting.environment}] ${news === "resolved" ? "Resolved: " : ""}${incident.title}`,
    text: [
      `${incident.title}, ${news === "resolved" ? "resolved" : "since"} ${at}.`,
      `Component: ${incident.components.join(", ")}.`,
      "What it means and the first commands: deploy/first/ON-CALL.md, under that component.",
    ].join("\n"),
  };
}

async function sendNotice(notice: Notice, apiKey: string, network: typeof fetch): Promise<boolean> {
  try {
    const response = await network("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": notice.key,
      },
      body: JSON.stringify({
        from: "Realms status <no-reply@realms.party>",
        to: [notice.to],
        subject: notice.subject,
        text: notice.text,
      }),
    });
    if (response.ok) return true;
    // A 409 is the same key still in flight elsewhere: the notice stays recorded and is retried next minute.
    console.error(JSON.stringify({ event: "status_alert_unconfirmed", key: notice.key, status: response.status }));
  } catch {
    console.error(JSON.stringify({ event: "status_alert_unconfirmed", key: notice.key }));
  }
  return false;
}
