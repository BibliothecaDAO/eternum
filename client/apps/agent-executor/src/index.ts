import { Hono } from "hono";

import { agentRunJobSchema } from "@bibliothecadao/types";
import { getExecutorDb } from "./persistence/executor-db";
import { createExecutorArtifactStore } from "./artifacts/postgres-or-r2-artifact-store";
import { ExecutorRunStore } from "./persistence/executor-run-store";
import { CartridgeStoredSessionResolver } from "./sessions/cartridge-stored-session-resolver";
import { executeAgentRun } from "./jobs/execute-agent-run";
import { processAgentRunJob } from "./jobs/process-agent-run-job";

const app = new Hono();
const db = getExecutorDb(process.env.DATABASE_URL ?? "");
const artifactStore = createExecutorArtifactStore();
const runStore = new ExecutorRunStore(db, artifactStore);
const sessionResolver = new CartridgeStoredSessionResolver(
  runStore,
  JSON.parse(process.env.AGENT_SESSION_ENCRYPTION_KEYS ?? "{}"),
);

app.get("/health", (c) => c.json({ ok: true }));

app.post("/jobs/agent-run", async (c) => {
  const job = agentRunJobSchema.parse(await c.req.json());
  const claimed = await runStore.claimImmediateJob(job);
  const result = claimed
    ? await processAgentRunJob({
        job,
        store: runStore,
        sessionResolver,
        executeAgentRun,
      })
    : { status: "busy", success: false, finishedAt: new Date().toISOString() };

  return c.json({
    accepted: true,
    jobId: job.jobId,
    agentId: job.agentId,
    success: result.success,
    finishedAt: result.finishedAt,
  });
});

app.post("/jobs/agent-heartbeat", async (c) => {
  const dueJobs = await runStore.claimDueAgentJobs(new Date());
  const results = [];
  for (const job of dueJobs) {
    results.push({
      agentId: job.agentId,
      ...(await processAgentRunJob({
        job,
        store: runStore,
        sessionResolver,
        executeAgentRun,
      })),
    });
  }

  return c.json({
    scanned: dueJobs.length,
    results,
  });
});

if (process.env.AGENT_EXECUTOR_ENABLE_HEARTBEAT !== "false") {
  const intervalMs = Number(process.env.AGENT_EXECUTOR_HEARTBEAT_POLL_MS ?? 5_000);
  setInterval(() => {
    void fetch(`http://127.0.0.1:${process.env.PORT ?? 8788}/jobs/agent-heartbeat`, {
      method: "POST",
    }).catch(() => undefined);
  }, intervalMs);
}

export default app;
