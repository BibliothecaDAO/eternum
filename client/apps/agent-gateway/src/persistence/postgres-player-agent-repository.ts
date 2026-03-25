import { and, asc, desc, eq, gt, max } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  agentEvents,
  agentRuns,
  agentSessions,
  agentThreadMessages,
  agentThreads,
  agents,
} from "@bibliothecadao/agent-runtime";
import { createSteeringOverlay, getSteeringLabel } from "@bibliothecadao/agent-runtime";
import type {
  AgentDetail,
  AgentEvent,
  AgentHistoryEntry,
  AgentMessage,
  AgentRunSummary,
  AgentSessionDetail,
  AgentSessionSummary,
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

export class PostgresPlayerAgentRepository implements PlayerAgentRepository {
  constructor(private readonly db: any) {}

  async listPlayerAgents(ownerId: string): Promise<MyAgentSummary[]> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.ownerType, "player"), eq(agents.ownerId, ownerId)))
      .orderBy(asc(agents.createdAt));

    return rows.map(buildSummaryFromRow);
  }

  async getPlayerAgentDetail(ownerId: string, agentId: string): Promise<MyAgentDetail | null> {
    const row = await this.loadAgentRow(ownerId, agentId);
    if (!row) {
      return null;
    }

    return this.buildAgentDetail(row);
  }

  async getPlayerAgentByWorld(ownerId: string, worldId: string): Promise<MyAgentDetail | null> {
    const [row] = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.ownerType, "player"), eq(agents.ownerId, ownerId), eq(agents.worldId, worldId)))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.buildAgentDetail(row);
  }

  async launchPlayerAgent(input: LaunchPlayerAgentInput): Promise<MyAgentDetail> {
    const existing = await this.getPlayerAgentByWorld(input.ownerId, input.detail.worldId);
    if (existing) {
      return existing;
    }

    const requiresSetup = input.detail.authMode === "player_session";
    const setup: MyAgentDetail["setup"] = requiresSetup
      ? buildPendingSetup(input.baseUrl, input.detail.id)
      : buildReadySetup();
    await this.db.transaction(async (tx: any) => {
      await tx.insert(agents).values({
        id: input.detail.id,
        kind: input.detail.kind,
        ownerType: "player",
        ownerId: input.ownerId,
        worldId: input.detail.worldId,
        displayName: input.detail.displayName,
        desiredState: input.detail.desiredState,
        executionState: requiresSetup ? input.detail.executionState : "idle",
        runtimeConfigJson: input.detail.runtimeConfig ?? {},
        subscriptionJson: input.detail.subscriptions ?? [],
        modelProvider: input.detail.modelProvider,
        modelId: input.detail.modelId,
        authMode: input.detail.authMode,
        accountAddress: input.ownerId,
        activeSessionId: input.authSession.id,
        setupStatus: setup.status,
        setupAuthUrl: input.authSession.authUrl,
        setupExpiresAt: setup.expiresAt ? new Date(setup.expiresAt) : null,
        setupErrorMessage: setup.errorMessage,
        autonomyEnabled: false,
      });

      await tx.insert(agentThreads).values({
        id: buildThreadId(input.detail.id),
        agentId: input.detail.id,
        ownerId: input.ownerId,
      });

      if (requiresSetup) {
        await tx.insert(agentSessions).values({
          id: input.authSession.id,
          agentId: input.detail.id,
          provider: "cartridge",
          status: "pending",
          sessionRef: input.authSession.sessionRef,
          callbackStateHash: sha256Hex(input.authSession.authState),
          redirectUri: input.authSession.redirectUri,
          policyFingerprint: input.authSession.policyFingerprint,
          encryptedSignerJson: input.authSession.encryptedSignerJson,
          keyVersion: input.authSession.keyVersion,
          authUrl: input.authSession.authUrl,
          expiresAt: setup.expiresAt ? new Date(setup.expiresAt) : null,
        });
      }

      await this.insertEvent(tx, input.detail.id, "agent.setup_changed", setup);
    });

    return (await this.getPlayerAgentDetail(input.ownerId, input.detail.id))!;
  }

  async completePlayerAgentSetup(input: CompletePlayerSetupInput): Promise<MyAgentDetail | null> {
    const [session] = await this.db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.agentId, input.agentId), eq(agentSessions.id, input.authSessionId)))
      .orderBy(desc(agentSessions.createdAt))
      .limit(1);

    if (!session || session.callbackStateHash !== sha256Hex(input.state)) {
      return null;
    }

    const approvedAt = new Date(input.approvedSession.approvedAt);
    await this.db.transaction(async (tx: any) => {
      await tx
        .update(agentSessions)
        .set({
          status: "approved",
          encryptedSessionJson: input.approvedSession.encryptedSessionJson,
          sessionAccountAddress: input.approvedSession.sessionAccountAddress,
          cartridgeUsername: input.approvedSession.cartridgeUsername,
          callbackReceivedAt: approvedAt,
          expiresAt: input.approvedSession.expiresAt ? new Date(input.approvedSession.expiresAt) : null,
          approvedAt,
          updatedAt: approvedAt,
          lastVerifiedAt: approvedAt,
        })
        .where(eq(agentSessions.id, session.id));

      await tx
        .update(agents)
        .set({
          executionState: "idle",
          setupStatus: "ready",
          setupAuthUrl: null,
          setupExpiresAt: null,
          setupErrorMessage: null,
          updatedAt: approvedAt,
        })
        .where(eq(agents.id, input.agentId));

      await this.insertEvent(tx, input.agentId, "agent.setup_changed", {
        status: "ready",
      });
    });

    const [agentRow] = await this.db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
    if (!agentRow) {
      return null;
    }

    return this.buildAgentDetail(agentRow);
  }

  async updatePlayerAgent(input: UpdatePlayerAgentInput): Promise<MyAgentDetail | null> {
    const row = await this.loadAgentRow(input.ownerId, input.agentId);
    if (!row) {
      return null;
    }

    await this.db
      .update(agents)
      .set({
        ...(input.patch.displayName ? { displayName: input.patch.displayName } : {}),
        ...(input.patch.desiredState ? { desiredState: input.patch.desiredState } : {}),
        ...(input.patch.modelProvider ? { modelProvider: input.patch.modelProvider } : {}),
        ...(input.patch.modelId ? { modelId: input.patch.modelId } : {}),
        ...(input.patch.runtimeConfig ? { runtimeConfigJson: input.patch.runtimeConfig } : {}),
        ...(input.patch.subscriptions ? { subscriptionJson: input.patch.subscriptions } : {}),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, input.agentId));

    return this.getPlayerAgentDetail(input.ownerId, input.agentId);
  }

  async setPlayerAgentAutonomy(input: SetPlayerAgentAutonomyInput): Promise<MyAgentDetail | null> {
    const row = await this.loadAgentRow(input.ownerId, input.agentId);
    if (!row) {
      return null;
    }

    const now = new Date();
    await this.db.transaction(async (tx: any) => {
      await tx
        .update(agents)
        .set({
          executionState: "idle",
          autonomyEnabled: input.enabled,
          autonomyMatchId: input.enabled ? (input.matchId ?? null) : null,
          autonomyEnabledAt: input.enabled ? now : row.autonomyEnabledAt,
          autonomyDisabledAt: input.enabled ? null : now,
          nextWakeAt: input.enabled ? now : null,
          steeringJobStatus: row.steeringJobType ? (input.enabled ? "active" : "paused") : row.steeringJobStatus,
          steeringUpdatedAt: row.steeringJobType ? now : row.steeringUpdatedAt,
          updatedAt: now,
        })
        .where(eq(agents.id, input.agentId));

      await this.insertEvent(tx, input.agentId, input.enabled ? "agent.autonomy_enabled" : "agent.autonomy_disabled", {
        worldId: input.worldId,
        enabled: input.enabled,
        matchId: input.matchId,
        steeringJobType: row.steeringJobType ?? undefined,
      });
    });

    return this.getPlayerAgentDetail(input.ownerId, input.agentId);
  }

  async setPlayerAgentSteering(input: SetPlayerAgentSteeringInput): Promise<MyAgentDetail | null> {
    const row = await this.loadAgentRow(input.ownerId, input.agentId);
    if (!row) {
      return null;
    }

    const overlay = createSteeringOverlay({
      jobType: input.type,
      config: input.config,
    });
    const now = new Date();

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(agents)
        .set({
          steeringJobType: input.type,
          steeringJobStatus: row.autonomyEnabled ? "active" : "paused",
          steeringJobLabel: getSteeringLabel(input.type),
          steeringJobSummary: overlay.summary,
          steeringJobConfigJson: input.config ?? {},
          steeringStartedAt: row.steeringStartedAt ?? now,
          steeringUpdatedAt: now,
          steeringEndedAt: null,
          updatedAt: now,
        })
        .where(eq(agents.id, input.agentId));

      await this.insertEvent(tx, input.agentId, "agent.steering_changed", {
        worldId: input.worldId,
        steeringJobType: input.type,
        summary: overlay.summary,
      });
    });

    return this.getPlayerAgentDetail(input.ownerId, input.agentId);
  }

  async listPlayerAgentEvents(input: ListPlayerAgentEventsInput): Promise<AgentEvent[]> {
    const row = await this.loadAgentRow(input.ownerId, input.agentId);
    if (!row) {
      return [];
    }

    const eventsForAgent = await this.db
      .select()
      .from(agentEvents)
      .where(and(eq(agentEvents.agentId, input.agentId), gt(agentEvents.seq, input.afterSeq ?? 0)))
      .orderBy(asc(agentEvents.seq));

    return eventsForAgent.map(mapEventRow);
  }

  async listPlayerAgentMessages(ownerId: string, agentId: string): Promise<AgentMessage[]> {
    const thread = await this.loadThread(ownerId, agentId);
    if (!thread) {
      return [];
    }

    const messagesForThread = await this.db
      .select()
      .from(agentThreadMessages)
      .where(eq(agentThreadMessages.threadId, thread.id))
      .orderBy(asc(agentThreadMessages.createdAt));

    return messagesForThread.map(mapMessageRow);
  }

  async appendPlayerAgentMessage(input: AppendPlayerAgentMessageInput): Promise<AgentMessage | null> {
    const thread = await this.loadThread(input.ownerId, input.agentId);
    if (!thread) {
      return null;
    }

    await this.db.transaction(async (tx: any) => {
      await tx.insert(agentThreadMessages).values({
        id: input.message.id,
        threadId: thread.id,
        senderType: input.message.senderType,
        senderId: input.message.senderId,
        content: input.message.content,
        metadataJson: input.message.metadata ?? {},
        createdAt: new Date(input.message.createdAt),
      });

      await tx
        .update(agentThreads)
        .set({
          updatedAt: new Date(input.message.createdAt),
        })
        .where(eq(agentThreads.id, thread.id));

      await this.insertEvent(tx, input.agentId, "agent.chat_sent", {
        senderType: input.message.senderType,
      });
    });

    return input.message;
  }

  async listPlayerAgentHistory(ownerId: string, agentId: string): Promise<AgentHistoryEntry[]> {
    const row = await this.loadAgentRow(ownerId, agentId);
    if (!row) {
      return [];
    }

    const [runs, eventsForHistory] = await Promise.all([
      this.db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.agentId, agentId))
        .orderBy(desc(agentRuns.startedAt))
        .limit(10),
      this.db
        .select()
        .from(agentEvents)
        .where(eq(agentEvents.agentId, agentId))
        .orderBy(desc(agentEvents.createdAt))
        .limit(20),
    ]);

    return [
      ...runs.map(mapRunToHistoryEntry),
      ...eventsForHistory.map((event: typeof agentEvents.$inferSelect) => mapEventToHistoryEntry(mapEventRow(event))),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 20);
  }

  async resetPlayerAgentSession(input: {
    ownerId: string;
    agentId: string;
    nextAuthSession: LaunchPlayerAgentInput["authSession"];
    nextSetupState: MyAgentDetail["setup"];
  }): Promise<MyAgentDetail | null> {
    const row = await this.loadAgentRow(input.ownerId, input.agentId);
    if (!row) {
      return null;
    }

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(agentSessions)
        .set({
          status: "revoked",
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(agentSessions.agentId, input.agentId), eq(agentSessions.id, row.activeSessionId ?? "")));

      await tx.insert(agentSessions).values({
        id: input.nextAuthSession.id,
        agentId: input.agentId,
        provider: "cartridge",
        status: "pending",
        sessionRef: input.nextAuthSession.sessionRef,
        callbackStateHash: sha256Hex(input.nextAuthSession.authState),
        redirectUri: input.nextAuthSession.redirectUri,
        policyFingerprint: input.nextAuthSession.policyFingerprint,
        encryptedSignerJson: input.nextAuthSession.encryptedSignerJson,
        keyVersion: input.nextAuthSession.keyVersion,
        authUrl: input.nextAuthSession.authUrl,
      });

      await tx
        .update(agents)
        .set({
          activeSessionId: input.nextAuthSession.id,
          executionState: "waiting_auth",
          setupStatus: input.nextSetupState.status,
          setupAuthUrl: input.nextSetupState.authUrl ?? null,
          setupExpiresAt: input.nextSetupState.expiresAt ? new Date(input.nextSetupState.expiresAt) : null,
          setupErrorMessage: input.nextSetupState.errorMessage ?? null,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, input.agentId));

      await this.insertEvent(tx, input.agentId, "agent.setup_changed", input.nextSetupState);
    });

    return this.getPlayerAgentDetail(input.ownerId, input.agentId);
  }

  async invalidatePlayerAgentSession(input: { agentId: string; sessionId: string; reason: string }): Promise<void> {
    await this.db.transaction(async (tx: any) => {
      const now = new Date();
      await tx
        .update(agentSessions)
        .set({
          status: "invalidated",
          invalidatedAt: now,
          invalidationReason: input.reason,
          updatedAt: now,
        })
        .where(and(eq(agentSessions.agentId, input.agentId), eq(agentSessions.id, input.sessionId)));

      await tx
        .update(agents)
        .set({
          executionState: "waiting_auth",
          setupStatus: "pending_auth",
          setupErrorMessage: "World permissions changed. Reauthorize this world agent.",
          updatedAt: now,
        })
        .where(eq(agents.id, input.agentId));

      await this.insertEvent(tx, input.agentId, "agent.session_invalidated", {
        reason: input.reason,
      });
      await this.insertEvent(tx, input.agentId, "agent.setup_changed", {
        status: "pending_auth",
        errorMessage: "World permissions changed. Reauthorize this world agent.",
      });
    });
  }

  async getActiveSession(ownerId: string, agentId: string): Promise<AgentSessionDetail | null> {
    const detail = await this.getPlayerAgentDetail(ownerId, agentId);
    return detail?.activeSession ?? null;
  }

  async getPendingSetupContext(input: { agentId: string; authSessionId: string }) {
    const [session, row] = await Promise.all([
      this.db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.agentId, input.agentId), eq(agentSessions.id, input.authSessionId)))
        .limit(1)
        .then((rows: Array<typeof agentSessions.$inferSelect>) => rows[0] ?? null),
      this.db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1)
        .then((rows: Array<typeof agents.$inferSelect>) => rows[0] ?? null),
    ]);

    if (!session || !row) {
      return null;
    }

    const worldAuth = ((row.runtimeConfigJson?.metadata as Record<string, unknown> | undefined)?.worldAuth ??
      {}) as Record<string, unknown>;

    return {
      callbackStateHash: session.callbackStateHash ?? null,
      policyFingerprint: session.policyFingerprint ?? null,
      encryptedSignerJson: (session.encryptedSignerJson as Record<string, unknown> | null) ?? null,
      keyVersion: session.keyVersion ?? null,
      worldId: row.worldId,
      worldName: typeof worldAuth.worldName === "string" ? worldAuth.worldName : undefined,
      chain:
        typeof worldAuth.chain === "string"
          ? (worldAuth.chain as "mainnet" | "sepolia" | "slot" | "slottest" | "local")
          : undefined,
      rpcUrl: typeof worldAuth.rpcUrl === "string" ? worldAuth.rpcUrl : undefined,
      toriiBaseUrl: typeof worldAuth.toriiBaseUrl === "string" ? worldAuth.toriiBaseUrl : undefined,
    };
  }

  private async buildAgentDetail(row: typeof agents.$inferSelect): Promise<MyAgentDetail> {
    const [sessionRow, latestRunRow, eventRows] = await Promise.all([
      this.loadLatestSession(row.id),
      this.loadLatestRun(row.id),
      this.db
        .select()
        .from(agentEvents)
        .where(eq(agentEvents.agentId, row.id))
        .orderBy(desc(agentEvents.seq))
        .limit(10),
    ]);

    return {
      id: row.id,
      kind: row.kind as AgentDetail["kind"],
      ownerType: row.ownerType as AgentDetail["ownerType"],
      ownerId: row.ownerId,
      worldId: row.worldId,
      displayName: row.displayName,
      desiredState: row.desiredState as AgentDetail["desiredState"],
      executionState: row.executionState as AgentDetail["executionState"],
      modelProvider: row.modelProvider,
      modelId: row.modelId,
      authMode: row.authMode as AgentDetail["authMode"],
      accountAddress: row.accountAddress ?? undefined,
      runtimeConfig: row.runtimeConfigJson ?? {},
      subscriptions: (row.subscriptionJson ?? []) as MyAgentDetail["subscriptions"],
      nextWakeAt: row.nextWakeAt?.toISOString(),
      lastRunFinishedAt: row.lastRunFinishedAt?.toISOString(),
      lastErrorCode: row.lastErrorCode ?? undefined,
      lastErrorMessage: row.lastErrorMessage ?? undefined,
      latestRun: latestRunRow ? mapRunRow(latestRunRow) : undefined,
      session: sessionRow ? mapSessionRow(sessionRow) : undefined,
      activeSession: sessionRow ? mapSessionDetailRow(sessionRow) : undefined,
      setup: buildSetupState(row, sessionRow ?? undefined),
      autonomy: buildAutonomyState(row),
      activeSteeringJob: buildSteeringState(row),
      history: latestRunRow ? [mapRunRow(latestRunRow)] : [],
      recentEvents: eventRows.map(mapEventRow),
    };
  }

  private async loadAgentRow(ownerId: string, agentId: string) {
    const [row] = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.ownerType, "player"), eq(agents.ownerId, ownerId)))
      .limit(1);

    return row;
  }

  private async loadLatestSession(agentId: string) {
    const [session] = await this.db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.agentId, agentId))
      .orderBy(desc(agentSessions.createdAt))
      .limit(1);

    return session;
  }

  private async loadLatestRun(agentId: string) {
    const [run] = await this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.agentId, agentId))
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);

    return run;
  }

  private async loadThread(ownerId: string, agentId: string) {
    const [thread] = await this.db
      .select()
      .from(agentThreads)
      .where(and(eq(agentThreads.agentId, agentId), eq(agentThreads.ownerId, ownerId)))
      .limit(1);

    return thread;
  }

  private async insertEvent(tx: any, agentId: string, type: string, payload: Record<string, unknown>) {
    const [seqRow] = await tx
      .select({ value: max(agentEvents.seq) })
      .from(agentEvents)
      .where(eq(agentEvents.agentId, agentId));
    await tx.insert(agentEvents).values({
      id: crypto.randomUUID(),
      agentId,
      seq: (seqRow?.value ?? 0) + 1,
      type,
      payloadJson: payload,
    });
  }
}

