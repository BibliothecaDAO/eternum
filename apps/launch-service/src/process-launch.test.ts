import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { LaunchExecutionFailure } from "./errors";
import { LaunchExecutor } from "./executor";
import { processNextLaunch } from "./process-launch";
import { GameNotEnded } from "./results";
import { D1LaunchStore, databaseLayer } from "./store";
import { createLaunchTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
let store: D1LaunchStore;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
  store = new D1LaunchStore(database.db);
});
afterEach(async () => {
  await database.close();
});

const request = {
  environment: "madara.blitz" as const,
  gameName: "bltz-recovery-test",
};

describe("the registrar's launch step", () => {
  test("persists the default start time once so retries cannot move it", async () => {
    const queued = await store.enqueue("game", request);
    const persistedStart = "gameStartTime" in queued.request ? queued.request.gameStartTime : undefined;
    const failing = Layer.mergeAll(
      databaseLayer(store),
      Layer.succeed(LaunchExecutor, {
        execute: (run) => Effect.fail(new LaunchExecutionFailure({ runId: run.id, cause: new Error("rpc down") })),
      }),
    );

    await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(failing)));
    const retried = await store.startNext(Date.now() + 60_000);

    expect(retried).toMatchObject({ id: queued.id, attempts: 2, errorMessage: "rpc down" });
    expect(retried?.request).toMatchObject({ gameStartTime: persistedStart });
  });

  test("defers a result job to the chain's end time without spending an attempt", async () => {
    await store.enqueue("result", { environment: "madara.blitz", gameName: "bltz-early", gameId: 4 });
    const services = Layer.mergeAll(
      databaseLayer(store),
      Layer.succeed(LaunchExecutor, {
        execute: (run) => Effect.fail(new LaunchExecutionFailure({ runId: run.id, cause: new GameNotEnded(90) })),
      }),
    );

    await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(services)));

    expect(await store.find("result", "madara.blitz", "bltz-early")).toMatchObject({ status: "queued", attempts: 0 });
    expect(await store.startNext(Date.now())).toBeNull();
    expect(await store.nextDue()).toBeGreaterThanOrEqual(Date.now() + 80_000);
  });

  test("completes a started launch through the injected executor and store", async () => {
    await store.enqueue("game", request);
    const executor = {
      execute: () =>
        Effect.succeed({
          environment: "madara.blitz" as const,
          chain: "madara" as const,
          gameType: "blitz" as const,
          gameName: request.gameName,
          startTime: 1,
          startTimeIso: "1970-01-01T00:00:01.000Z",
          rpcUrl: "http://rpc.test",
          configMode: "batched" as const,
          configSteps: [],
          dryRun: false,
          gameId: 62,
          finalizeAt: 3_000_000_000,
        }),
    };
    const services = Layer.mergeAll(databaseLayer(store), Layer.succeed(LaunchExecutor, executor));

    await Effect.runPromise(processNextLaunch(Date.now()).pipe(Effect.provide(services)));

    expect(await store.find("game", "madara.blitz", request.gameName)).toMatchObject({
      status: "complete",
      attempts: 1,
      summary: { gameId: 62 },
    });
  });
});
