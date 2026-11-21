import { CalendarConflict } from "./calendar";
import type { GameEnvironmentId } from "../../../config/shared/game-environments";
import { Context, Effect, Layer } from "effect";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import { DatabaseFailure } from "./errors";
import { launchRunPath, type LaunchRun } from "./model";
import { applyDurableLaunchDefaults, isCalendarFrontier, type CreateGameRequest } from "./schemas";

interface LaunchRunRow {
  id: string;
  slot_id: number | null;
  chain_id: string;
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
  /** The shard chain this store's runs launch on, as the directory selects it. */
  targetChain(): Promise<string>;
  officialChain(): Promise<string | null>;
  enqueue(request: CreateGameRequest): Promise<LaunchRun>;
  schedule(request: CreateGameRequest): Promise<LaunchRun>;
  list(environment: GameEnvironmentId): Promise<LaunchRun[]>;
  playerDirectoryGames(): Promise<{ chainId: string; games: { gameId: number; slotId: number | null }[] }[]>;
  /** Unfinished work belonging to the shards the registrar still serves. */
  pending(): Promise<LaunchRun[]>;
  /** Failed work on the shards the registrar still serves. */
  failed(): Promise<LaunchRun[]>;
  find(environment: GameEnvironmentId, name: string): Promise<LaunchRun | null>;
  /** The run to execute now: one interrupted while running, else the oldest due queued run. Either costs an attempt. */
  startNext(now: number): Promise<LaunchRun | null>;
  /** When the next queued run falls due, if any. */
  nextDue(): Promise<number | null>;
  complete(runId: string, summary: LaunchGameSummary): Promise<void>;
  retry(runId: string, errorMessage: string, retryDelayMs: number): Promise<void>;
  fail(runId: string, errorMessage: string): Promise<void>;
  delete(environment: GameEnvironmentId, name: string): Promise<boolean>;
}

export class LaunchDatabase extends Context.Service<LaunchDatabase, LaunchServiceStore>()("launch/LaunchDatabase") {}

const iso = (time: number) => new Date(time).toISOString();