function buildPendingSetup(baseUrl: string, agentId: string): MyAgentDetail["setup"] {
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const token = crypto.randomUUID();
  return {
    status: "pending_auth" as const,
    authUrl: new URL(`/my/agents/${agentId}/setup/complete?token=${token}`, baseUrl).toString(),
    expiresAt,
  };
}

function buildReadySetup(): MyAgentDetail["setup"] {
  return {
    status: "ready" as const,
  };
}

function buildSummaryFromRow(row: typeof agents.$inferSelect): MyAgentSummary {
  return {
    id: row.id,
    kind: row.kind as MyAgentSummary["kind"],
    ownerType: row.ownerType as MyAgentSummary["ownerType"],
    ownerId: row.ownerId,
    worldId: row.worldId,
    displayName: row.displayName,
    desiredState: row.desiredState as MyAgentSummary["desiredState"],
    executionState: row.executionState as MyAgentSummary["executionState"],
    modelProvider: row.modelProvider,
    modelId: row.modelId,
    nextWakeAt: row.nextWakeAt?.toISOString(),
    lastRunFinishedAt: row.lastRunFinishedAt?.toISOString(),
    lastErrorCode: row.lastErrorCode ?? undefined,
    lastErrorMessage: row.lastErrorMessage ?? undefined,
    setup: buildSetupState(row),
    autonomy: buildAutonomyState(row),
    activeSteeringJob: buildSteeringState(row),
  };
}

