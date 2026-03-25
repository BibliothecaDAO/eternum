import { and, asc, desc, eq, lte, max, ne, or } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  agentEvents,
  agentRuns,
  agents,
  agentSessions,
  saveAgentArtifacts,
  type AgentArtifactStore,
} from "@bibliothecadao/agent-runtime";
import type { AgentTurnResult } from "@bibliothecadao/agent-runtime";
import type { AgentEvent, AgentRunJob } from "@bibliothecadao/types";
import type { CartridgeStoredSessionLoader } from "../sessions/cartridge-stored-session-resolver";

const ARTIFACT_FILES = [
  "soul.md",
  "memory.md",
  "tasks/priorities.md",
  "tasks/combat.md",
  "tasks/economy.md",
  "tasks/exploration.md",
  "tasks/reflection.md",
  "automation-status.txt",
];

export class ExecutorRunStore implements CartridgeStoredSessionLoader {
  constructor(
    private readonly db: any,
    private readonly artifactStore: AgentArtifactStore,
  ) {}

  async listDueAgentJobs(now: Date): Promise<AgentRunJob[]> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.ownerType, "player"),
          eq(agents.autonomyEnabled, true),
          eq(agents.setupStatus, "ready"),
          eq(agents.desiredState, "running"),
          or(
            eq(agents.executionState, "idle"),
            eq(agents.executionState, "queued"),
            eq(agents.executionState, "cooldown"),
          ),
          ne(agents.executionState, "running"),
          lte(agents.nextWakeAt, now),
        ),
      )
      .orderBy(asc(agents.nextWakeAt))
      .limit(20);

    return rows.map((row: typeof agents.$inferSelect) => ({
      jobId: crypto.randomUUID(),
      agentId: row.id,
      wakeReason: "scheduled_tick",
      coalescedEventIds: [],
      leaseId: crypto.randomUUID(),
      priority: 1,
      requestedAt: now.toISOString(),
    }));
  }

  async markQueued(job: AgentRunJob): Promise<void> {
    await this.db
      .update(agents)
      .set({
        executionState: "queued",
        updatedAt: new Date(),
      })
      .where(eq(agents.id, job.agentId));
  }

  async markRunning(job: AgentRunJob): Promise<void> {
    await this.db
      .update(agents)
      .set({
        executionState: "running",
        lastRunStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, job.agentId));
  }

  async loadAgentExecutionConfig(agentId: string) {
    const [row] = await this.db.select().from(agents).where(eq(agents.id, agentId)).limit(1);

    if (!row) {
      return null;
    }

    return {
      modelProvider: row.modelProvider,
      modelId: row.modelId,
      tickIntervalMs:
        typeof row.runtimeConfigJson?.tickIntervalMs === "number" ? row.runtimeConfigJson.tickIntervalMs : 15_000,
    };
  }

  async load(agentId: string) {
    const [agentRow, sessionRow] = await Promise.all([
      this.db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1)
        .then((rows: any[]) => rows[0] ?? null),
      this.db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.agentId, agentId))
        .orderBy(desc(agentSessions.createdAt))
        .limit(1)
        .then((rows: any[]) => rows[0] ?? null),
    ]);

    if (!agentRow || !sessionRow) {
      return null;
    }

    const worldAuth = (agentRow.runtimeConfigJson?.metadata?.worldAuth ?? {}) as Record<string, unknown>;
    return {
      status: sessionRow.status as "pending" | "approved" | "expired" | "revoked" | "invalidated" | "error",
      worldId: agentRow.worldId,
      worldName: typeof worldAuth.worldName === "string" ? worldAuth.worldName : undefined,
      chain:
        typeof worldAuth.chain === "string"
          ? (worldAuth.chain as "mainnet" | "sepolia" | "slot" | "slottest" | "local")
          : undefined,
      rpcUrl: typeof worldAuth.rpcUrl === "string" ? worldAuth.rpcUrl : undefined,
      toriiBaseUrl: typeof worldAuth.toriiBaseUrl === "string" ? worldAuth.toriiBaseUrl : undefined,
      policyFingerprint: sessionRow.policyFingerprint ?? undefined,
      encryptedSessionJson: sessionRow.encryptedSessionJson ?? undefined,
      expiresAt: sessionRow.expiresAt?.toISOString(),
      sessionAccountAddress: sessionRow.sessionAccountAddress ?? undefined,
      cartridgeUsername: sessionRow.cartridgeUsername ?? undefined,
    };
  }

  async persistRun(
    job: AgentRunJob,
    result: AgentTurnResult,
    input: {
      dataDir: string;
      events: AgentEvent[];
      nextWakeAt?: Date;
      errorCode?: string;
      errorMessage?: string;
    },
  ) {
    await this.db.transaction(async (tx: any) => {
      await tx.insert(agentRuns).values({
        id: job.jobId,
        agentId: job.agentId,
        leaseId: job.leaseId,
        wakeReason: job.wakeReason,
        status: result.success ? "completed" : "failed",
        snapshotVersion: job.snapshotVersion ?? null,
        toolCalls: result.toolCalls,
        mutatingActions: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: "0",
        startedAt: new Date(result.startedAt),
        finishedAt: new Date(result.finishedAt),
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? result.errorMessage ?? null,
      });

      for (const event of input.events) {
        const [seq] = await tx
          .select({ value: max(agentEvents.seq) })
          .from(agentEvents)
          .where(eq(agentEvents.agentId, job.agentId));
        await tx.insert(agentEvents).values({
          id: event.id,
          agentId: job.agentId,
          seq: (seq?.value ?? 0) + 1,
          type: event.type,
          payloadJson: event.payload ?? {},
          createdAt: new Date(event.createdAt),
        });
      }

      await tx
        .update(agents)
        .set({
          executionState: result.success ? "idle" : "error",
          lastRunStartedAt: new Date(result.startedAt),
          lastRunFinishedAt: new Date(result.finishedAt),
          lastErrorCode: input.errorCode ?? null,
          lastErrorMessage: input.errorMessage ?? result.errorMessage ?? null,
          nextWakeAt: input.nextWakeAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, job.agentId));
    });

    await saveAgentArtifacts({
      agentId: job.agentId,
      files: await collectArtifacts(input.dataDir),
      store: this.artifactStore,
    });
  }

  async persistRunFailure(input: { job: AgentRunJob; errorMessage: string; startedAt?: string; finishedAt?: string }) {
    const startedAt = new Date(input.startedAt ?? new Date().toISOString());
    const finishedAt = new Date(input.finishedAt ?? new Date().toISOString());

    await this.db.transaction(async (tx: any) => {
      await tx.insert(agentRuns).values({
        id: input.job.jobId,
        agentId: input.job.agentId,
        leaseId: input.job.leaseId,
        wakeReason: input.job.wakeReason,
        status: "failed",
        snapshotVersion: input.job.snapshotVersion ?? null,
        toolCalls: 0,
        mutatingActions: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: "0",
        startedAt,
        finishedAt,
        errorCode: "executor_runtime_error",
        errorMessage: input.errorMessage,
      });

      await tx
        .update(agents)
        .set({
          executionState: "error",
          lastRunStartedAt: startedAt,
          lastRunFinishedAt: finishedAt,
          lastErrorCode: "executor_runtime_error",
          lastErrorMessage: input.errorMessage,
          nextWakeAt: null,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, input.job.agentId));

      await appendEvent(tx, input.job.agentId, "agent.error", {
        errorMessage: input.errorMessage,
        summary: "Agent execution failed before the turn could complete.",
      });
    });
  }

  async markSessionExpired(agentId: string, reason: string) {
    await this.db.transaction(async (tx: any) => {
      await tx
        .update(agentSessions)
        .set({
          status: "expired",
          errorMessage: reason,
          updatedAt: new Date(),
        })
        .where(eq(agentSessions.agentId, agentId));

      await tx
        .update(agents)
        .set({
          setupStatus: "pending_auth",
          executionState: "waiting_auth",
          setupErrorMessage: reason,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      await appendEvent(tx, agentId, "agent.session_invalidated", { reason });
      await appendEvent(tx, agentId, "agent.setup_changed", { status: "pending_auth", errorMessage: reason });
    });
  }

  async markSessionInvalidated(agentId: string, reason: string) {
    await this.db.transaction(async (tx: any) => {
      await tx
        .update(agentSessions)
        .set({
          status: "invalidated",
          invalidatedAt: new Date(),
          invalidationReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(agentSessions.agentId, agentId));

      await tx
        .update(agents)
        .set({
          setupStatus: "pending_auth",
          executionState: "waiting_auth",
          setupErrorMessage: reason,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      await appendEvent(tx, agentId, "agent.session_invalidated", { reason });
      await appendEvent(tx, agentId, "agent.setup_changed", { status: "pending_auth", errorMessage: reason });
    });
  }
}

async function appendEvent(tx: any, agentId: string, type: string, payload: Record<string, unknown>) {
  const [seq] = await tx
    .select({ value: max(agentEvents.seq) })
    .from(agentEvents)
    .where(eq(agentEvents.agentId, agentId));
  await tx.insert(agentEvents).values({
    id: crypto.randomUUID(),
    agentId,
    seq: (seq?.value ?? 0) + 1,
    type,
    payloadJson: payload,
    createdAt: new Date(),
  });
}

async function collectArtifacts(dataDir: string) {
  const pairs = await Promise.all(
    ARTIFACT_FILES.map(async (relativePath) => {
      const filePath = join(dataDir, relativePath);
      try {
        return [relativePath, await readFile(filePath, "utf8")] as const;
      } catch {
        return [relativePath, ""] as const;
      }
    }),
  );
  return Object.fromEntries(pairs);
}
