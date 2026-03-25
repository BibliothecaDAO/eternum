import type { AgentEvent, AgentExecutionSummary, AgentLatestAction, AgentRunSummary } from "@bibliothecadao/types";

export function buildLatestActionFromEvents(events: AgentEvent[]): AgentLatestAction | undefined {
  const latestActionEvent = [...events]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .find((event) => event.type === "agent.action_confirmed" || event.type === "agent.action_submitted");

  if (!latestActionEvent) {
    return undefined;
  }

  return {
    toolName: asOptionalString(latestActionEvent.payload?.toolName),
    contractAddress: asOptionalString(latestActionEvent.payload?.contractAddress),
    entrypoint: asOptionalString(latestActionEvent.payload?.entrypoint),
    calldataSummary: asOptionalString(latestActionEvent.payload?.calldataSummary),
    txHash: asOptionalString(latestActionEvent.payload?.txHash),
    receiptStatus: asOptionalString(latestActionEvent.payload?.receiptStatus),
    status: resolveLatestActionStatus(latestActionEvent),
    errorMessage: asOptionalString(latestActionEvent.payload?.errorMessage),
    createdAt: latestActionEvent.createdAt,
  };
}

export function buildAgentExecutionSummary(input: {
  latestAction?: AgentLatestAction;
  latestRun?: AgentRunSummary;
}): AgentExecutionSummary | undefined {
  if (!input.latestAction && !input.latestRun) {
    return undefined;
  }

  return {
    lastRunStatus: input.latestRun?.status,
    lastWakeReason: input.latestRun?.wakeReason,
    lastRunStartedAt: input.latestRun?.startedAt,
    lastRunFinishedAt: input.latestRun?.finishedAt,
    lastErrorMessage: input.latestRun?.errorMessage,
    latestActionStatus: input.latestAction?.status,
    latestActionAt: input.latestAction?.createdAt,
  };
}

function resolveLatestActionStatus(event: AgentEvent): AgentLatestAction["status"] {
  if (event.type === "agent.action_confirmed") {
    return event.payload?.isError ? "failed" : "confirmed";
  }

  return "submitted";
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
