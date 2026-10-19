import type { Incident, StatusDocument } from "./model";

/**
 * An outage reaches the owner once its component has been down this long without a break. Anything shorter, and
 * anything only degraded (slow, or a few blocks behind), stays on the status page: in one night of test games a
 * two-minute rule on any status sent 328 emails, every one a degraded blip that recovered by itself.
 */
export const SUSTAINED_SECONDS = 600;

/** What players use and only the owner can bring back: the client, sign-in, game launches, and each world. */
const isEmailed = (componentId: string) =>
  ["play", "accounts", "launch"].includes(componentId) || componentId.startsWith("shard:");

/**
 * Resend keeps an idempotency key for 24 hours and answers a repeated key with its first answer, sending nothing. A
 * notice not confirmed within this long is dropped, never sent again: past the key's life a resend would be a second
 * email, and a send whose answer was lost may already have delivered.
 */
export const NOTICE_LIFETIME_SECONDS = 23 * 3600;

/**
 * At most this many emails go out in any 24 hours: the Resend account also sends players' sign-in codes, and on 10-17
 * an uncapped monitor's 340 emails blocked them. A notice holds its place from when it is recorded until a day after the
 * last minute it was handed to Resend, which is when its email may have gone out: a send delayed by an outage, or one
 * whose answer was lost, keeps its place as long as it could still be delivered. The last notice allowed says so;
 * changes after it wait, untold, for a place, and only the ones still true then are told. The status page always shows
 * everything.
 */
export const DAILY_EMAILS = 4;
const DAY_SECONDS = 24 * 3600;

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

/** One notice's place in the daily cap: the last minute it was handed to Resend, or would be after this write. */
export interface Reservation {
  key: string;
  at: number;
}

/** The incidents told and not yet resolved, the notices recorded and not yet confirmed sent, and their cap places. */
export interface AlertState {
  told: string[];
  outbox: Notice[];
  /** The places of the last 24 hours' notices; a state written before the cap holds none. */
  sent?: Reservation[];
}

export const NO_ALERTS: AlertState = { told: [], outbox: [], sent: [] };

/**
 * Records one notice for the sustained outages newly untold, and one for the told ones now resolved, beside the notices
 * still unconfirmed, within the daily cap. The monitor writes this state before any send, so a notice is decided once,
 * whatever happens to a send or a later write. Without an address, nothing is recorded and the changes wait untold.
 */
export function recordNotices(
  document: StatusDocument,
  previous: AlertState,
  alerting: Alerting | undefined,
): AlertState {
  const now = document.checked_at;
  const told = new Set(previous.told.filter((id) => document.incidents.some((incident) => incident.id === id)));
  const outbox = previous.outbox.filter((notice) => {
    const live = now - notice.recorded_at < NOTICE_LIFETIME_SECONDS;
    if (!live) console.error(JSON.stringify({ event: "status_alert_expired", key: notice.key }));
    return live;
  });
  // The monitor sends the whole outbox right after writing this state, so each queued notice may go out this minute.
  const places = new Map((previous.sent ?? []).map((place) => [place.key, place.at]));
  for (const notice of outbox) places.set(notice.key, now);
  const state = () => ({
    told: [...told],
    outbox,
    sent: [...places].filter(([, at]) => now - at < DAY_SECONDS).map(([key, at]) => ({ key, at })),
  });
  const changes = [
    {
      news: "opened" as const,
      incidents: document.incidents.filter(
        (incident) => incident.status !== "resolved" && !told.has(incident.id) && isSustainedOutage(document, incident),
      ),
    },
    {
      news: "resolved" as const,
      incidents: document.incidents.filter((incident) => incident.status === "resolved" && told.has(incident.id)),
    },
  ].filter((change) => change.incidents.length > 0);
  if (!changes.length) return state();
  if (!alerting) {
    console.error(JSON.stringify({ event: "status_alerts_unconfigured", untold: countIncidents(changes) }));
    return state();
  }
  for (const change of changes) {
    const held = [...places.values()].filter((at) => now - at < DAY_SECONDS);
    if (held.length >= DAILY_EMAILS) {
      console.error(JSON.stringify({ event: "status_alert_capped", untold: change.incidents.length }));
      continue;
    }
    // A place frees a day after its notice was last handed to Resend: never sooner than a day after the earliest.
    const limitEndsAt = held.length + 1 === DAILY_EMAILS ? Math.min(now, ...held) + DAY_SECONDS : null;
    const notice = noticeOf(alerting, change.incidents, change.news, now, limitEndsAt);
    outbox.push(notice);
    places.set(notice.key, now);
    for (const incident of change.incidents)
      if (change.news === "opened") told.add(incident.id);
      else told.delete(incident.id);
  }
  return state();
}

/** Sends each recorded notice, exactly as recorded; returns the keys Resend confirmed. */
export async function sendNotices(outbox: readonly Notice[], apiKey: string, network: typeof fetch) {
  const confirmed = new Set<string>();
  for (const notice of outbox) if (await sendNotice(notice, apiKey, network)) confirmed.add(notice.key);
  return confirmed;
}

function isSustainedOutage(document: StatusDocument, incident: Incident) {
  return document.components.some(
    (component) =>
      incident.components.includes(component.id) &&
      isEmailed(component.id) &&
      component.status === "down" &&
      document.checked_at - component.since >= SUSTAINED_SECONDS,
  );
}

const countIncidents = (changes: readonly { incidents: readonly Incident[] }[]) =>
  changes.reduce((total, change) => total + change.incidents.length, 0);

/** One email for every incident that changed alike in one check; its key is fixed by those incidents and that change. */
function noticeOf(
  alerting: Alerting,
  incidents: readonly Incident[],
  news: "opened" | "resolved",
  now: number,
  limitEndsAt: number | null,
): Notice {
  const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
  const lines = incidents.map((incident) =>
    [
      `${incident.title}, ${news === "resolved" ? "resolved" : "since"} ${iso(news === "resolved" ? incident.resolved_at! : incident.started_at)}.`,
      `Component: ${incident.components.join(", ")}.`,
    ].join("\n"),
  );
  return {
    key: `${alerting.environment}:${incidents.map((incident) => incident.id).join("+")}:${news}`,
    recorded_at: now,
    to: alerting.to,
    subject: `[${alerting.environment}] ${news === "resolved" ? "Resolved: " : ""}${incidents.map((incident) => incident.title).join("; ")}`,
    text: [
      ...lines,
      "What it means and the first commands: deploy/first/ON-CALL.md, under that component.",
      ...(limitEndsAt === null
        ? []
        : [
            `Alert limit reached: no more email before ${iso(limitEndsAt)}. The status page shows every change meanwhile.`,
          ]),
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
