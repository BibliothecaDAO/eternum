import type { ManagedAgentRuntimeEvent } from "@bibliothecadao/agent-runtime";
import type { AgentEvent } from "@bibliothecadao/types";

export function mapRuntimeEventToAgentEvent(agentId: string, event: ManagedAgentRuntimeEvent): AgentEvent {
  if (event.type === "managed_runtime.transaction_submitted") {
    return buildEvent(agentId, "agent.action_submitted", event.payload ?? {});
  }

  if (event.type === "managed_runtime.transaction_confirmed") {
    return buildEvent(agentId, "agent.action_confirmed", event.payload ?? {});
  }

  if (event.type === "tool_execution_start") {
    return buildEvent(agentId, "agent.tool_started", {
      toolName: event.payload?.toolName,
      runtimeToolCallId: event.payload?.runtimeToolCallId,
    });
  }

  if (event.type === "tool_execution_end") {
    return buildEvent(agentId, "agent.tool_finished", {
      toolName: event.payload?.toolName,
      runtimeToolCallId: event.payload?.runtimeToolCallId,
      isError: event.payload?.isError,
    });
  }

  if (event.type === "message_end") {
    const message = event.payload?.message as any;
    const summary =
      typeof message?.content === "string"
        ? message.content
        : Array.isArray(message?.content)
          ? message.content
              .filter((block: any) => block.type === "text")
              .map((block: any) => block.text)
              .join("")
          : undefined;

    return buildEvent(agentId, message?.errorMessage ? "agent.error" : "agent.thought", {
      summary,
      errorMessage: message?.errorMessage,
    });
  }

  return buildEvent(agentId, "agent.status_changed", {
    runtimeEventType: event.type,
  });
}

function buildEvent(agentId: string, type: string, payload: Record<string, unknown>): AgentEvent {
  return {
    id: crypto.randomUUID(),
    agentId,
    seq: 0,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}
