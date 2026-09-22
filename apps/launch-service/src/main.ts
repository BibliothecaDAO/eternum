import "dotenv/config";

import { createRosterVerifier } from "../../../config/deployer/clean/registrar/calls";
import nodeProcess from "node:process";
import { Effect } from "effect";
import { createLaunchApp } from "./app";
import { createIdentityResolver } from "./auth";
import { readLaunchServiceConfig } from "./config";
import { createLaunchServiceLayer } from "./layers";
import { scheduleFrontierSeason } from "./schedule";
import { PostgresSlotStore } from "./slot-store";
import { PostgresLaunchStore } from "./store";
import { launchWorkerLoop } from "./worker";

const waitForShutdown = Effect.callback<void>((resume) => {
  const shutdown = () => resume(Effect.void);
  const signals = nodeProcess as unknown as {
    once(signal: string, listener: () => void): void;
    off(signal: string, listener: () => void): void;
  };
  signals.once("SIGINT", shutdown);
  signals.once("SIGTERM", shutdown);
  return Effect.sync(() => {
    signals.off("SIGINT", shutdown);
    signals.off("SIGTERM", shutdown);
  });
});

const scheduleSeason = (store: PostgresLaunchStore, seasonStart: string | undefined) =>
  seasonStart
    ? Effect.promise(() => scheduleFrontierSeason(store, seasonStart)).pipe(
        Effect.flatMap((run) => Effect.logInfo("frontier_season_scheduled", { name: run.name, status: run.status })),
      )
    : Effect.logWarning("frontier_season_unscheduled", { reason: "FRONTIER_SEASON_START is not set" });

const program = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* readLaunchServiceConfig();
    const store = new PostgresLaunchStore(config.databaseUrl);
    yield* Effect.acquireRelease(
      Effect.promise(async () => {
        await store.initialize();
        return store;
      }),
      (database) => Effect.promise(() => database.close()),
    );

    yield* scheduleSeason(store, config.frontierSeasonStart);
    const slots = new PostgresSlotStore(store.pool);
    const identity = createIdentityResolver(config.identityUrl);
    const services = createLaunchServiceLayer(config, store, identity);
    yield* Effect.forkScoped(launchWorkerLoop(config.leaseMs, config.pollMs, slots).pipe(Effect.provide(services)));

    const app = createLaunchApp({
      config,
      identity,
      store,
      slots,
      verifyPlayer: createRosterVerifier(config.rpcUrl, config.manifestPath),
    });
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          port: config.port,
          fetch: app.fetch,
        }),
      ),
      (activeServer) => Effect.sync(() => activeServer.stop(true)),
    );

    yield* Effect.logInfo("launch_service_started", { port: server.port });
    yield* waitForShutdown;
  }),
);

Effect.runPromise(program).catch((error) => {
  console.error("launch_service_failed", error);
  process.exitCode = 1;
});
