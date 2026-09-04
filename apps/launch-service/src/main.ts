import "dotenv/config";

import nodeProcess from "node:process";
import { Effect } from "effect";
import { createLaunchApp } from "./app";
import { createIdentityResolver } from "./auth";
import { readLaunchServiceConfig } from "./config";
import { createLaunchServiceLayer } from "./layers";
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

    const identity = createIdentityResolver(config.identityUrl);
    const services = createLaunchServiceLayer(config, store, identity);
    yield* Effect.forkScoped(launchWorkerLoop(config.leaseMs, config.pollMs).pipe(Effect.provide(services)));

    const app = createLaunchApp({ config, identity, store });
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
