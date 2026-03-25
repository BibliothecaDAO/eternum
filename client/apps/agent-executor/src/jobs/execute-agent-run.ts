import { runAgentTurn } from "@bibliothecadao/agent-runtime";
import type { AgentEvent } from "@bibliothecadao/types";

import { createPlayerAgentRuntime } from "../runtime/create-player-agent-runtime";
import type { CartridgeStoredResolvedSession } from "../sessions/cartridge-stored-session-resolver";
import { ExecutorRunStore } from "../persistence/executor-run-store";
import type { AgentRunJob } from "@bibliothecadao/types";
import { mapRuntimeEventToAgentEvent } from "./runtime-agent-event-mapper";

export async function executeAgentRun(input: {
  job: AgentRunJob;
  store: ExecutorRunStore;
  session: CartridgeStoredResolvedSession;
  modelProvider: string;
  modelId: string;
  tickIntervalMs?: number;
  turnTimeoutMs?: number;
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
    events.push(mapRuntimeEventToAgentEvent(input.job.agentId, event));
  });

  try {
    const result = await runAgentTurn({
      runtime: runtimeFactory.runtime,
      prompt: runtimeFactory.buildHeartbeatPrompt(),
      wakeReason: input.job.wakeReason,
      timeoutMs: input.turnTimeoutMs,
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
