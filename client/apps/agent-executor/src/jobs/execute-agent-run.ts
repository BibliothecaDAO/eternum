import { runAgentTurn } from "@bibliothecadao/agent-runtime";
import type { AgentEvent } from "@bibliothecadao/types";

import { createPlayerAgentRuntime } from "../runtime/create-player-agent-runtime";
import type { CartridgeStoredResolvedSession } from "../sessions/cartridge-stored-session-resolver";
import { ExecutorRunStore } from "../persistence/executor-run-store";
import type { AgentRunJob } from "@bibliothecadao/types";

export async function executeAgentRun(input: {
  job: AgentRunJob;
  store: ExecutorRunStore;
  session: CartridgeStoredResolvedSession;
  modelProvider: string;
  modelId: string;
  tickIntervalMs?: number;
}) {
  const runtimeFactory = await createPlayerAgentRuntime({
    agentId: input.job.agentId,
    dataDir: `/tmp/agent-runtime/${input.job.agentId}`,
    session: input.session,
    modelProvider: input.modelProvider,
    modelId: input.modelId,
    tickIntervalMs: input.tickIntervalMs,
  });

  const events: AgentEvent[] = [];
  const unsubscribe = runtimeFactory.runtime.onEvent((event) => {
    events.push(mapRuntimeEvent(input.job.agentId, event.type, event.payload ?? {}));
  });

  try {
    const result = await runAgentTurn({
      runtime: runtimeFactory.runtime,
      prompt: runtimeFactory.buildHeartbeatPrompt(),
      wakeReason: input.job.wakeReason,
    });

    const nextWakeAt = result.success && input.tickIntervalMs ? new Date(Date.now() + input.tickIntervalMs) : undefined;

    await input.store.persistRun(input.job, result, {
      dataDir: runtimeFactory.runtime.dataDir,
      events,
      nextWakeAt,
      errorMessage: result.errorMessage,
    });

    return result;
  } finally {
    unsubscribe();
    await runtimeFactory.dispose();
  }
}

function mapRuntimeEvent(agentId: string, type: string, payload: Record<string, unknown>): AgentEvent {
  if (type === "tool_execution_start") {
    return buildEvent(agentId, "agent.action_submitted", {
      toolName: payload.toolName,
    });
  }

  if (type === "tool_execution_end") {
    return buildEvent(agentId, "agent.action_confirmed", {
      toolName: payload.toolName,
      isError: payload.isError,
    });
  }

  if (type === "message_end") {
    const message = payload.message as any;
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
    runtimeEventType: type,
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
