import type {
  AgentDetail,
  AgentEvent,
  AgentMessage,
  AgentRunSummary,
  AgentSetupState,
  MyAgentDetail,
  MyAgentSummary,
  SteeringJobConfig,
  SteeringJobState,
  SteeringJobType,
} from "@bibliothecadao/types";

type RegistryEntry = {
  detail: MyAgentDetail;
  history: AgentRunSummary[];
  lastActivityAt?: string;
};

const registry = new Map<string, RegistryEntry>();

function toSummary(detail: MyAgentDetail): MyAgentSummary {
  return {
    id: detail.id,
    kind: detail.kind,
    ownerType: detail.ownerType,
    ownerId: detail.ownerId,
    worldId: detail.worldId,
    displayName: detail.displayName,
    desiredState: detail.desiredState,
    executionState: detail.executionState,
    modelProvider: detail.modelProvider,
    modelId: detail.modelId,
    nextWakeAt: detail.nextWakeAt,
    lastRunFinishedAt: detail.lastRunFinishedAt,
    lastErrorCode: detail.lastErrorCode,
    lastErrorMessage: detail.lastErrorMessage,
    setup: detail.setup,
    autonomy: detail.autonomy,
    activeSteeringJob: detail.activeSteeringJob,
  };
}

export function createPlayerOwnedAgentDetail(input: {
  detail: AgentDetail;
  setup: AgentSetupState;
  accountAddress?: string;
}): MyAgentDetail {
  return {
    ...input.detail,
    ownerId: input.accountAddress ?? input.detail.ownerId,
    accountAddress: input.accountAddress ?? input.detail.accountAddress,
    setup: input.setup,
    autonomy: {
      enabled: false,
      worldId: input.detail.worldId,
    },
    history: [],
    recentEvents: [],
  };
}

export function saveAgentDetail(detail: MyAgentDetail) {
  const finishedAt =
    typeof detail.latestRun?.finishedAt === "string"
      ? detail.latestRun.finishedAt
      : detail.latestRun?.finishedAt?.toISOString();
  const startedAt =
    typeof detail.latestRun?.startedAt === "string"
      ? detail.latestRun.startedAt
      : detail.latestRun?.startedAt?.toISOString();
  registry.set(detail.id, {
    detail,
    history: detail.history ?? [],
    lastActivityAt: finishedAt ?? startedAt,
  });
}

export function getAgentDetail(agentId: string): MyAgentDetail | null {
  return registry.get(agentId)?.detail ?? null;
}

export function listAgentsForOwner(ownerId: string): MyAgentSummary[] {
  return Array.from(registry.values())
    .map((entry) => entry.detail)
    .filter((detail) => detail.ownerId === ownerId)
    .map(toSummary);
}

export function updateAutonomyState(input: { agentId: string; enabled: boolean; worldId: string }) {
  const entry = registry.get(input.agentId);
  if (!entry) {
    return null;
  }

  entry.detail = {
    ...entry.detail,
    autonomy: {
      ...entry.detail.autonomy,
      enabled: input.enabled,
      worldId: input.worldId,
      ...(input.enabled
        ? {
            enabledAt: new Date().toISOString(),
            disabledAt: undefined,
          }
        : {
            disabledAt: new Date().toISOString(),
          }),
    },
  };
  registry.set(input.agentId, entry);
  return entry.detail;
}

export function updateSteeringJob(input: {
  agentId: string;
  type: SteeringJobType;
  config?: SteeringJobConfig;
}): MyAgentDetail | null {
  const entry = registry.get(input.agentId);
  if (!entry) {
    return null;
  }

  const steeringJob: SteeringJobState = {
    type: input.type,
    status: entry.detail.autonomy.enabled ? "active" : "paused",
    label: input.type[0].toUpperCase() + input.type.slice(1),
    summary: `Prioritizing ${input.type}.`,
    config: input.config ?? {},
    startedAt: entry.detail.activeSteeringJob?.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  entry.detail = {
    ...entry.detail,
    activeSteeringJob: steeringJob,
  };
  registry.set(input.agentId, entry);
  return entry.detail;
}

export function appendHistory(agentId: string, run: AgentRunSummary) {
  const entry = registry.get(agentId);
  if (!entry) {
    return;
  }

  entry.history = [run, ...entry.history].slice(0, 20);
  const finishedAt = typeof run.finishedAt === "string" ? run.finishedAt : run.finishedAt?.toISOString();
  const startedAt = typeof run.startedAt === "string" ? run.startedAt : run.startedAt.toISOString();

  entry.detail = {
    ...entry.detail,
    latestRun: run,
    history: entry.history,
    lastRunFinishedAt: finishedAt,
  };
  entry.lastActivityAt = finishedAt ?? startedAt;
  registry.set(agentId, entry);
}

export function buildCuratedEvent(input: {
  agentId: string;
  type: string;
  payload?: Record<string, unknown>;
}): AgentEvent {
  return {
    id: crypto.randomUUID(),
    agentId: input.agentId,
    seq: 0,
    type: input.type,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
  };
}

export function buildAgentMessage(input: {
  agentId: string;
  senderType: AgentMessage["senderType"];
  senderId: string;
  content: string;
  metadata?: Record<string, unknown>;
}): AgentMessage {
  return {
    id: crypto.randomUUID(),
    threadId: `thread:${input.agentId}`,
    senderType: input.senderType,
    senderId: input.senderId,
    content: input.content,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
}
