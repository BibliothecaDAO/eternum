import type { JoinFailure } from "./registrar";
import { isGameEnvironmentId, type GameEnvironmentId } from "../../../config/shared/game-environments";
import { Hono, type Context } from "hono";
import { logger } from "hono/logger";
import { requireOperator } from "./auth";
import { createSlotRoutes } from "./slot-routes";
import type { CalendarStore } from "./calendar";
import { createCalendarRoutes } from "./calendar-routes";
import type { SlotStore } from "./slots";
import { toFactoryRunRecord, type LaunchRun } from "./model";
import { type LaunchJobRequest, type LaunchKind } from "./schemas";
import type { LaunchServiceStore } from "./store";
import { isSameTestBlitz, readTestBlitz, testBlitzRequest, type TestBlitz } from "./test-blitz";
import { isDevShardChain } from "@realms-world/value-ledger";

interface LaunchAppDependencies {
  config: { operatorToken: string };
  /** What the version and health routes report, so a deploy can tell its own answers from its predecessor's. */
  /** `revision` is the commit the Worker was published from: its version tag, set by the deploy. */
  deployment: { environment: string; version: string; revision: string };
  store: LaunchServiceStore;
  slots: SlotStore;
  calendar: CalendarStore;
  /** The registrar that executes runs: every run queued here arms it for the run's due time. */
  registrar: {
    armFor(dueAt: number): Promise<void>;
    joinFailures(): Promise<JoinFailure[]>;
    wakeAt(): Promise<number | null>;
  };
}

const readEnvironment = (value: string | undefined): GameEnvironmentId => {
  if (!value || !isGameEnvironmentId(value)) throw new Error("Unsupported game environment");
  return value;
};

const respondWithRun = async (
  context: Context,
  { store, registrar }: Pick<LaunchAppDependencies, "store" | "registrar">,
  kind: LaunchKind,
  request: LaunchJobRequest,
) => {
  try {
    const run = await store.enqueue(kind, request);
    // A queued run is due now.
    await registrar.armFor(Date.now());
    return context.json(toFactoryRunRecord(run), 202);
  } catch (error) {
    return context.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};

/**
 * The name is the request's identity: the first request creates the run, a retry with the same roster gets that run
 * back, and another roster under the name is refused, so a lost response never starts a second game.
 */
const respondWithTestBlitz = async (
  context: Context,
  { store, registrar }: Pick<LaunchAppDependencies, "store" | "registrar">,
  requested: TestBlitz,
) => {
  const run = await store.schedule("game", testBlitzRequest(requested, Date.now()));
  if (!isSameTestBlitz(run, requested)) return context.json({ error: "That name holds another game" }, 409);
  await registrar.armFor(Date.now());
  return context.json(toFactoryRunRecord(run), 202);
};

const findRun = async (context: Context, store: LaunchServiceStore, kind: LaunchKind, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await store.find(kind, environment, name);
  return run ? context.json(toFactoryRunRecord(run)) : context.json({ error: "Launch run not found." }, 404);
};

const continueRun = async (
  context: Context,
  dependencies: Pick<LaunchAppDependencies, "store" | "registrar">,
  kind: LaunchKind,
  name: string,
) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await dependencies.store.find(kind, environment, name);
  if (!run) return context.json({ error: "Launch run not found." }, 404);
  return respondWithRun(context, dependencies, kind, run.request);
};

const deleteRun = async (context: Context, store: LaunchServiceStore, kind: LaunchKind, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await store.find(kind, environment, name);
  if (!run) return context.json({ error: "Launch run not found." }, 409);
  const deleted = await store.delete(kind, environment, name);
  return deleted
    ? context.json({ deleted: true })
    : context.json({ error: "Run is missing, active, or belongs to a paid slot." }, 409);
};

const failedRunReport = (run: LaunchRun) => ({
  kind: run.kind,
  environment: run.environment,
  name: run.name,
  error: run.errorMessage ?? null,
  failedAt: run.updatedAt,
});

const strandedRunReport = ({ chainId, kind, environment, name, status }: LaunchRun) => ({
  chainId,
  kind,
  environment,
  name,
  status,
});

export const createLaunchApp = (dependencies: LaunchAppDependencies) => {
  const app = new Hono();
  app.use("*", logger());
  app.use("/api/*", requireOperator(dependencies.config.operatorToken));
  app.route("/api/factory/calendar", createCalendarRoutes(dependencies.calendar));
  app.route("/api/slots", createSlotRoutes(dependencies.slots));

  // The deploy verifies this route: it names the running code and reads nothing else, so the shard's state, which health
  // reports, cannot fail a deploy.
  app.get("/api/factory/version", (context) => context.json({ service: "launch", ...dependencies.deployment }));

  // The schedule never requeues a failed season; its operator must continue it. Health names every failed run.
  app.get("/api/factory/health", async (context) => {
    try {
      const [failed, pending, joins, wakeAt, freezes] = await Promise.all([
        dependencies.store.failed(),
        dependencies.store.pending(),
        dependencies.registrar.joinFailures(),
        dependencies.registrar.wakeAt(),
        dependencies.slots.freezeFailures(),
      ]);
      const now = Date.now();
      const stranded = pending.filter(
        (run) => (run.status === "running" || Date.parse(run.dueAt) <= now) && (wakeAt === null || wakeAt > now),
      );
      return context.json(
        {
          service: "launch",
          ...dependencies.deployment,
          failedRuns: failed.map(failedRunReport),
          joinFailures: joins,
          freezeFailures: freezes,
          strandedRuns: stranded.map(strandedRunReport),
        },
        failed.length || stranded.length || joins.length || freezes.length ? 503 : 200,
      );
    } catch {
      return context.json({ status: "unavailable" }, 503);
    }
  });

  app.get("/api/factory/directory-games", async (context) => {
    try {
      return context.json({ chains: await dependencies.store.playerDirectoryGames() });
    } catch (error) {
      console.error("factory_directory_games_failed", error);
      return context.json({ error: "Launch directory is unavailable" }, 503);
    }
  });

  app.get("/api/factory/runs", async (context) => {
    try {
      const environment = readEnvironment(context.req.query("environment"));
      const runs = await dependencies.store.list(environment);
      return context.json({ runs: runs.map(toFactoryRunRecord) });
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  app.get("/api/factory/runs/:environment/:name", (context) =>
    findRun(context, dependencies.store, "game", context.req.param("name")),
  );
  app.post("/api/factory/runs/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies, "game", context.req.param("name")),
  );
  app.post("/api/factory/runs/:environment/:name/actions/delete", (context) =>
    deleteRun(context, dependencies.store, "game", context.req.param("name")),
  );

  // A test Blitz belongs to dev shards alone: on any other chain the route does not exist.
  app.post("/api/factory/test-blitz", async (context) => {
    if (!isDevShardChain(await dependencies.store.targetChain())) return context.json({ error: "Not found" }, 404);
    const requested = readTestBlitz(await context.req.json().catch(() => null));
    if (!requested) return context.json({ error: "Name the game test-<label> and 1 to 24 distinct accounts" }, 400);
    return respondWithTestBlitz(context, dependencies, requested);
  });

  app.post("/api/factory/results/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies, "result", context.req.param("name")),
  );
  return app;
};
