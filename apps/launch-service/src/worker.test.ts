import { Effect, Layer } from "effect";
import { describe, expect, test } from "vitest";
import { LaunchExecutor } from "./executor";
import { databaseLayer } from "./store";
import { InMemoryLaunchStore } from "./test-store";
import { processNextLaunch } from "./worker";

const request = {
  environment: "madara.blitz" as const,
  gameName: "bltz-recovery-test",
};

describe("durable launch worker", () => {
  test("keeps repeated rotation ticks to one durable job", async () => {
    const store = new InMemoryLaunchStore();
    const rotation = {
      environment: "madara.blitz" as const,
      rotationName: "daily-blitz",
      firstGameStartTime: "2026-09-01T17:00:00.000Z",
      gameIntervalMinutes: 60,
      maxGames: 8,
      evaluationIntervalMinutes: 30,
    };

    await store.enqueue("rotation", rotation);
    await store.enqueue("rotation", rotation);

    expect(store.runs.size).toBe(1);
  });

  test("reclaims an expired lease without creating a second run", async () => {
    const store = new InMemoryLaunchStore();
    const queued = await store.enqueue("game", request);
    const abandoned = await store.claim(1);
    expect(abandoned?.id).toBe(queued.id);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const recovered = await store.claim(60_000);
    expect(recovered).toMatchObject({ id: queued.id, attempts: 2, status: "running" });
    expect(store.runs.size).toBe(1);
  });

  test("persists the default start time once so retries cannot move it", async () => {
    const store = new InMemoryLaunchStore();
    const queued = await store.enqueue("game", request);
    const persistedStart = "gameStartTime" in queued.request ? queued.request.gameStartTime : undefined;
    const abandoned = await store.claim(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const recovered = await store.claim(60_000);

    expect(abandoned?.request).toMatchObject({ gameStartTime: persistedStart });
    expect(recovered?.request).toMatchObject({ gameStartTime: persistedStart });
  });

  test("completes a claimed launch through the injected executor and store", async () => {
    const store = new InMemoryLaunchStore();
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
        }),
    };
    const services = Layer.mergeAll(databaseLayer(store), Layer.succeed(LaunchExecutor, executor));

    await Effect.runPromise(processNextLaunch(60_000).pipe(Effect.provide(services)));

    expect(await store.find("game", "madara.blitz", request.gameName)).toMatchObject({
      status: "complete",
      attempts: 1,
      summary: { gameId: 62 },
    });
  });

  test("interrupts execution and requeues when the worker loses its lease", async () => {
    const store = new InMemoryLaunchStore();
    await store.enqueue("game", request);
    store.heartbeat = async () => false;
    const services = Layer.mergeAll(
      databaseLayer(store),
      Layer.succeed(LaunchExecutor, { execute: () => Effect.never }),
    );

    await Effect.runPromise(processNextLaunch(30).pipe(Effect.provide(services)));

    expect(await store.find("game", "madara.blitz", request.gameName)).toMatchObject({
      status: "queued",
      attempts: 1,
      errorMessage: "launch lease was lost",
    });
  });
});
