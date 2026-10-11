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
import { launcherOperatorRoutes, type OperatorLauncher } from "./launcher-routes";
import type { LaunchServiceStore } from "./store";

interface LaunchAppDependencies {
  config: { operatorToken: string };
  operatorLauncher: OperatorLauncher;
  /** What the version and health routes report, so a deploy can tell its own answers from its predecessor's. */
  deployment: { environment: string; version: string };
  store: LaunchServiceStore;
  slots: SlotStore;
  calendar: CalendarStore;
  /** The registrar that executes runs: every run queued here arms it for the run's due time. */
  registrar: { armFor(dueAt: number): Promise<void> };
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
  app.route("/api/factory/operator/launcher", launcherOperatorRoutes(dependencies.operatorLauncher));
  app.route("/api/factory/calendar", createCalendarRoutes(dependencies.calendar));
  app.route("/api/slots", createSlotRoutes(dependencies.slots));

  // The deploy verifies this route: it names the running code and reads nothing else, so the shard's state, which health
  // reports, cannot fail a deploy.
  app.get("/api/factory/version", (context) => context.json({ service: "launch", ...dependencies.deployment }));

  // The schedule never requeues a failed season; its operator must continue it. Health names every failed run.
  app.get("/api/factory/health", async (context) => {
    try {
      const [failed, stranded] = await Promise.all([
        dependencies.store.failed(),
        dependencies.store.pendingOtherChains(),
      ]);
      return context.json(
        {
          service: "launch",
          ...dependencies.deployment,
          failedRuns: failed.map(failedRunReport),
          strandedRuns: stranded.map(strandedRunReport),
        },
        stranded.length ? 503 : 200,
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

  app.post("/api/factory/results/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies, "result", context.req.param("name")),
  );
  return app;
};
