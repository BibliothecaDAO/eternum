import { isGameEnvironmentId, type GameEnvironmentId } from "../../../config/shared/game-environments";
import { Effect, Schema } from "effect";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { LaunchServiceConfig } from "./config";
import { requireIdentity, requireLauncher, type IdentityResolver, type LaunchAppEnv } from "./auth";
import { createSlotRoutes } from "./slot-routes";
import type { SlotStore } from "./slots";
import { toFactoryRunRecord } from "./model";
import {
  CreateGameRequestSchema,
  CreateRotationRequestSchema,
  CreateSeriesRequestSchema,
  type LaunchJobRequest,
  type LaunchKind,
} from "./schemas";
import type { LaunchServiceStore } from "./store";

interface LaunchAppDependencies {
  config: Pick<LaunchServiceConfig, "allowedOrigins" | "allowAnyLauncher" | "launcherAllowlist">;
  identity: IdentityResolver;
  store: LaunchServiceStore;
  slots: SlotStore;
  verifyPlayer: (owner: string) => Promise<void>;
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
  store: LaunchServiceStore,
  kind: LaunchKind,
  request: LaunchJobRequest,
) => {
  try {
    const run = await store.enqueue(kind, request);
    return context.json(toFactoryRunRecord(run), 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return context.json({ error: message }, message.includes("already running") ? 409 : 500);
  }
};

const findRun = async (context: Context, store: LaunchServiceStore, kind: LaunchKind, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await store.find(kind, environment, name);
  return run ? context.json(toFactoryRunRecord(run)) : context.json({ error: "Launch run not found." }, 404);
};

const continueRun = async (context: Context, store: LaunchServiceStore, kind: LaunchKind, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await store.find(kind, environment, name);
  if (!run) return context.json({ error: "Launch run not found." }, 404);
  return respondWithRun(context, store, kind, run.request);
};

const deleteRun = async (context: Context, store: LaunchServiceStore, kind: LaunchKind, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const deleted = await store.delete(kind, environment, name);
  return deleted ? context.json({ deleted: true }) : context.json({ error: "Run is missing or active." }, 409);
};

const cancelRun = async (context: Context, store: LaunchServiceStore, kind: LaunchKind, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const cancelled = await store.cancel(kind, environment, name);
  return cancelled ? context.json({ cancelled: true }) : context.json({ error: "Run is missing or active." }, 409);
};

export const createLaunchApp = (dependencies: LaunchAppDependencies) => {
  const app = new Hono<LaunchAppEnv>();
  app.use("*", logger());
  app.use(
    "/api/*",
    cors({
      origin: (origin) => (dependencies.config.allowedOrigins.has(origin) ? origin : ""),
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use("/api/*", requireIdentity(dependencies.identity, dependencies.config));
  app.use("/api/factory/*", requireLauncher(dependencies.config));
  app.route("/api/slots", createSlotRoutes(dependencies.slots, dependencies.config, dependencies.verifyPlayer));

  app.get("/health", async (context) => {
    try {
      await dependencies.store.list("madara.blitz");
      return context.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch {
      return context.json({ status: "unavailable" }, 503);
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
      return respondWithRun(context, dependencies.store, "game", request);
    } catch (error) {
      return context.json({ error: String(error) }, 400);
    }
  });

  app.get("/api/factory/runs/:environment/:name", (context) =>
    findRun(context, dependencies.store, "game", context.req.param("name")),
  );
  app.post("/api/factory/runs/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies.store, "game", context.req.param("name")),
  );
  app.post("/api/factory/runs/:environment/:name/actions/delete", (context) =>
    deleteRun(context, dependencies.store, "game", context.req.param("name")),
  );

  app.post("/api/factory/series-runs", async (context) => {
    try {
      const request = await decodeBody(context, CreateSeriesRequestSchema);
      return respondWithRun(context, dependencies.store, "series", request);
    } catch (error) {
      return context.json({ error: String(error) }, 400);
    }
  });
  app.get("/api/factory/series-runs/:environment/:name", (context) =>
    findRun(context, dependencies.store, "series", context.req.param("name")),
  );
  app.post("/api/factory/series-runs/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies.store, "series", context.req.param("name")),
  );
  app.post("/api/factory/series-runs/:environment/:name/actions/cancel-auto-retry", (context) =>
    cancelRun(context, dependencies.store, "series", context.req.param("name")),
  );
  app.post("/api/factory/series-runs/:environment/:name/actions/delete", (context) =>
    deleteRun(context, dependencies.store, "series", context.req.param("name")),
  );

  app.post("/api/factory/rotation-runs", async (context) => {
    try {
      const request = await decodeBody(context, CreateRotationRequestSchema);
      return respondWithRun(context, dependencies.store, "rotation", request);
    } catch (error) {
      return context.json({ error: String(error) }, 400);
    }
  });
  app.get("/api/factory/rotation-runs/:environment/:name", (context) =>
    findRun(context, dependencies.store, "rotation", context.req.param("name")),
  );
  app.post("/api/factory/rotation-runs/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies.store, "rotation", context.req.param("name")),
  );
  app.post("/api/factory/rotation-runs/:environment/:name/actions/nudge", (context) =>
    continueRun(context, dependencies.store, "rotation", context.req.param("name")),
  );
  app.post("/api/factory/rotation-runs/:environment/:name/actions/cancel-auto-retry", (context) =>
    cancelRun(context, dependencies.store, "rotation", context.req.param("name")),
  );
  app.post("/api/factory/rotation-runs/:environment/:name/actions/delete", (context) =>
    deleteRun(context, dependencies.store, "rotation", context.req.param("name")),
  );

  return app;
};
