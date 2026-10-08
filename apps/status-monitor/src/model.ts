export type Status = "up" | "degraded" | "down";
export interface Probe {
  id: string;
  name: string;
  status: Status;
  latency_ms: number | null;
}
export interface Target {
  url: string;
  chainId: string;
  status: string;
}
interface Component extends Probe {
  since: number;
  days: { date: string; uptime: number | null }[];
}
export interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  started_at: number;
  resolved_at: number | null;
  components: string[];
  updates: { at: number; text: string }[];
}
export interface StatusDocument {
  version: 1;
  checked_at: number;
  components: Component[];
  incidents: Incident[];
}
export interface Counter {
  date: string;
  observed: number;
  up: number;
  unknown: boolean;
}
export interface MonitorState {
  document: StatusDocument;
  targets: Target[];
  counters: Record<string, Counter[]>;
}
export const STATE_KEY = "state.json";

/** This guards the independently served public document; an invalid object never becomes a green status. */
export function isStatusDocument(value: unknown): value is StatusDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as StatusDocument;
  return (
    doc.version === 1 &&
    Number.isSafeInteger(doc.checked_at) &&
    doc.checked_at > 0 &&
    Array.isArray(doc.components) &&
    doc.components.length > 0 &&
    doc.components.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        typeof row.name === "string" &&
        ["up", "degraded", "down"].includes(row.status) &&
        Number.isSafeInteger(row.since) &&
        row.since <= doc.checked_at &&
        (row.latency_ms === null || (Number.isFinite(row.latency_ms) && row.latency_ms >= 0)) &&
        Array.isArray(row.days) &&
        row.days.length === 90 &&
        row.days.every(
          (day) =>
            /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
            (day.uptime === null || (Number.isFinite(day.uptime) && day.uptime >= 0 && day.uptime <= 1)),
        ),
    ) &&
    Array.isArray(doc.incidents) &&
    doc.incidents.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        typeof row.title === "string" &&
        ["investigating", "identified", "monitoring", "resolved"].includes(row.status) &&
        Number.isSafeInteger(row.started_at) &&
        (row.resolved_at === null || (Number.isSafeInteger(row.resolved_at) && row.resolved_at >= row.started_at)) &&
        Array.isArray(row.components) &&
        row.components.every((id) => typeof id === "string") &&
        Array.isArray(row.updates) &&
        row.updates.every((update) => update && Number.isSafeInteger(update.at) && typeof update.text === "string"),
    )
  );
}
