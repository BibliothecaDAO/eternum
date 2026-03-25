import type {
  AgentEvent,
  AgentHistoryEntry,
  AgentLatestAction,
  AgentRunSummary,
  SteeringJobType,
} from "@bibliothecadao/types";

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
    case "agent.tool_started":
      return `Started ${String(event.payload?.toolName ?? "a tool")} in the runtime.`;
    case "agent.tool_finished":
      return event.payload?.isError
        ? `${String(event.payload?.toolName ?? "Tool")} finished with an error.`
        : `${String(event.payload?.toolName ?? "Tool")} finished cleanly.`;
    case "agent.action_submitted":
      return `Submitted ${String(event.payload?.entrypoint ?? event.payload?.toolName ?? "an action")} onchain.`;
    case "agent.action_confirmed":
      return event.payload?.isError
        ? `${String(event.payload?.entrypoint ?? event.payload?.toolName ?? "Action")} reverted.`
        : `${String(event.payload?.entrypoint ?? event.payload?.toolName ?? "Action")} confirmed.`;
    case "agent.error":
      return String(event.payload?.errorMessage ?? event.payload?.summary ?? "An agent error occurred.");
    case "agent.run_recovered":
      return String(event.payload?.summary ?? "Recovered a stale heartbeat run.");
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

  if (event.type === "agent.action_confirmed" || event.type === "agent.action_submitted") {
    const txHash = typeof event.payload?.txHash === "string" ? truncateAddress(event.payload.txHash, 8) : null;
    const contractAddress =
      typeof event.payload?.contractAddress === "string" ? truncateAddress(event.payload.contractAddress, 8) : null;
    const calldataSummary = typeof event.payload?.calldataSummary === "string" ? event.payload.calldataSummary : null;
    const parts = [contractAddress, txHash, calldataSummary].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  if (event.type === "agent.action_confirmed" && event.payload?.isError) {
    return typeof event.payload?.errorMessage === "string"
      ? event.payload.errorMessage
      : "Check the status tab for the latest runtime error.";
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

export function describeLatestAction(action?: AgentLatestAction) {
  if (!action) {
    return "No onchain action recorded yet";
  }

  const parts = [
    action.toolName ?? "Latest action",
    action.entrypoint,
    action.errorMessage ?? action.receiptStatus ?? action.contractAddress ?? action.status,
  ].filter(Boolean);

  return parts.join(" · ");
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

export function isHeartbeatStalled(input: {
  autonomyEnabled: boolean;
  executionState?: string;
  nextWakeAt?: string | Date;
}): boolean {
  if (!input.autonomyEnabled || !input.nextWakeAt) {
    return false;
  }

  if (!["idle", "queued", "running"].includes(input.executionState ?? "")) {
    return false;
  }

  const nextWakeAt =
    input.nextWakeAt instanceof Date ? input.nextWakeAt.getTime() : Date.parse(String(input.nextWakeAt));
  return Number.isFinite(nextWakeAt) && nextWakeAt < Date.now();
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
