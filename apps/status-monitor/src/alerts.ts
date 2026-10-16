import type { Incident, StatusDocument } from "./model";

/** An incident reaches people once it has lasted this long, so one slow minute wakes no one. */
export const SUSTAINED_SECONDS = 120;

/** Where alerts go: the operator's address, through the Resend account the identity Worker already sends from. */
export interface Alerting {
  apiKey: string;
  to: string;
  environment: string;
}

/**
 * Emails each incident once it is sustained and again once it resolves, and returns the incidents told and not yet
 * resolved. A failed send stays untold and is retried next minute; Resend's idempotency key keeps a retried or
 * overlapping run from sending the same news twice.
 */
export async function tellPeople(
  document: StatusDocument,
  told: readonly string[],
  alerting: Alerting | undefined,
  network: typeof fetch,
): Promise<string[]> {
  const stillTold = new Set(told.filter((id) => document.incidents.some((incident) => incident.id === id)));
  const opened = document.incidents.filter(
    (incident) =>
      incident.status !== "resolved" &&
      !stillTold.has(incident.id) &&
      document.checked_at - incident.started_at >= SUSTAINED_SECONDS,
  );
  const resolved = document.incidents.filter(
    (incident) => incident.status === "resolved" && stillTold.has(incident.id),
  );
  if (!opened.length && !resolved.length) return [...stillTold];
  if (!alerting) {
    console.error(JSON.stringify({ event: "status_alerts_unconfigured", untold: opened.length + resolved.length }));
    return [...stillTold];
  }
  for (const incident of opened) if (await sendAlert(alerting, incident, "opened", network)) stillTold.add(incident.id);
  for (const incident of resolved)
    if (await sendAlert(alerting, incident, "resolved", network)) stillTold.delete(incident.id);
  return [...stillTold];
}

async function sendAlert(
  alerting: Alerting,
  incident: Incident,
  news: "opened" | "resolved",
  network: typeof fetch,
): Promise<boolean> {
  const subject = `[${alerting.environment}] ${news === "resolved" ? "Resolved: " : ""}${incident.title}`;
  const at = new Date((news === "resolved" ? incident.resolved_at! : incident.started_at) * 1000).toISOString();
  const text = [
    `${incident.title}, ${news === "resolved" ? "resolved" : "since"} ${at}.`,
    `Component: ${incident.components.join(", ")}.`,
    "What it means and the first commands: deploy/first/ON-CALL.md, under that component.",
  ].join("\n");
  try {
    const response = await network("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${alerting.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": `${alerting.environment}:${incident.id}:${news}`,
      },
      body: JSON.stringify({ from: "Realms status <no-reply@realms.party>", to: [alerting.to], subject, text }),
    });
    if (response.ok) return true;
    console.error(JSON.stringify({ event: "status_alert_refused", incident: incident.id, status: response.status }));
  } catch {
    console.error(JSON.stringify({ event: "status_alert_unsent", incident: incident.id }));
  }
  return false;
}
