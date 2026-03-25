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
import { resolveStaleExecutionThresholdMs, resolveTurnTimeoutMs } from "./executor-execution-policy";

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

  async claimDueAgentJobs(now: Date): Promise<AgentRunJob[]> {
    await this.recoverStaleExecutions(now);

    const rows = await this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.ownerType, "player"),
          eq(agents.autonomyEnabled, true),
          eq(agents.setupStatus, "ready"),
          eq(agents.desiredState, "running"),
          or(eq(agents.executionState, "idle"), eq(agents.executionState, "cooldown")),
          lte(agents.nextWakeAt, now),
        ),
      )
      .orderBy(asc(agents.nextWakeAt))
      .limit(20);

    const claimedJobs: AgentRunJob[] = [];
    for (const row of rows) {
      const [claimed] = await this.db
        .update(agents)
        .set({
          executionState: "queued",
          updatedAt: now,
        })
        .where(
          and(
            eq(agents.id, row.id),
            or(eq(agents.executionState, "idle"), eq(agents.executionState, "cooldown")),
            lte(agents.nextWakeAt, now),
          ),
        )
        .returning({ id: agents.id });

      if (claimed) {
        claimedJobs.push(buildAgentRunJob(row.id, "scheduled_tick", 1, now));
      }
    }

    return claimedJobs;
  }

  async claimImmediateJob(job: AgentRunJob): Promise<boolean> {
    const [claimed] = await this.db
      .update(agents)
      .set({
        executionState: "queued",
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, job.agentId), ne(agents.executionState, "running")))
      .returning({ id: agents.id });

    return Boolean(claimed);
  }

  async markRunning(job: AgentRunJob): Promise<boolean> {
    const [claimed] = await this.db
      .update(agents)
      .set({
        executionState: "running",
        lastRunStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, job.agentId), eq(agents.executionState, "queued")))
      .returning({ id: agents.id });

    return Boolean(claimed);
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
      turnTimeoutMs: resolveTurnTimeoutMs(row.runtimeConfigJson, readExecutorTurnTimeoutEnv()),
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

  async persistRunFailure(input: {
    job: AgentRunJob;
    errorCode: string;
    errorMessage: string;
    executionState?: string;
    nextWakeAt?: Date | null;
    startedAt?: string;
    finishedAt?: string;
    summary?: string;
    additionalEvents?: Array<{ type: string; payload: Record<string, unknown> }>;
  }) {
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
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      });

      await tx
        .update(agents)
        .set({
          executionState: input.executionState ?? "error",
          lastRunStartedAt: startedAt,
          lastRunFinishedAt: finishedAt,
          lastErrorCode: input.errorCode,
          lastErrorMessage: input.errorMessage,
          nextWakeAt: input.nextWakeAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, input.job.agentId));

      await appendEvent(tx, input.job.agentId, "agent.error", {
        errorMessage: input.errorMessage,
        summary: input.summary ?? "Agent execution failed before the turn could complete.",
      });

      for (const event of input.additionalEvents ?? []) {
        await appendEvent(tx, input.job.agentId, event.type, event.payload);
      }
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

  private async recoverStaleExecutions(now: Date) {
    await this.recoverStaleQueuedJobs(now);
    await this.recoverStaleRunningJobs(now);
  }

  private async recoverStaleQueuedJobs(now: Date) {
    const rows = await this.db
      .select()
      .from(agents)
      .where(eq(agents.executionState, "queued"))
      .orderBy(asc(agents.updatedAt));

    for (const row of rows as Array<typeof agents.$inferSelect>) {
      const thresholdMs = resolveStaleExecutionThresholdMs(
        resolveTurnTimeoutMs(row.runtimeConfigJson, readExecutorTurnTimeoutEnv()),
      );
      const queuedAt = row.updatedAt ?? row.createdAt;
      if (!queuedAt || now.getTime() - queuedAt.getTime() < thresholdMs) {
        continue;
      }

      const nextWakeAt = shouldRescheduleRecoveredAgent(row) ? now : null;
      await this.db.transaction(async (tx: any) => {
        await tx
          .update(agents)
          .set({
            executionState: nextWakeAt ? "idle" : "error",
            lastErrorCode: "stale_queue_recovered",
            lastErrorMessage: "Recovered a stale queued heartbeat job.",
            nextWakeAt,
            updatedAt: now,
          })
          .where(eq(agents.id, row.id));

        await appendEvent(tx, row.id, "agent.run_recovered", {
          recoveredState: "queued",
          errorCode: "stale_queue_recovered",
          summary: "Recovered a stale queued heartbeat job.",
        });
      });
    }
  }

  private async recoverStaleRunningJobs(now: Date) {
    const rows = await this.db
      .select()
      .from(agents)
      .where(eq(agents.executionState, "running"))
      .orderBy(asc(agents.lastRunStartedAt));

    for (const row of rows as Array<typeof agents.$inferSelect>) {
      const startedAt = row.lastRunStartedAt ?? row.updatedAt ?? row.createdAt;
      const thresholdMs = resolveStaleExecutionThresholdMs(
        resolveTurnTimeoutMs(row.runtimeConfigJson, readExecutorTurnTimeoutEnv()),
      );
      if (!startedAt || now.getTime() - startedAt.getTime() < thresholdMs) {
        continue;
      }

      const nextWakeAt = shouldRescheduleRecoveredAgent(row) ? now : null;
      await this.persistRunFailure({
        job: buildAgentRunJob(row.id, "retry", 1, now),
        errorCode: "stale_run_recovered",
        errorMessage: "Recovered a stale running turn after the executor stopped making progress.",
        executionState: nextWakeAt ? "idle" : "error",
        nextWakeAt,
        startedAt: startedAt.toISOString(),
        finishedAt: now.toISOString(),
        summary: "Recovered a stale running turn and restored the scheduler state.",
        additionalEvents: [
          {
            type: "agent.run_recovered",
            payload: {
              recoveredState: "running",
              errorCode: "stale_run_recovered",
              summary: "Recovered a stale running turn and restored the scheduler state.",
            },
          },
        ],
      });
    }
  }
}

function buildAgentRunJob(
  agentId: string,
  wakeReason: AgentRunJob["wakeReason"],
  priority: number,
  now: Date,
): AgentRunJob {
  return {
    jobId: crypto.randomUUID(),
    agentId,
    wakeReason,
    coalescedEventIds: [],
    leaseId: crypto.randomUUID(),
    priority,
    requestedAt: now.toISOString(),
  };
}

function shouldRescheduleRecoveredAgent(row: typeof agents.$inferSelect): boolean {
  return row.autonomyEnabled && row.setupStatus === "ready" && row.desiredState === "running";
}

function readExecutorTurnTimeoutEnv(): number | undefined {
  const value = Number(process.env.AGENT_TURN_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : undefined;
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
