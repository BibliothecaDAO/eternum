import { CalendarConflict } from "./calendar";
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
import { testnetRequest, TestnetRefused, type CreateGameRequest, type TestnetInput } from "./schemas";
import type { LaunchServiceStore } from "./store";
import type { RegisteredShard } from "@realms-world/value-ledger";
import { readThroughDependency } from "@realms-world/chain";
import {
  isRegisteredShard,
  isReleaseIdentity,
  RELEASE_REFUSALS,
  type ReleaseIdentity,
  type ReleaseReport,
} from "./release";

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
    joinFailure(): Promise<JoinFailure | null>;
    wakeAt(): Promise<number | null>;
    applyRelease(release: ReleaseIdentity | null, shard: RegisteredShard | null): Promise<ReleaseReport>;
  };
}

const readEnvironment = (value: string | undefined): GameEnvironmentId => {
  if (!value || !isGameEnvironmentId(value)) throw new Error("Unsupported game environment");
  return value;
};

const readTestnetInput = (body: unknown): TestnetInput | null => {
  const { startsAt, endsAt, speed = 1 } = (body ?? {}) as { startsAt?: unknown; endsAt?: unknown; speed?: unknown };
  const start = typeof startsAt === "string" ? Date.parse(startsAt) : Number.NaN;
  const end = typeof endsAt === "string" ? Date.parse(endsAt) : Number.NaN;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(speed)) return null;
  return { startsAt: start, endsAt: end, speed: speed as number };
};

const respondWithTestnet = async (
  context: Context,
  dependencies: Pick<LaunchAppDependencies, "store" | "registrar" | "deployment">,
) => {
  const input = readTestnetInput(await context.req.json().catch(() => null));
  if (!input) return context.json({ error: "invalid_testnet" }, 400);
  try {
    return await respondWithRun(context, dependencies, testnetRequest(input, dependencies.deployment.environment));
  } catch (error) {
    if (error instanceof TestnetRefused) return context.json({ error: error.message }, 403);
    if (error instanceof CalendarConflict) return context.json({ error: error.message }, 409);
    throw error;
  }
};

const respondWithRun = async (
  context: Context,
  { store, registrar }: Pick<LaunchAppDependencies, "store" | "registrar">,
  request: CreateGameRequest,
) => {
  try {
    const run = await store.enqueue(request);
    // A queued run is due now.
    await registrar.armFor(Date.now());
    return context.json(toFactoryRunRecord(run), 202);
  } catch (error) {
    return context.json(
      { error: error instanceof Error ? error.message : String(error) },
      error instanceof CalendarConflict ? 409 : 500,
    );
  }
};

const findRun = async (context: Context, store: LaunchServiceStore, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await store.find(environment, name);
  return run ? context.json(toFactoryRunRecord(run)) : context.json({ error: "Launch run not found." }, 404);
};

const continueRun = async (
  context: Context,
  dependencies: Pick<LaunchAppDependencies, "store" | "registrar">,
  name: string,
) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await dependencies.store.find(environment, name);
  if (!run) return context.json({ error: "Launch run not found." }, 404);
  return respondWithRun(context, dependencies, run.request);
};

const deleteRun = async (context: Context, store: LaunchServiceStore, name: string) => {
  const environment = readEnvironment(context.req.param("environment"));
  const run = await store.find(environment, name);
  if (!run) return context.json({ error: "Launch run not found." }, 409);
  const deleted = await store.delete(environment, name);
  return deleted
    ? context.json({ deleted: true })
    : context.json({ error: "Run is missing, active, complete, or a calendar season." }, 409);
};

const readHealthDependency = <Value>(name: string, read: () => Promise<Value>) =>
  readThroughDependency(name, read, (error) => {
    console.error("factory_health_dependency_failed", name, error);
    return `${name}_unavailable`;
  });

const failedRunReport = (run: LaunchRun) => ({
  environment: run.environment,
  name: run.name,
  error: run.errorMessage ?? null,
  failedAt: run.updatedAt,
});

const strandedRunReport = ({ chainId, environment, name, status }: LaunchRun) => ({
  chainId,
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
    const now = Date.now();
    const [runs, registrar] = await Promise.all([
      readHealthDependency("store", () => Promise.all([dependencies.store.failed(), dependencies.store.pending()])),
      readHealthDependency("registrar", () =>
        Promise.all([dependencies.registrar.joinFailure(), dependencies.registrar.wakeAt()]),
      ),
    ]);
    const identity = { service: "launch", ...dependencies.deployment };
    const named = { dependencies: [runs.dependency, registrar.dependency] };
    if (!runs.value || !registrar.value) return context.json({ ...identity, ...named }, 503);
    const [failed, pending] = runs.value;
    const [joinFailure, wakeAt] = registrar.value;
    const stranded = pending.filter(
      (run) => (run.status === "running" || Date.parse(run.dueAt) <= now) && (wakeAt === null || wakeAt > now),
    );
    return context.json(
      {
        ...identity,
        ...named,
        failedRuns: failed.map(failedRunReport),
        joinFailure,
        strandedRuns: stranded.map(strandedRunReport),
      },
      failed.length || stranded.length || joinFailure ? 503 : 200,
    );
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
    findRun(context, dependencies.store, context.req.param("name")),
  );
  app.post("/api/factory/runs/:environment/:name/actions/continue", (context) =>
    continueRun(context, dependencies, context.req.param("name")),
  );
  app.post("/api/factory/runs/:environment/:name/actions/delete", (context) =>
    deleteRun(context, dependencies.store, context.req.param("name")),
  );
  app.post("/api/factory/testnet-games", (context) => respondWithTestnet(context, dependencies));

  // The Cloudflare deploy's release step: the running Frontier games take the release its commit ships, as its box
  // build baked it, before its client goes live. A refusal names its reason; a rerun on games already there sends
  // nothing.
  app.post("/api/factory/release", async (context) => {
    const body = (await context.req.json().catch(() => null)) as { release?: unknown; shard?: unknown } | null;
    const release = body?.release;
    const shard = body?.shard;
    if ((release !== null && !isReleaseIdentity(release)) || (shard !== null && !isRegisteredShard(shard)))
      return context.json({ error: "invalid_release" }, 400);
    try {
      return context.json(await dependencies.registrar.applyRelease(release, shard));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if ((RELEASE_REFUSALS as readonly string[]).includes(message)) return context.json({ error: message }, 409);
      console.error("release_apply_failed", error);
      return context.json({ error: "release_apply_failed" }, 503);
    }
  });
  return app;
};
