import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { LaunchExecutor } from "./executor";
import type { ClaimedLaunchRun } from "./model";
import { databaseLayer } from "./store";
import { createLaunchTestStore } from "./test-store";
import { processNextLaunch } from "./worker";

let database: Awaited<ReturnType<typeof createLaunchTestStore>>;
beforeEach(async () => {
  database = await createLaunchTestStore();
});
afterEach(async () => {
  await database.close();
});

const request = {
  environment: "madara.blitz" as const,
  gameName: "bltz-recovery-test",
};

describe("durable launch worker", () => {
  test("reclaims an expired lease without creating a second run", async () => {
    const store = database.store;
    const queued = await store.enqueue("game", request);
    const abandoned = await store.claim(1);
    expect(abandoned?.id).toBe(queued.id);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const recovered = await store.claim(60_000);
    expect(recovered).toMatchObject({ id: queued.id, attempts: 2, status: "running" });
    expect(await store.list("madara.blitz")).toHaveLength(1);
  });

  test("interrupts execution when a revoked lease is requeued and reclaimed without overwriting its new owner", async () => {
    const store = database.store;
    const queued = await store.enqueue("game", request);
    let interrupted = false;
    let successorLeaseToken: string | undefined;
    const executor = {
      execute: (run: ClaimedLaunchRun) =>
        Effect.promise(async () => {
          await store.retry(run.id, run.leaseToken, "lease revoked", 0);
          const successor = await store.claim(60_000);
          expect(successor).toMatchObject({ id: queued.id, attempts: 2, status: "running" });
          successorLeaseToken = successor!.leaseToken;
          expect(successorLeaseToken).not.toBe(run.leaseToken);
        }).pipe(
          Effect.uninterruptible,
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted = true;
            }),
          ),
        ),
    };
    const services = Layer.mergeAll(databaseLayer(store), Layer.succeed(LaunchExecutor, executor));

    await Effect.runPromise(processNextLaunch(300).pipe(Effect.provide(services)));

    expect(interrupted).toBe(true);
    expect(await store.find("game", "madara.blitz", request.gameName)).toMatchObject({
      id: queued.id,
      status: "running",
      attempts: 2,
      leaseToken: successorLeaseToken,
      errorMessage: "lease revoked",
    });
    expect(await store.list("madara.blitz")).toHaveLength(1);
  });

  test("persists the default start time once so retries cannot move it", async () => {
    const store = database.store;
    const queued = await store.enqueue("game", request);
    const persistedStart = "gameStartTime" in queued.request ? queued.request.gameStartTime : undefined;
    const abandoned = await store.claim(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const recovered = await store.claim(60_000);

    expect(abandoned?.request).toMatchObject({ gameStartTime: persistedStart });
    expect(recovered?.request).toMatchObject({ gameStartTime: persistedStart });
  });

  test("completes a claimed launch through the injected executor and store", async () => {
    const store = database.store;
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

    await Effect.runPromise(processNextLaunch(60_000).pipe(Effect.provide(services)));

    expect(await store.find("game", "madara.blitz", request.gameName)).toMatchObject({
      status: "complete",
      attempts: 1,
      summary: { gameId: 62 },
    });
  });
});
