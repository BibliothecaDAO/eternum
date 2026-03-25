import { createSteeringOverlay, getSteeringLabel } from "@bibliothecadao/agent-runtime";
import { createHash } from "node:crypto";
import type {
  AgentEvent,
  AgentHistoryEntry,
  AgentMessage,
  AgentSessionDetail,
  MyAgentDetail,
  MyAgentSummary,
  SteeringJobState,
} from "@bibliothecadao/types";

import type {
  AppendPlayerAgentMessageInput,
  CompletePlayerSetupInput,
  LaunchPlayerAgentInput,
  ListPlayerAgentEventsInput,
  PlayerAgentRepository,
  SetPlayerAgentAutonomyInput,
  SetPlayerAgentSteeringInput,
  UpdatePlayerAgentInput,
} from "./types";

type MemoryEntry = {
  detail: MyAgentDetail;
  events: AgentEvent[];
  messages: AgentMessage[];
  history: AgentHistoryEntry[];
  session?: AgentSessionDetail & {
    authState?: string;
    sessionRef?: string;
    policyFingerprint?: string;
    encryptedSignerJson?: unknown;
    keyVersion?: string;
  };
};

export class MemoryPlayerAgentRepository implements PlayerAgentRepository {
  private readonly entries = new Map<string, MemoryEntry>();

  async listPlayerAgents(ownerId: string): Promise<MyAgentSummary[]> {
    return Array.from(this.entries.values())
      .map((entry) => entry.detail)
      .filter((detail) => detail.ownerId === ownerId)
      .map(toSummary);
  }

  async getPlayerAgentDetail(ownerId: string, agentId: string): Promise<MyAgentDetail | null> {
    const entry = this.entries.get(agentId);
    if (!entry || entry.detail.ownerId !== ownerId) {
      return null;
    }

    return this.buildDetail(entry);
  }

  async getPlayerAgentByWorld(ownerId: string, worldId: string): Promise<MyAgentDetail | null> {
    for (const entry of this.entries.values()) {
      if (entry.detail.ownerId === ownerId && entry.detail.worldId === worldId) {
        return this.buildDetail(entry);
      }
    }

    return null;
  }

  async launchPlayerAgent(input: LaunchPlayerAgentInput): Promise<MyAgentDetail> {
    const existing = await this.getPlayerAgentByWorld(input.ownerId, input.detail.worldId);
    if (existing) {
      return existing;
    }

    const requiresSetup = input.detail.authMode === "player_session";
    const setup = requiresSetup
      ? {
          status: "pending_auth" as const,
          authUrl: input.authSession.authUrl,
          expiresAt: undefined,
        }
      : { status: "ready" as const };
    const session: MemoryEntry["session"] = requiresSetup
      ? {
          id: input.authSession.id,
          provider: "cartridge",
          status: "pending",
          authUrl: input.authSession.authUrl,
          authState: input.authSession.authState,
          sessionRef: input.authSession.sessionRef,
          policyFingerprint: input.authSession.policyFingerprint,
          encryptedSignerJson: input.authSession.encryptedSignerJson,
          keyVersion: input.authSession.keyVersion,
        }
      : undefined;
    const detail: MyAgentDetail = {
      ...input.detail,
      ownerId: input.ownerId,
      accountAddress: input.ownerId,
      executionState: requiresSetup ? input.detail.executionState : "idle",
      setup,
      autonomy: {
        enabled: false,
        worldId: input.detail.worldId,
      },
      session,
      activeSession: session,
      history: [],
      recentEvents: [],
    };

    const entry: MemoryEntry = {
      detail,
      events: [],
      messages: [],
      history: [],
      session,
    };

    this.entries.set(detail.id, entry);
    this.appendSetupEvent(detail.id, setup);
    return this.buildDetail(entry);
  }

