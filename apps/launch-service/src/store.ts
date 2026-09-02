import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Context, Effect, Layer } from "effect";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type {
  LaunchGameSummary,
  LaunchRotationSummary,
  LaunchSeriesSummary,
} from "../../../config/deployer/clean/types";
import { DatabaseFailure } from "./errors";
import { launchName, type ClaimedLaunchRun, type LaunchRun, type LaunchSummary } from "./model";
import { applyDurableLaunchDefaults, type LaunchJobRequest, type LaunchKind } from "./schemas";

const migrationUrl = new URL("../migrations/0001_launch_runs.sql", import.meta.url);

interface LaunchRunRow extends QueryResultRow {
  id: string;
  kind: LaunchKind;
  environment: "madara.blitz";
  name: string;
  request: LaunchJobRequest;
  status: LaunchRun["status"];
  attempts: number;
  claimed_until: Date | null;
  lease_token: string | null;
  error_message: string | null;
  summary: LaunchSummary | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface LaunchServiceStore extends LaunchRunStore {
  initialize(): Promise<void>;
  close(): Promise<void>;
  enqueue(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun>;
  list(environment: "madara.blitz", kind?: LaunchKind): Promise<LaunchRun[]>;
  find(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<LaunchRun | null>;
  claim(leaseMs: number): Promise<ClaimedLaunchRun | null>;
  heartbeat(runId: string, leaseToken: string, leaseMs: number): Promise<boolean>;
  complete(runId: string, leaseToken: string, summary: LaunchSummary): Promise<LaunchRun>;
  retry(runId: string, leaseToken: string, errorMessage: string, retryDelayMs: number): Promise<void>;
  fail(runId: string, leaseToken: string, errorMessage: string): Promise<void>;
  cancel(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<boolean>;
  delete(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<boolean>;
}

export class LaunchDatabase extends Context.Service<LaunchDatabase, LaunchServiceStore>()("launch/LaunchDatabase") {}

const toRun = (row: LaunchRunRow): LaunchRun => ({
  id: row.id,
  kind: row.kind,
  environment: row.environment,
  name: row.name,
  request: row.request,
  status: row.status,
  attempts: row.attempts,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  ...(row.claimed_until ? { claimedUntil: row.claimed_until.toISOString() } : {}),
  ...(row.lease_token ? { leaseToken: row.lease_token } : {}),
  ...(row.completed_at ? { completedAt: row.completed_at.toISOString() } : {}),
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  ...(row.summary ? { summary: row.summary } : {}),
});

const summaryName = (summary: LaunchSummary): string => {
  if ("gameName" in summary) return summary.gameName;
  if ("rotationName" in summary) return summary.rotationName;
  return summary.seriesName;
};

const summaryKind = (summary: LaunchSummary): LaunchKind => {
  if ("gameName" in summary) return "game";
  if ("rotationName" in summary) return "rotation";
  return "series";
};

export class PostgresLaunchStore implements LaunchServiceStore {
  readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 6, idleTimeoutMillis: 30_000 });
  }

  async initialize(): Promise<void> {
    await this.pool.query(await readFile(migrationUrl, "utf8"));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async enqueue(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun> {
    const durableRequest = applyDurableLaunchDefaults(kind, request);
    const id = randomUUID();
    const name = launchName(kind, durableRequest);
    const result = await this.pool.query<LaunchRunRow>(
      `INSERT INTO launch_runs (id, kind, environment, name, request, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'queued')
       ON CONFLICT (kind, environment, name) DO UPDATE SET
         id = CASE WHEN launch_runs.status = 'running' THEN launch_runs.id ELSE EXCLUDED.id END,
         request = CASE WHEN launch_runs.status = 'running' THEN launch_runs.request ELSE EXCLUDED.request END,
         status = CASE WHEN launch_runs.status = 'running' THEN launch_runs.status ELSE 'queued' END,
         attempts = CASE WHEN launch_runs.status = 'running' THEN launch_runs.attempts ELSE 0 END,
         available_at = CASE WHEN launch_runs.status = 'running' THEN launch_runs.available_at ELSE now() END,
         claimed_until = CASE WHEN launch_runs.status = 'running' THEN launch_runs.claimed_until ELSE NULL END,
         lease_token = CASE WHEN launch_runs.status = 'running' THEN launch_runs.lease_token ELSE NULL END,
         error_message = CASE WHEN launch_runs.status = 'running' THEN launch_runs.error_message ELSE NULL END,
         completed_at = CASE WHEN launch_runs.status = 'running' THEN launch_runs.completed_at ELSE NULL END,
         updated_at = now()
       RETURNING *`,
      [id, kind, durableRequest.environment, name, JSON.stringify(durableRequest)],
    );
    const run = toRun(result.rows[0]!);
    if (run.status === "running" && run.id !== id) throw new Error(`${kind} launch "${name}" is already running`);
    return run;
  }

  async list(environment: "madara.blitz", kind?: LaunchKind): Promise<LaunchRun[]> {
    const result = kind
      ? await this.pool.query<LaunchRunRow>(
          "SELECT * FROM launch_runs WHERE environment = $1 AND kind = $2 ORDER BY updated_at DESC",
          [environment, kind],
        )
      : await this.pool.query<LaunchRunRow>(
          "SELECT * FROM launch_runs WHERE environment = $1 ORDER BY updated_at DESC",
          [environment],
        );
    return result.rows.map(toRun);
  }

  async find(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<LaunchRun | null> {
    const result = await this.pool.query<LaunchRunRow>(
      "SELECT * FROM launch_runs WHERE kind = $1 AND environment = $2 AND name = $3",
      [kind, environment, name],
    );
    return result.rows[0] ? toRun(result.rows[0]) : null;
  }

  async claim(leaseMs: number): Promise<ClaimedLaunchRun | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE launch_runs SET status = 'queued', claimed_until = NULL, lease_token = NULL, updated_at = now()
         WHERE status = 'running' AND claimed_until < now()`,
      );
      const candidate = await client.query<LaunchRunRow>(
        `SELECT * FROM launch_runs
         WHERE status = 'queued' AND available_at <= now()
         ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      if (!candidate.rows[0]) {
        await client.query("COMMIT");
        return null;
      }
      const leaseToken = randomUUID();
      const claimedUntil = new Date(Date.now() + leaseMs);
      const claimed = await client.query<LaunchRunRow>(
        `UPDATE launch_runs SET status = 'running', attempts = attempts + 1,
           lease_token = $2, claimed_until = $3, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [candidate.rows[0].id, leaseToken, claimedUntil],
      );
      await client.query("COMMIT");
      return toRun(claimed.rows[0]!) as ClaimedLaunchRun;
    } catch (error) {
      await rollback(client);
      if (isSingleWriterConflict(error)) return null;
      throw error;
    } finally {
      client.release();
    }
  }

  async heartbeat(runId: string, leaseToken: string, leaseMs: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE launch_runs SET claimed_until = $3, updated_at = now()
       WHERE id = $1 AND lease_token = $2 AND status = 'running'`,
      [runId, leaseToken, new Date(Date.now() + leaseMs)],
    );
    return result.rowCount === 1;
  }

  async complete(runId: string, leaseToken: string, summary: LaunchSummary): Promise<LaunchRun> {
    const storedSummary = { ...summary, outputPath: `postgres://launch_runs/${runId}/summary` };
    const result = await this.pool.query<LaunchRunRow>(
      `UPDATE launch_runs SET status = 'complete', summary = $3::jsonb, claimed_until = NULL,
         lease_token = NULL, error_message = NULL, completed_at = now(), updated_at = now()
       WHERE id = $1 AND lease_token = $2 AND status = 'running' RETURNING *`,
      [runId, leaseToken, JSON.stringify(storedSummary)],
    );
    if (!result.rows[0]) throw new Error(`Launch lease for ${runId} was lost before completion`);
    return toRun(result.rows[0]);
  }

  async retry(runId: string, leaseToken: string, errorMessage: string, retryDelayMs: number): Promise<void> {
    await this.pool.query(
      `UPDATE launch_runs SET status = 'queued', available_at = $4, claimed_until = NULL,
         lease_token = NULL, error_message = $3, updated_at = now()
       WHERE id = $1 AND lease_token = $2 AND status = 'running'`,
      [runId, leaseToken, errorMessage, new Date(Date.now() + retryDelayMs)],
    );
  }

  async fail(runId: string, leaseToken: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE launch_runs SET status = 'failed', claimed_until = NULL, lease_token = NULL,
         error_message = $3, updated_at = now()
       WHERE id = $1 AND lease_token = $2 AND status = 'running'`,
      [runId, leaseToken, errorMessage],
    );
  }

  async cancel(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE launch_runs SET status = 'cancelled', claimed_until = NULL, lease_token = NULL, updated_at = now()
       WHERE kind = $1 AND environment = $2 AND name = $3 AND status <> 'running'`,
      [kind, environment, name],
    );
    return result.rowCount === 1;
  }

  async delete(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM launch_runs WHERE kind = $1 AND environment = $2 AND name = $3 AND status <> 'running'",
      [kind, environment, name],
    );
    return result.rowCount === 1;
  }

  loadGame(environment: LaunchGameSummary["environment"], gameName: string): Promise<LaunchGameSummary | null> {
    return this.loadSummary("game", environment, gameName) as Promise<LaunchGameSummary | null>;
  }

  async saveGame(summary: LaunchGameSummary): Promise<LaunchGameSummary> {
    return this.saveSummary(summary) as Promise<LaunchGameSummary>;
  }

  loadSeries(environment: LaunchSeriesSummary["environment"], seriesName: string): Promise<LaunchSeriesSummary | null> {
    return this.loadSummary("series", environment, seriesName) as Promise<LaunchSeriesSummary | null>;
  }

  async saveSeries(summary: LaunchSeriesSummary): Promise<LaunchSeriesSummary> {
    return this.saveSummary(summary) as Promise<LaunchSeriesSummary>;
  }

  loadRotation(
    environment: LaunchRotationSummary["environment"],
    rotationName: string,
  ): Promise<LaunchRotationSummary | null> {
    return this.loadSummary("rotation", environment, rotationName) as Promise<LaunchRotationSummary | null>;
  }

  async saveRotation(summary: LaunchRotationSummary): Promise<LaunchRotationSummary> {
    return this.saveSummary(summary) as Promise<LaunchRotationSummary>;
  }

  private async loadSummary(kind: LaunchKind, environment: string, name: string): Promise<LaunchSummary | null> {
    const result = await this.pool.query<{ summary: LaunchSummary | null }>(
      "SELECT summary FROM launch_runs WHERE kind = $1 AND environment = $2 AND name = $3",
      [kind, environment, name],
    );
    return result.rows[0]?.summary ?? null;
  }

  private async saveSummary(summary: LaunchSummary): Promise<LaunchSummary> {
    const result = await this.pool.query<{ id: string }>(
      "SELECT id FROM launch_runs WHERE kind = $1 AND environment = $2 AND name = $3",
      [summaryKind(summary), summary.environment, summaryName(summary)],
    );
    const runId = result.rows[0]?.id;
    if (!runId) throw new Error(`No queued launch owns summary ${summaryName(summary)}`);
    const stored = { ...summary, outputPath: `postgres://launch_runs/${runId}/summary` };
    await this.pool.query("UPDATE launch_runs SET summary = $2::jsonb, updated_at = now() WHERE id = $1", [
      runId,
      JSON.stringify(stored),
    ]);
    return stored;
  }
}

const rollback = async (client: PoolClient): Promise<void> => {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The original transaction error is the useful failure.
  }
};

const isSingleWriterConflict = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export const databaseLayer = (store: LaunchServiceStore): Layer.Layer<LaunchDatabase> =>
  Layer.succeed(LaunchDatabase, store);

export const databaseOperation = <A>(operation: string, task: () => Promise<A>) =>
  Effect.tryPromise({
    try: task,
    catch: (cause) => new DatabaseFailure({ operation, cause }),
  });
