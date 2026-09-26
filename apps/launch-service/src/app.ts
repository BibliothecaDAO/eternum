import { isGameEnvironmentId, type GameEnvironmentId } from "../../../config/shared/game-environments";
import { Effect, Schema } from "effect";
import { Hono, type Context } from "hono";
import { logger } from "hono/logger";
import { requireIdentity, requireLauncher, type IdentityResolver, type LaunchAccess, type LaunchAppEnv } from "./auth";
import { createSlotRoutes } from "./slot-routes";
import type { CalendarStore } from "./calendar";
import { createCalendarRoutes } from "./calendar-routes";
import type { SlotStore } from "./slots";
import { toFactoryRunRecord, type LaunchRun } from "./model";
import { CreateGameRequestSchema, type LaunchJobRequest, type LaunchKind } from "./schemas";
import type { LaunchServiceStore } from "./store";

interface LaunchAppDependencies {
  config: LaunchAccess;
  /** What the health route reports, so a deploy can tell its own answers from its predecessor's. */
  deployment: { environment: string; version: string };
  identity: IdentityResolver;
  store: LaunchServiceStore;
  slots: SlotStore;
  calendar: CalendarStore;
  /** The registrar that executes runs: every run queued here arms it for the run's due time. */
  registrar: { armFor(dueAt: number): Promise<void> };
  /** The gameplay account a Realms account has on the shard slots launch on. */
  playerAccount: (realmsId: string) => Promise<string>;
}

const decodeBody = async <A>(context: Context, schema: Schema.ConstraintDecoder<A, never>): Promise<A> => {
  const payload = await context.req.json();
  return Effect.runPromise(Schema.decodeUnknownEffect(schema)(payload));
};

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
  const deleted = await store.delete(kind, environment, name);
  return deleted ? context.json({ deleted: true }) : context.json({ error: "Run is missing or active." }, 409);
};

const failedRunReport = (run: LaunchRun) => ({
  kind: run.kind,
  environment: run.environment,
  name: run.name,
  error: run.errorMessage ?? null,
  failedAt: run.updatedAt,
});

export const createLaunchApp = (dependencies: LaunchAppDependencies) => {
  const app = new Hono<LaunchAppEnv>();
  app.use("*", logger());
  app.use("/api/*", requireIdentity(dependencies.identity, dependencies.config));
  app.use("/api/factory/*", requireLauncher(dependencies.config));
  app.route("/api/factory/calendar", createCalendarRoutes(dependencies.calendar));
  app.route("/api/slots", createSlotRoutes(dependencies.slots, dependencies.playerAccount, dependencies.config));

  // A failed launch stays failed until a launcher continues it, a Frontier season included: the schedule creates the
  // season once and never requeues it. Health names every failed run so that wait is never silent.
  app.get("/api/factory/health", async (context) => {
    try {
      const failed = await dependencies.store.failed();
      return context.json({ service: "launch", ...dependencies.deployment, failedRuns: failed.map(failedRunReport) });
    } catch {
      return context.json({ status: "unavailable" }, 503);
    }
  });

  app.get("/api/factory/directory-games", async (context) => {
    try {
      return context.json({ chains: [await dependencies.store.playerDirectoryGames()] });
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

  app.post("/api/factory/runs", async (context) => {
    try {
      const request = await decodeBody(context, CreateGameRequestSchema);
      return respondWithRun(context, dependencies, "game", request);
    } catch (error) {
      return context.json({ error: String(error) }, 400);
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

  app.post("/api/factory/results/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies, "result", context.req.param("name")),
  );
  return app;
};