  async completePlayerAgentSetup(input: CompletePlayerSetupInput): Promise<MyAgentDetail | null> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.session?.id !== input.authSessionId || entry.session?.authState !== input.state) {
      return null;
    }

    entry.session = {
      ...entry.session,
      status: "approved",
      approvedAt: input.approvedSession.approvedAt,
      expiresAt: input.approvedSession.expiresAt,
      cartridgeUsername: input.approvedSession.cartridgeUsername,
      sessionAccountAddress: input.approvedSession.sessionAccountAddress,
    };
    entry.detail = {
      ...entry.detail,
      executionState: "idle",
      setup: { status: "ready" },
      session: entry.session,
      activeSession: entry.session,
    };
    this.entries.set(entry.detail.id, entry);
    this.appendSetupEvent(entry.detail.id, entry.detail.setup);
    return this.buildDetail(entry);
  }

  async updatePlayerAgent(input: UpdatePlayerAgentInput): Promise<MyAgentDetail | null> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.detail.ownerId !== input.ownerId) {
      return null;
    }

    entry.detail = {
      ...entry.detail,
      ...("displayName" in input.patch && input.patch.displayName ? { displayName: input.patch.displayName } : {}),
      ...("desiredState" in input.patch && input.patch.desiredState ? { desiredState: input.patch.desiredState } : {}),
      ...("modelProvider" in input.patch && input.patch.modelProvider
        ? { modelProvider: input.patch.modelProvider }
        : {}),
      ...("modelId" in input.patch && input.patch.modelId ? { modelId: input.patch.modelId } : {}),
      runtimeConfig: input.patch.runtimeConfig ?? entry.detail.runtimeConfig,
      subscriptions: input.patch.subscriptions ?? entry.detail.subscriptions,
    };
    this.entries.set(entry.detail.id, entry);
    return this.buildDetail(entry);
  }

  async setPlayerAgentAutonomy(input: SetPlayerAgentAutonomyInput): Promise<MyAgentDetail | null> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.detail.ownerId !== input.ownerId) {
      return null;
    }

    entry.detail = {
      ...entry.detail,
      executionState: "idle",
      nextWakeAt: input.enabled ? new Date().toISOString() : undefined,
      autonomy: {
        ...entry.detail.autonomy,
        enabled: input.enabled,
        worldId: input.worldId,
        matchId: input.matchId,
        ...(input.enabled
          ? {
              enabledAt: new Date().toISOString(),
              disabledAt: undefined,
            }
          : {
              disabledAt: new Date().toISOString(),
            }),
      },
      activeSteeringJob: entry.detail.activeSteeringJob
        ? {
            ...entry.detail.activeSteeringJob,
            status: input.enabled ? "active" : "paused",
            updatedAt: new Date().toISOString(),
          }
        : entry.detail.activeSteeringJob,
    };
    this.entries.set(entry.detail.id, entry);

    const eventType = input.enabled ? "agent.autonomy_enabled" : "agent.autonomy_disabled";
    this.appendEvent(entry, {
      type: eventType,
      payload: {
        worldId: input.worldId,
        enabled: input.enabled,
        matchId: input.matchId,
        steeringJobType: entry.detail.activeSteeringJob?.type,
      },
    });

    return this.buildDetail(entry);
  }

  async setPlayerAgentSteering(input: SetPlayerAgentSteeringInput): Promise<MyAgentDetail | null> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.detail.ownerId !== input.ownerId) {
      return null;
    }

    const overlay = createSteeringOverlay({
      jobType: input.type,
      config: input.config,
    });
    const steeringState: SteeringJobState = {
      type: input.type,
      status: entry.detail.autonomy.enabled ? "active" : "paused",
      label: getSteeringLabel(input.type),
      summary: overlay.summary,
      config: input.config ?? {},
      startedAt: entry.detail.activeSteeringJob?.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    entry.detail = {
      ...entry.detail,
      activeSteeringJob: steeringState,
    };
    this.entries.set(entry.detail.id, entry);
    this.appendEvent(entry, {
      type: "agent.steering_changed",
      payload: {
        worldId: input.worldId,
        steeringJobType: input.type,
        summary: overlay.summary,
      },
    });
    return this.buildDetail(entry);
  }

  async listPlayerAgentEvents(input: ListPlayerAgentEventsInput): Promise<AgentEvent[]> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.detail.ownerId !== input.ownerId) {
      return [];
    }

    return entry.events.filter((event) => event.seq > (input.afterSeq ?? 0));
  }

  async listPlayerAgentMessages(ownerId: string, agentId: string): Promise<AgentMessage[]> {
    const entry = this.entries.get(agentId);
    if (!entry || entry.detail.ownerId !== ownerId) {
      return [];
    }

    return entry.messages;
  }

  async appendPlayerAgentMessage(input: AppendPlayerAgentMessageInput): Promise<AgentMessage | null> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.detail.ownerId !== input.ownerId) {
      return null;
    }

    entry.messages = [...entry.messages, input.message];
    this.entries.set(entry.detail.id, entry);
    this.appendEvent(entry, {
      type: "agent.chat_sent",
      payload: {
        senderType: input.message.senderType,
      },
    });
    return input.message;
  }

  async listPlayerAgentHistory(ownerId: string, agentId: string): Promise<AgentHistoryEntry[]> {
    const entry = this.entries.get(agentId);
    if (!entry || entry.detail.ownerId !== ownerId) {
      return [];
    }

    return entry.history;
  }

  async resetPlayerAgentSession(input: {
    ownerId: string;
    agentId: string;
    nextAuthSession: LaunchPlayerAgentInput["authSession"];
    nextSetupState: MyAgentDetail["setup"];
  }): Promise<MyAgentDetail | null> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.detail.ownerId !== input.ownerId) {
      return null;
    }

    entry.session = {
      id: input.nextAuthSession.id,
      provider: "cartridge",
      status: "pending",
      authUrl: input.nextAuthSession.authUrl,
      authState: input.nextAuthSession.authState,
      sessionRef: input.nextAuthSession.sessionRef,
      policyFingerprint: input.nextAuthSession.policyFingerprint,
      encryptedSignerJson: input.nextAuthSession.encryptedSignerJson,
      keyVersion: input.nextAuthSession.keyVersion,
    };
    entry.detail = {
      ...entry.detail,
      executionState: "waiting_auth",
      setup: input.nextSetupState,
      session: entry.session,
      activeSession: entry.session,
    };
    this.appendSetupEvent(entry.detail.id, entry.detail.setup);
    return this.buildDetail(entry);
  }

  async invalidatePlayerAgentSession(input: { agentId: string; sessionId: string; reason: string }): Promise<void> {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.session?.id !== input.sessionId) {
      return;
    }

    entry.session = {
      ...entry.session,
      status: "invalidated",
      invalidationReason: input.reason,
    };
    entry.detail = {
      ...entry.detail,
      executionState: "waiting_auth",
      setup: {
        status: "pending_auth",
        authUrl: entry.session.authUrl,
        errorMessage: "World permissions changed. Reauthorize this world agent.",
      },
      session: entry.session,
      activeSession: entry.session,
    };
    this.appendEvent(entry, {
      type: "agent.session_invalidated",
      payload: {
        reason: input.reason,
        previousExpiresAt: entry.session.expiresAt,
      },
    });
  }

  async getActiveSession(ownerId: string, agentId: string): Promise<AgentSessionDetail | null> {
    const detail = await this.getPlayerAgentDetail(ownerId, agentId);
    return detail?.activeSession ?? null;
  }

  async getPendingSetupContext(input: { agentId: string; authSessionId: string }) {
    const entry = this.entries.get(input.agentId);
    if (!entry || entry.session?.id !== input.authSessionId) {
      return null;
    }

    const worldAuth = (entry.detail.runtimeConfig.metadata?.worldAuth ?? {}) as Record<string, unknown>;
    return {
      callbackStateHash: entry.session.authState ? sha256Hex(entry.session.authState) : null,
      policyFingerprint: entry.session.policyFingerprint ?? null,
      encryptedSignerJson: entry.session.encryptedSignerJson ?? null,
      keyVersion: entry.session.keyVersion ?? null,
      worldId: entry.detail.worldId,
      worldName: typeof worldAuth.worldName === "string" ? worldAuth.worldName : undefined,
      chain:
        typeof worldAuth.chain === "string"
          ? (worldAuth.chain as "mainnet" | "sepolia" | "slot" | "slottest" | "local")
          : undefined,
      rpcUrl: typeof worldAuth.rpcUrl === "string" ? worldAuth.rpcUrl : undefined,
      toriiBaseUrl: typeof worldAuth.toriiBaseUrl === "string" ? worldAuth.toriiBaseUrl : undefined,
    };
  }

  private buildDetail(entry: MemoryEntry): MyAgentDetail {
    return {
      ...entry.detail,
      session: entry.session,
      activeSession: entry.session,
      history: entry.detail.history ?? [],
      recentEvents: entry.events.slice(-10).reverse(),
    };
  }

  private appendSetupEvent(agentId: string, setup: MyAgentDetail["setup"]) {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return;
    }

    this.appendEvent(entry, {
      type: "agent.setup_changed",
      payload: setup,
    });
  }

  private appendEvent(entry: MemoryEntry, input: { type: string; payload: Record<string, unknown> }) {
    const event: AgentEvent = {
      id: crypto.randomUUID(),
      agentId: entry.detail.id,
      seq: entry.events.length + 1,
      type: input.type,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };

    entry.events = [...entry.events, event];
    entry.history = [buildHistoryEntry(event), ...entry.history].slice(0, 20);
    this.entries.set(entry.detail.id, entry);
  }
}

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

