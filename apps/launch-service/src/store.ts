import type { GameEnvironmentId } from "../../../config/shared/game-environments";
import { Context, Effect, Layer } from "effect";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import { DatabaseFailure } from "./errors";
import { launchName, launchRunPath, type LaunchRun, type LaunchSummary } from "./model";
import { applyDurableLaunchDefaults, type LaunchJobRequest, type LaunchKind } from "./schemas";

interface LaunchRunRow {
  id: string;
  kind: LaunchKind;
  environment: GameEnvironmentId;
  name: string;
  request: string;
  status: LaunchRun["status"];
  attempts: number;
  available_at: number;
  error_message: string | null;
  summary: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface LaunchServiceStore extends LaunchRunStore {
  /** Queues a run; a running or complete run of the same name is handed back as it is. */
  enqueue(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun>;
  /** Creates a run once; whatever run already has that name is handed back untouched. */
  schedule(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun>;
  list(environment: GameEnvironmentId, kind?: LaunchKind): Promise<LaunchRun[]>;
  /** Every run that failed and waits for a launcher to continue it, in any environment. */
  failed(): Promise<LaunchRun[]>;
  find(kind: LaunchKind, environment: GameEnvironmentId, name: string): Promise<LaunchRun | null>;
  /** The run to execute now: one interrupted while running, else the oldest due queued run. Either costs an attempt. */
  startNext(now: number): Promise<LaunchRun | null>;
  /** When the next queued run falls due, if any. */
  nextDue(): Promise<number | null>;
  complete(runId: string, summary: LaunchSummary): Promise<void>;
  retry(runId: string, errorMessage: string, retryDelayMs: number): Promise<void>;
  /** Requeues a run that ran too early; the attempt is given back. */
  defer(runId: string, delayMs: number): Promise<void>;
  fail(runId: string, errorMessage: string): Promise<void>;
  delete(kind: LaunchKind, environment: GameEnvironmentId, name: string): Promise<boolean>;
}

export class LaunchDatabase extends Context.Service<LaunchDatabase, LaunchServiceStore>()("launch/LaunchDatabase") {}

const iso = (time: number) => new Date(time).toISOString();

const toRun = (row: LaunchRunRow): LaunchRun => ({
  id: row.id,
  kind: row.kind,
  environment: row.environment,
  name: row.name,
  request: JSON.parse(row.request) as LaunchJobRequest,
  status: row.status,
  attempts: row.attempts,
  dueAt: iso(row.available_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  ...(row.completed_at ? { completedAt: iso(row.completed_at) } : {}),
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  ...(row.summary ? { summary: JSON.parse(row.summary) as LaunchSummary } : {}),
});

const storedSummary = <S extends LaunchSummary>(runId: string, summary: S): S => ({
  ...summary,
  outputPath: `${launchRunPath(runId)}/summary`,
});

const SELECT_RUN = "SELECT * FROM launch_runs WHERE kind = ? AND environment = ? AND name = ?";

export class D1LaunchStore implements LaunchServiceStore {
  constructor(private readonly db: D1Database) {}

  async enqueue(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun> {
    // One rule for every environment: a running or complete run is handed back as it is (create_game is idempotent by
    // name, so nothing is lost); anything else is queued again with the new request.
    return this.insertRun(
      kind,
      request,
      `ON CONFLICT (kind, environment, name) DO UPDATE SET
         id = excluded.id, request = excluded.request, status = 'queued', attempts = 0,
         available_at = excluded.available_at, error_message = NULL, completed_at = NULL, updated_at = excluded.updated_at
       WHERE launch_runs.status NOT IN ('running', 'complete')`,
    );
  }

  async schedule(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun> {
    return this.insertRun(kind, request, "ON CONFLICT (kind, environment, name) DO NOTHING");
  }

  async list(environment: GameEnvironmentId, kind?: LaunchKind): Promise<LaunchRun[]> {
    const statement = kind
      ? this.db
          .prepare("SELECT * FROM launch_runs WHERE environment = ? AND kind = ? ORDER BY updated_at DESC, id")
          .bind(environment, kind)
      : this.db
          .prepare("SELECT * FROM launch_runs WHERE environment = ? ORDER BY updated_at DESC, id")
          .bind(environment);
    return (await statement.all<LaunchRunRow>()).results.map(toRun);
  }

  async failed(): Promise<LaunchRun[]> {
    const rows = await this.db
      .prepare("SELECT * FROM launch_runs WHERE status = 'failed' ORDER BY updated_at DESC, id")
      .all<LaunchRunRow>();
    return rows.results.map(toRun);
  }

  async find(kind: LaunchKind, environment: GameEnvironmentId, name: string): Promise<LaunchRun | null> {
    const row = await this.db.prepare(SELECT_RUN).bind(kind, environment, name).first<LaunchRunRow>();
    return row ? toRun(row) : null;
  }

  async startNext(now: number): Promise<LaunchRun | null> {
    const interrupted = await this.db
      .prepare("UPDATE launch_runs SET attempts = attempts + 1, updated_at = ? WHERE status = 'running' RETURNING *")
      .bind(now)
      .first<LaunchRunRow>();
    if (interrupted) return toRun(interrupted);
    const due = await this.db
      .prepare(
        `UPDATE launch_runs SET status = 'running', attempts = attempts + 1, updated_at = ?1
         WHERE id = (SELECT id FROM launch_runs WHERE status = 'queued' AND available_at <= ?1
                     ORDER BY created_at, id LIMIT 1)
         RETURNING *`,
      )
      .bind(now)
      .first<LaunchRunRow>();
    return due ? toRun(due) : null;
  }

  async nextDue(): Promise<number | null> {
    const row = await this.db
      .prepare("SELECT MIN(available_at) AS due FROM launch_runs WHERE status = 'queued'")
      .first<{ due: number | null }>();
    return row?.due ?? null;
  }

  async complete(runId: string, summary: LaunchSummary): Promise<void> {
    const now = Date.now();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE launch_runs SET status = 'complete', summary = ?, error_message = NULL, completed_at = ?, updated_at = ?
           WHERE id = ? AND status = 'running'`,
        )
        .bind(JSON.stringify(storedSummary(runId, summary)), now, now, runId),
      ...this.resultRunFor(summary, now),
    ]);
  }

  /** A launched Blitz game has its result recorded at its actual end, in the same write as the launch completes. */
  private resultRunFor(summary: LaunchSummary, now: number): D1PreparedStatement[] {
    if (!("startTime" in summary) || summary.gameType !== "blitz" || summary.dryRun) return [];
    if (!summary.gameId || !summary.finalizeAt) throw new Error("Settled Blitz game has no finalization schedule");
    const request = { environment: summary.environment, gameName: summary.gameName, gameId: summary.gameId };
    return [
      this.db
        .prepare(
          `INSERT INTO launch_runs (id, kind, environment, name, request, status, available_at, created_at, updated_at)
           VALUES (?, 'result', ?, ?, ?, 'queued', ?, ?, ?)
           ON CONFLICT (kind, environment, name) DO NOTHING`,
        )
        .bind(
          crypto.randomUUID(),
          summary.environment,
          summary.gameName,
          JSON.stringify(request),
          summary.finalizeAt * 1_000,
          now,
          now,
        ),
    ];
  }

  async retry(runId: string, errorMessage: string, retryDelayMs: number): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE launch_runs SET status = 'queued', available_at = ?, error_message = ?, updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .bind(now + retryDelayMs, errorMessage, now, runId)
      .run();
  }

  async defer(runId: string, delayMs: number): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE launch_runs SET status = 'queued', attempts = attempts - 1, available_at = ?, error_message = NULL,
           updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .bind(now + delayMs, now, runId)
      .run();
  }

  async fail(runId: string, errorMessage: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE launch_runs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ? AND status = 'running'",
      )
      .bind(errorMessage, Date.now(), runId)
      .run();
  }

  async delete(kind: LaunchKind, environment: GameEnvironmentId, name: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM launch_runs WHERE kind = ? AND environment = ? AND name = ? AND status <> 'running'")
      .bind(kind, environment, name)
      .run();
    return result.meta.changes === 1;
  }

  async loadGame(environment: LaunchGameSummary["environment"], gameName: string): Promise<LaunchGameSummary | null> {
    const run = await this.find("game", environment, gameName);
    return (run?.summary as LaunchGameSummary | undefined) ?? null;
  }

  async saveGame(summary: LaunchGameSummary): Promise<LaunchGameSummary> {
    const run = await this.find("game", summary.environment, summary.gameName);
    if (!run) throw new Error(`No queued launch owns summary ${summary.gameName}`);
    const stored = storedSummary(run.id, summary);
    await this.db
      .prepare("UPDATE launch_runs SET summary = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(stored), Date.now(), run.id)
      .run();
    return stored;
  }

  private async insertRun(kind: LaunchKind, request: LaunchJobRequest, conflict: string): Promise<LaunchRun> {
    const durableRequest = applyDurableLaunchDefaults(kind, request);
    const name = launchName(kind, durableRequest);
    const now = Date.now();
    const [, selected] = await this.db.batch<LaunchRunRow>([
      this.db
        .prepare(
          `INSERT INTO launch_runs (id, kind, environment, name, request, status, available_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?) ${conflict}`,
        )
        .bind(
          crypto.randomUUID(),
          kind,
          durableRequest.environment,
          name,
          JSON.stringify(durableRequest),
          now,
          now,
          now,
        ),
      this.db.prepare(SELECT_RUN).bind(kind, durableRequest.environment, name),
    ]);
    return toRun(selected!.results[0]!);
  }
}

export const databaseLayer = (store: LaunchServiceStore): Layer.Layer<LaunchDatabase> =>
  Layer.succeed(LaunchDatabase, store);

export const databaseOperation = <A>(operation: string, task: () => Promise<A>) =>
  Effect.tryPromise({
    try: task,
    catch: (cause) => new DatabaseFailure({ operation, cause }),
  });