const toRun = (row: LaunchRunRow): LaunchRun => ({
  id: row.id,
  chainId: row.chain_id,
  environment: row.environment,
  name: row.name,
  request: JSON.parse(row.request) as CreateGameRequest,
  status: row.status,
  attempts: row.attempts,
  dueAt: iso(row.available_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  ...(row.completed_at ? { completedAt: iso(row.completed_at) } : {}),
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  ...(row.summary ? { summary: JSON.parse(row.summary) as LaunchGameSummary } : {}),
});

const storedSummary = (runId: string, summary: LaunchGameSummary): LaunchGameSummary => ({
  ...summary,
  outputPath: `${launchRunPath(runId)}/summary`,
});

type DeclaredGameRow = Pick<LaunchRunRow, "id" | "chain_id" | "summary" | "slot_id">;

const declaredGameId = ({ id, summary }: DeclaredGameRow): number | null => {
  try {
    if (!summary) throw new Error("A declared game launch has no summary");
    const decoded = JSON.parse(summary) as { gameId?: unknown; dryRun?: unknown } | null;
    if (decoded?.dryRun === true) return null;
    if (!Number.isSafeInteger(decoded?.gameId) || Number(decoded?.gameId) <= 0 || Number(decoded?.gameId) > 0xffffffff)
      throw new Error("A declared game launch has an invalid game id");
    return Number(decoded?.gameId);
  } catch (error) {
    console.error("launch_directory_invalid_summary", { runId: id, error });
    return null;
  }
};

const groupDeclaredGames = (rows: DeclaredGameRow[]) => {
  const chains = new Map<string, { gameId: number; slotId: number | null }[]>();
  for (const row of rows) {
    const gameId = declaredGameId(row);
    if (gameId === null) continue;
    const games = chains.get(row.chain_id) ?? [];
    games.push({ gameId, slotId: row.slot_id });
    chains.set(row.chain_id, games);
  }
  return [...chains].map(([chainId, games]) => ({ chainId, games: games.sort((a, b) => a.gameId - b.gameId) }));
};

const SELECT_RUN = "SELECT * FROM launch_runs WHERE chain_id = ? AND kind = 'game' AND environment = ? AND name = ?";
const SCHEDULE_ONCE = "ON CONFLICT (chain_id, kind, environment, name) DO NOTHING";

/**
 * Launch runs are keyed by the selected directory chain; another shard's queue cannot block or retarget them.
 */
export class D1LaunchStore implements LaunchServiceStore {
  private chain?: Promise<string | null>;

  constructor(
    private readonly db: D1Database,
    private readonly chainOf: () => Promise<string | null>,
  ) {}

  // A failed manifest read is not remembered: the next operation reads it again.
  officialChain(): Promise<string | null> {
    this.chain ??= this.chainOf().catch((error: unknown) => {
      this.chain = undefined;
      throw error;
    });
    return this.chain;
  }

  private async chainId(): Promise<string> {
    const chain = await this.officialChain();
    if (chain === null) throw new Error("no_official_chain");
    return chain;
  }

  targetChain() {
    return this.chainId();
  }

  async enqueue(request: CreateGameRequest): Promise<LaunchRun> {
    // Retrying a calendar season preserves its declared identity even before the first launch succeeds.
    return this.insertRun(
      request,
      `ON CONFLICT (chain_id, kind, environment, name) DO UPDATE SET
         id = excluded.id, request = excluded.request, status = 'queued', attempts = 0,
         available_at = excluded.available_at, error_message = NULL, completed_at = NULL, updated_at = excluded.updated_at
       WHERE launch_runs.status NOT IN ('running', 'complete')
         AND (excluded.environment != 'madara.frontier' OR (
           json_extract(launch_runs.request, '$.gameStartTime') = json_extract(excluded.request, '$.gameStartTime')
           AND json_extract(launch_runs.request, '$.durationSeconds') IS json_extract(excluded.request, '$.durationSeconds')
         ))`,
    );
  }

  async schedule(request: CreateGameRequest): Promise<LaunchRun> {
    return this.insertRun(request, SCHEDULE_ONCE);
  }

  async list(environment: GameEnvironmentId): Promise<LaunchRun[]> {
    const { results } = await this.db
      .prepare(
        "SELECT * FROM launch_runs WHERE chain_id = ? AND environment = ? AND kind = 'game' ORDER BY updated_at DESC, id",
      )
      .bind(await this.chainId(), environment)
      .all<LaunchRunRow>();
    return results.map(toRun);
  }

  /**
   * The name of every game this service launched or is launching in one environment on this chain, whatever its run's
   * state: a run names its game before creating it, and one interrupted after creating it may not have recorded it.
   */
  async gameNames(environment: GameEnvironmentId): Promise<string[]> {
    return (await this.list(environment)).map(({ name }) => name);
  }

  async playerDirectoryGames(): Promise<{ chainId: string; games: { gameId: number; slotId: number | null }[] }[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, chain_id, summary, slot_id FROM launch_runs WHERE chain_id <> '' AND kind = 'game' AND status = 'complete' ORDER BY chain_id",
      )
      .all<DeclaredGameRow>();
    return groupDeclaredGames(results);
  }

  async pending(): Promise<LaunchRun[]> {
    return this.currentRuns("status IN ('queued', 'running')");
  }

  async failed(): Promise<LaunchRun[]> {
    return this.currentRuns("status = 'failed'");
  }

  private async currentRuns(condition: string): Promise<LaunchRun[]> {
    const official = await this.officialChain();
    if (official === null) return [];
    const chain = BigInt(official);
    const { results } = await this.db
      .prepare(
        `SELECT * FROM launch_runs WHERE chain_id <> '' AND kind = 'game' AND ${condition} ORDER BY created_at, id`,
      )
      .all<LaunchRunRow>();
    return results.filter((row) => BigInt(row.chain_id) === chain).map(toRun);
  }

  async find(environment: GameEnvironmentId, name: string): Promise<LaunchRun | null> {
    const row = await this.db
      .prepare(SELECT_RUN)
      .bind(await this.chainId(), environment, name)
      .first<LaunchRunRow>();
    return row ? toRun(row) : null;
  }

  async startNext(now: number): Promise<LaunchRun | null> {
    const chain = await this.chainId();
    const interrupted = await this.db
      .prepare(
        "UPDATE launch_runs SET attempts = attempts + 1, updated_at = ? WHERE chain_id = ? AND kind = 'game' AND status = 'running' RETURNING *",
      )
      .bind(now, chain)
      .first<LaunchRunRow>();
    if (interrupted) return toRun(interrupted);
    const due = await this.db
      .prepare(
        `UPDATE launch_runs SET status = 'running', attempts = attempts + 1, updated_at = ?1
         WHERE id = (SELECT id FROM launch_runs WHERE chain_id = ?2 AND kind = 'game' AND status = 'queued' AND available_at <= ?1
                     ORDER BY created_at, id LIMIT 1)
         RETURNING *`,
      )
      .bind(now, chain)
      .first<LaunchRunRow>();
    return due ? toRun(due) : null;
  }

  async nextDue(): Promise<number | null> {
    const row = await this.db
      .prepare(
        "SELECT MIN(available_at) AS due FROM launch_runs WHERE chain_id = ? AND kind = 'game' AND status = 'queued'",
      )
      .bind(await this.chainId())
      .first<{ due: number | null }>();
    return row?.due ?? null;
  }

  async complete(runId: string, summary: LaunchGameSummary): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE launch_runs SET status = 'complete', summary = ?, error_message = NULL, completed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .bind(JSON.stringify(storedSummary(runId, summary)), now, now, runId)
      .run();
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

  async fail(runId: string, errorMessage: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE launch_runs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ? AND status = 'running'",
      )
      .bind(errorMessage, Date.now(), runId)
      .run();
  }

  async delete(environment: GameEnvironmentId, name: string): Promise<boolean> {
    if (isCalendarFrontier(environment, name)) return false;
    const result = await this.db
      .prepare(
        "DELETE FROM launch_runs WHERE chain_id = ? AND kind = 'game' AND environment = ? AND name = ? AND status IN ('queued', 'failed')",
      )
      .bind(await this.chainId(), environment, name)
      .run();
    return result.meta.changes === 1;
  }

  async loadGame(environment: LaunchGameSummary["environment"], gameName: string): Promise<LaunchGameSummary | null> {
    const run = await this.find(environment, gameName);
    return (run?.summary as LaunchGameSummary | undefined) ?? null;
  }

  async saveGame(summary: LaunchGameSummary): Promise<LaunchGameSummary> {
    const run = await this.find(summary.environment, summary.gameName);
    if (!run) throw new Error(`No queued launch owns summary ${summary.gameName}`);
    const stored = storedSummary(run.id, summary);
    await this.db
      .prepare("UPDATE launch_runs SET summary = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(stored), Date.now(), run.id)
      .run();
    return stored;
  }

  private async insertRun(request: CreateGameRequest, conflict: string): Promise<LaunchRun> {
    const durableRequest = applyDurableLaunchDefaults(request);
    const chain = await this.chainId();
    const [, selected] = await this.db.batch<LaunchRunRow>([
      this.insertStatement(chain, durableRequest, conflict),
      this.db.prepare(SELECT_RUN).bind(chain, durableRequest.environment, durableRequest.gameName),
    ]);
    const row = selected!.results[0];
    if (!row) throw new CalendarConflict("Frontier launch differs from the published calendar");
    const run = toRun(row);
    if (durableRequest.environment === "madara.frontier") assertSameFrontierLaunch(run.request, durableRequest);
    return run;
  }

  private insertStatement(chain: string, request: CreateGameRequest, conflict: string) {
    const now = Date.now();
    const calendarSeason = isCalendarFrontier(request.environment, request.gameName);
    // A cron read can become stale before insertion. Exact retries also work after the calendar advances.
    return this.db
      .prepare(
        `INSERT INTO launch_runs
           (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at)
         SELECT ?1, ?2, 'game', ?3, ?4, ?5, 'queued', ?6, ?7, ?8
         WHERE ?9 = 0 OR EXISTS (
           SELECT 1 FROM season_phases WHERE phase = 'frontier'
             AND 'frontier-' || CAST(starts_at / 1000 AS INTEGER) = ?4
             AND starts_at = unixepoch(json_extract(?5, '$.gameStartTime')) * 1000
             AND ends_at = starts_at + json_extract(?5, '$.durationSeconds') * 1000
         ) OR EXISTS (
           SELECT 1 FROM launch_runs WHERE chain_id = ?2 AND kind = 'game' AND environment = ?3 AND name = ?4
             AND request = ?5
         ) ${conflict}`,
      )
      .bind(
        crypto.randomUUID(),
        chain,
        request.environment,
        request.gameName,
        JSON.stringify(request),
        now,
        now,
        now,
        calendarSeason ? 1 : 0,
      );
  }
}

const assertSameFrontierLaunch = (stored: CreateGameRequest, requested: CreateGameRequest) => {
  if (stored.gameStartTime !== requested.gameStartTime || stored.durationSeconds !== requested.durationSeconds)
    throw new CalendarConflict("That Frontier name holds another season window");
};

export const databaseLayer = (store: LaunchServiceStore): Layer.Layer<LaunchDatabase> =>
  Layer.succeed(LaunchDatabase, store);

export const databaseOperation = <A>(operation: string, task: () => Promise<A>) =>
  Effect.tryPromise({
    try: task,
    catch: (cause) => new DatabaseFailure({ operation, cause }),
  });