function buildSetupState(
  row: typeof agents.$inferSelect,
  session?: typeof agentSessions.$inferSelect,
): MyAgentDetail["setup"] {
  const isPendingSetup = row.setupStatus === "pending_auth" || row.setupStatus === "launching";
  return {
    status: row.setupStatus as MyAgentDetail["setup"]["status"],
    authUrl: isPendingSetup ? (row.setupAuthUrl ?? session?.authUrl ?? undefined) : undefined,
    expiresAt: row.setupExpiresAt?.toISOString() ?? session?.expiresAt?.toISOString(),
    errorMessage: row.setupErrorMessage ?? session?.errorMessage ?? undefined,
  };
}

function buildAutonomyState(row: typeof agents.$inferSelect): MyAgentDetail["autonomy"] {
  return {
    enabled: row.autonomyEnabled,
    worldId: row.worldId,
    matchId: row.autonomyMatchId ?? undefined,
    enabledAt: row.autonomyEnabledAt?.toISOString(),
    disabledAt: row.autonomyDisabledAt?.toISOString(),
  };
}

function buildSteeringState(row: typeof agents.$inferSelect): SteeringJobState | undefined {
  if (!row.steeringJobType || !row.steeringJobStatus || !row.steeringJobLabel || !row.steeringJobSummary) {
    return undefined;
  }

  return {
    type: row.steeringJobType as SteeringJobState["type"],
    status: row.steeringJobStatus as SteeringJobState["status"],
    label: row.steeringJobLabel,
    summary: row.steeringJobSummary,
    config: row.steeringJobConfigJson ?? {},
    startedAt: row.steeringStartedAt?.toISOString(),
    updatedAt: row.steeringUpdatedAt?.toISOString(),
    endedAt: row.steeringEndedAt?.toISOString(),
  };
}