function buildHistoryEntry(event: AgentEvent): AgentHistoryEntry {
  const title = resolveHistoryTitle(event.type);
  const summary = resolveHistorySummary(event);
  return {
    id: event.id,
    kind: resolveHistoryKind(event.type),
    title,
    summary,
    createdAt: event.createdAt,
    status: typeof event.payload?.status === "string" ? event.payload.status : undefined,
  };
}

function resolveHistoryKind(type: string): AgentHistoryEntry["kind"] {
  if (type === "agent.setup_changed") return "setup";
  if (type === "agent.autonomy_enabled" || type === "agent.autonomy_disabled") return "autonomy";
  if (type === "agent.steering_changed") return "steering";
  if (type === "agent.match_ended") return "match";
  if (type === "agent.error") return "error";
  return "run";
}

function resolveHistoryTitle(type: string): string {
  switch (type) {
    case "agent.setup_changed":
      return "Setup changed";
    case "agent.autonomy_enabled":
      return "Autonomy enabled";
    case "agent.autonomy_disabled":
      return "Autonomy disabled";
    case "agent.steering_changed":
      return "Steering changed";
    case "agent.match_ended":
      return "Match ended";
    case "agent.error":
      return "Agent error";
    default:
      return "Agent activity";
  }
}

function resolveHistorySummary(event: AgentEvent): string {
  if (event.type === "agent.setup_changed") {
    return `Setup status is now ${String(event.payload.status ?? "unknown")}.`;
  }

  if (event.type === "agent.steering_changed") {
    return String(event.payload.summary ?? "Steering updated.");
  }

  if (event.type === "agent.autonomy_enabled") {
    return "Autonomy enabled for the current world.";
  }

  if (event.type === "agent.autonomy_disabled") {
    return "Autonomy disabled for the current world.";
  }

  return "Recent agent activity recorded.";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
