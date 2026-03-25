import type { AgentEvent, AgentHistoryEntry, AgentRunSummary, SteeringJobType } from "@bibliothecadao/types";

export const STEERING_OPTIONS: Array<{ id: SteeringJobType; label: string; summary: string }> = [
  { id: "scout", label: "Scout", summary: "Bias toward exploration and reconnaissance." },
  { id: "defend", label: "Defend", summary: "Bias toward protecting nearby holdings and reacting to threats." },
  { id: "gather", label: "Gather", summary: "Bias toward resources and economy opportunities." },
  { id: "expand", label: "Expand", summary: "Bias toward growth and progression." },
  { id: "support", label: "Support", summary: "Bias toward supporting the current strategic state." },
  { id: "custom", label: "Custom", summary: "Bias toward a player-defined objective." },
];

export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function describeEvent(
  event: AgentEvent | { type?: string; payload?: Record<string, unknown>; createdAt?: string },
) {
  switch (event.type) {
    case "agent.autonomy_enabled":
      return `Autonomy enabled with ${String(event.payload?.steeringJobType ?? "the current")} steering.`;
    case "agent.autonomy_disabled":
      return "Autonomy disabled. The next heartbeat will be skipped.";
    case "agent.steering_changed":
      return `Steering changed to ${String(event.payload?.steeringJobType ?? "updated")}.`;
    case "agent.action_submitted":
      return `Submitted ${String(event.payload?.toolName ?? "an action")} to the runtime.`;
    case "agent.action_confirmed":
      return event.payload?.isError
        ? `${String(event.payload?.toolName ?? "Action")} failed.`
        : `${String(event.payload?.toolName ?? "Action")} completed successfully.`;
    case "agent.error":
      return String(event.payload?.errorMessage ?? event.payload?.summary ?? "An agent error occurred.");
    case "agent.thought":
      return String(event.payload?.summary ?? "The agent completed another planning step.");
    case "agent.status_changed":
      return `Execution status updated to ${String(event.payload?.executionState ?? event.payload?.runtimeEventType ?? "running")}.`;
    case "agent.session_invalidated":
      return `Session invalidated: ${String(event.payload?.reason ?? "reauthorization required")}.`;
    case "agent.setup_changed":
      return `Setup moved to ${String(event.payload?.status ?? "updated")}.`;
    default:
      return String(event.payload?.summary ?? event.payload?.message ?? event.type ?? "Recent agent activity.");
  }
}

export function describeEventDetail(
  event: AgentEvent | { type?: string; payload?: Record<string, unknown>; createdAt?: string },
) {
  if (event.type === "agent.setup_changed") {
    return event.payload?.expiresAt
      ? `Session window expires ${formatTimestamp(String(event.payload.expiresAt), true)}.`
      : null;
  }

  if (event.type === "agent.steering_changed") {
    return typeof event.payload?.summary === "string" ? event.payload.summary : null;
  }

  if (event.type === "agent.action_confirmed" && event.payload?.isError) {
    return "Check the status tab for the latest runtime error.";
  }

  if (event.type === "agent.action_submitted") {
    return "Waiting for the world subscription and runtime confirmation to catch up.";
  }

  if (event.type === "agent.status_changed") {
    return typeof event.payload?.runtimeEventType === "string"
      ? `Runtime event: ${formatEventLabel(event.payload.runtimeEventType)}.`
      : null;
  }

  return null;
}

export function describeHistoryEntry(entry: AgentHistoryEntry) {
  const statusLabel = entry.status ? `Status: ${entry.status}. ` : "";
  const wakeReasonLabel = entry.wakeReason ? `Wake: ${entry.wakeReason}. ` : "";
  return `${statusLabel}${wakeReasonLabel}${entry.summary}`.trim();
}

export function describeRunSummary(run: AgentRunSummary) {
  const outcome = run.status === "failed" ? `Failed: ${run.errorMessage ?? "unknown error"}` : `Status: ${run.status}`;
  return `${outcome}. ${run.toolCalls} tool calls, ${run.mutatingActions} mutating actions.`;
}

export function formatEventLabel(value?: string) {
  return (value ?? "event")
    .replace("agent.", "")
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function humanizeExecutionState(value?: string) {
  return formatEventLabel(value ?? "waiting_auth");
}

export function formatTimestamp(value: string | Date, includeDate: boolean = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    month: includeDate ? "short" : undefined,
    day: includeDate ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface DeduplicatedEvent {
  event: AgentEvent;
  count: number;
}

export function deduplicateConsecutiveEvents(events: AgentEvent[]): DeduplicatedEvent[] {
  if (events.length === 0) return [];

  const result: DeduplicatedEvent[] = [];
  let current: DeduplicatedEvent = { event: events[0], count: 1 };

  for (let i = 1; i < events.length; i++) {
    if (events[i].type === current.event.type) {
      current = { event: events[i], count: current.count + 1 };
    } else {
      result.push(current);
      current = { event: events[i], count: 1 };
    }
  }
  result.push(current);

  return result;
}

export function humanizeConfigKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