function buildThreadId(agentId: string) {
  return `thread:${agentId}`;
}

function mapSessionRow(row: typeof agentSessions.$inferSelect): AgentSessionSummary {
  return {
    id: row.id,
    provider: row.provider as AgentSessionSummary["provider"],
    status: row.status as AgentSessionSummary["status"],
    authUrl: row.authUrl ?? undefined,
    expiresAt: row.expiresAt?.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
  };
}

function mapSessionDetailRow(row: typeof agentSessions.$inferSelect): AgentSessionDetail {
  return {
    ...mapSessionRow(row),
    cartridgeUsername: row.cartridgeUsername ?? undefined,
    sessionAccountAddress: row.sessionAccountAddress ?? undefined,
    invalidationReason: row.invalidationReason ?? undefined,
  };
}

function mapRunRow(row: typeof agentRuns.$inferSelect): AgentRunSummary {
  return {
    id: row.id,
    agentId: row.agentId,
    leaseId: row.leaseId,
    wakeReason: row.wakeReason as AgentRunSummary["wakeReason"],
    status: row.status as AgentRunSummary["status"],
    snapshotVersion: row.snapshotVersion ?? undefined,
    toolCalls: row.toolCalls,
    mutatingActions: row.mutatingActions,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    estimatedCostUsd: Number(row.estimatedCostUsd),
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString(),
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  };
}

