import {
  resolveSteeringOverlay,
  loadAgentArtifacts,
  loadAgentSession,
  materializeAgentArtifacts,
  runAgentTurn,
} from "@bibliothecadao/agent-runtime";
import type {
  AgentArtifactStore,
  AgentSessionResolver,
  AgentTurnResult,
  ManagedAgentRuntime,
  ResolvedAgentSession,
  SteeringOverlay,
  SteeringOverlayResolver,
} from "@bibliothecadao/agent-runtime";
import type { AgentRunJob } from "@bibliothecadao/types";

export interface AgentExecutorServices<TSession extends ResolvedAgentSession = ResolvedAgentSession> {
  artifactStore: AgentArtifactStore;
  sessionResolver: AgentSessionResolver<Record<string, unknown>, TSession>;
  steeringOverlayResolver?: SteeringOverlayResolver;
  resolveSteeringOverlay?: (input: { job: AgentRunJob; session: TSession }) => Promise<SteeringOverlay | null>;
  createRuntime(input: {
    agentId: string;
    dataDir: string;
    session: TSession;
    snapshotVersion?: number;
  }): Promise<ManagedAgentRuntime>;
  persistRunResult(input: { job: AgentRunJob; result: AgentTurnResult; session: TSession }): Promise<void>;
}

export async function runAgentRunJob<TSession extends ResolvedAgentSession = ResolvedAgentSession>(
  services: AgentExecutorServices<TSession>,
  job: AgentRunJob,
): Promise<AgentTurnResult> {
  const session = await loadAgentSession({
    agentId: job.agentId,
    resolver: services.sessionResolver,
  });

  const artifacts = await loadAgentArtifacts({
    agentId: job.agentId,
    store: services.artifactStore,
  });

  const dataDir = `/tmp/agent-runtime/${job.agentId}`;
  await materializeAgentArtifacts({
    dataDir,
    artifacts,
  });

  const runtime = await services.createRuntime({
    agentId: job.agentId,
    dataDir,
    session,
    snapshotVersion: job.snapshotVersion,
  });
  const steeringOverlay = await loadRunSteeringOverlay(services, job, session);

  const result = await runAgentTurn({
    runtime,
    prompt: buildTurnPrompt(job),
    wakeReason: job.wakeReason,
    steeringOverlay,
  });

  await runtime.dispose();
  await services.persistRunResult({
    job,
    result,
    session,
  });
  return result;
}

async function loadRunSteeringOverlay<TSession extends ResolvedAgentSession>(
  services: AgentExecutorServices<TSession>,
  job: AgentRunJob,
  session: TSession,
): Promise<SteeringOverlay | null> {
  if (services.resolveSteeringOverlay) {
    return services.resolveSteeringOverlay({ job, session });
  }

  return resolveSteeringOverlay(
    job.agentId,
    session.metadata?.worldId as string | undefined,
    services.steeringOverlayResolver,
  );
}

function buildTurnPrompt(job: AgentRunJob): string {
  return `Wake reason: ${job.wakeReason}. Process the latest queued work for agent ${job.agentId}.`;
}
