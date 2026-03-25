import type { AgentRunJob } from "@bibliothecadao/types";

import type { CartridgeStoredResolvedSession } from "../sessions/cartridge-stored-session-resolver";
import type { ExecutorRunStore } from "../persistence/executor-run-store";

export async function processAgentRunJob(input: {
  job: AgentRunJob;
  store: ExecutorRunStore;
  sessionResolver: {
    load(input: { agentId: string }): Promise<CartridgeStoredResolvedSession>;
  };
  executeAgentRun: (input: {
    job: AgentRunJob;
    store: ExecutorRunStore;
    session: CartridgeStoredResolvedSession;
    modelProvider: string;
    modelId: string;
    tickIntervalMs?: number;
    turnTimeoutMs?: number;
  }) => Promise<{ success: boolean; finishedAt: string }>;
}): Promise<{ status: string; success: boolean; finishedAt: string; errorMessage?: string }> {
  const executionConfig = await input.store.loadAgentExecutionConfig(input.job.agentId);
  if (!executionConfig) {
    return { status: "missing_agent", success: false, finishedAt: new Date().toISOString() };
  }

  let failureCode = "session_restore_failed";

  try {
    failureCode = "session_restore_failed";
    const session = await input.sessionResolver.load({ agentId: input.job.agentId });
    const sessionStateResult = await resolveSessionState({
      job: input.job,
      session,
      store: input.store,
    });
    if (sessionStateResult) {
      return sessionStateResult;
    }

    failureCode = "run_claim_failed";
    const markedRunning = await input.store.markRunning(input.job);
    if (!markedRunning) {
      return { status: "busy", success: false, finishedAt: new Date().toISOString() };
    }

    failureCode = "runtime_bootstrap_failed";
    const result = await input.executeAgentRun({
      job: input.job,
      store: input.store,
      session,
      modelProvider: executionConfig.modelProvider,
      modelId: executionConfig.modelId,
      tickIntervalMs: executionConfig.tickIntervalMs,
      turnTimeoutMs: executionConfig.turnTimeoutMs,
    });

    return {
      status: result.success ? "completed" : "failed",
      success: result.success,
      finishedAt: result.finishedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await input.store.persistRunFailure({
      job: input.job,
      errorCode: failureCode,
      errorMessage,
    });
    return {
      status: "failed",
      success: false,
      finishedAt: new Date().toISOString(),
      errorMessage,
    };
  }
}

async function resolveSessionState(input: {
  job: AgentRunJob;
  session: CartridgeStoredResolvedSession;
  store: ExecutorRunStore;
}): Promise<{ status: string; success: boolean; finishedAt: string } | null> {
  if (input.session.status === "expired") {
    const reason = "Session expired. Reauthorize this world agent.";
    await input.store.markSessionExpired?.(input.job.agentId, reason);
    await input.store.persistRunFailure({
      job: input.job,
      errorCode: "session_expired",
      errorMessage: reason,
      executionState: "waiting_auth",
    });
    return { status: "expired", success: false, finishedAt: new Date().toISOString() };
  }

  if (input.session.status === "invalidated") {
    const reason = "World permissions changed. Reauthorize this world agent.";
    await input.store.markSessionInvalidated?.(input.job.agentId, reason);
    await input.store.persistRunFailure({
      job: input.job,
      errorCode: "session_invalidated",
      errorMessage: reason,
      executionState: "waiting_auth",
    });
    return { status: "invalidated", success: false, finishedAt: new Date().toISOString() };
  }

  if (input.session.status !== "ready") {
    const reason = `Agent session is not ready: ${input.session.status}.`;
    await input.store.persistRunFailure({
      job: input.job,
      errorCode: "session_not_ready",
      errorMessage: reason,
      executionState: "waiting_auth",
    });
    return { status: input.session.status, success: false, finishedAt: new Date().toISOString() };
  }

  return null;
}