function mapEventRow(row: typeof agentEvents.$inferSelect): AgentEvent {
  return {
    id: row.id,
    agentId: row.agentId,
    seq: row.seq,
    type: row.type,
    payload: row.payloadJson ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

function mapMessageRow(row: typeof agentThreadMessages.$inferSelect): AgentMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    senderType: row.senderType as AgentMessage["senderType"],
    senderId: row.senderId,
    content: row.content,
    metadata: (row.metadataJson as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRunToHistoryEntry(row: typeof agentRuns.$inferSelect): AgentHistoryEntry {
  return {
    id: row.id,
    kind: "run",
    title: `Run ${row.status}`,
    summary: `Wake reason: ${row.wakeReason}.`,
    createdAt: row.finishedAt?.toISOString() ?? row.startedAt.toISOString(),
    status: row.status,
    wakeReason: row.wakeReason as AgentHistoryEntry["wakeReason"],
  };
}

function mapEventToHistoryEntry(event: AgentEvent): AgentHistoryEntry {
  return {
    id: event.id,
    kind: resolveHistoryKind(event.type),
    title: resolveHistoryTitle(event.type),
    summary: resolveHistorySummary(event),
    createdAt: event.createdAt,
    status: typeof event.payload.status === "string" ? event.payload.status : undefined,
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

  if (event.type === "agent.match_ended") {
    return String(event.payload.summary ?? "The match ended.");
  }

  return "Recent agent activity recorded.";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
