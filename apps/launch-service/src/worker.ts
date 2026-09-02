import { Duration, Effect, Result } from "effect";
import { LaunchExecutor } from "./executor";
import { LaunchExecutionFailure } from "./errors";
import type { ClaimedLaunchRun } from "./model";
import { databaseOperation, LaunchDatabase } from "./store";

const errorMessage = (error: LaunchExecutionFailure): string =>
  error.cause instanceof Error ? error.cause.message : String(error.cause);

const heartbeat = (run: ClaimedLaunchRun, leaseMs: number) =>
  Effect.forever(
    Effect.sleep(Duration.millis(Math.max(50, Math.floor(leaseMs / 3)))).pipe(
      Effect.andThen(
        LaunchDatabase.pipe(
          Effect.flatMap((store) =>
            databaseOperation("heartbeat launch lease", () => store.heartbeat(run.id, run.leaseToken, leaseMs)),
          ),
          Effect.filterOrFail(
            (leaseActive) => leaseActive,
            () => new LaunchExecutionFailure({ runId: run.id, cause: "launch lease was lost" }),
          ),
        ),
      ),
    ),
  ).pipe(
    Effect.mapError((cause) =>
      cause instanceof LaunchExecutionFailure ? cause : new LaunchExecutionFailure({ runId: run.id, cause }),
    ),
  );

export const processNextLaunch = (leaseMs: number) =>
  Effect.gen(function* () {
    const store = yield* LaunchDatabase;
    const executor = yield* LaunchExecutor;
    const run = yield* databaseOperation("claim launch", () => store.claim(leaseMs));
    if (!run) return false;

    yield* Effect.logInfo("launch_claimed", {
      runId: run.id,
      kind: run.kind,
      name: run.name,
      attempt: run.attempts,
    });

    const result = yield* Effect.result(Effect.raceFirst(executor.execute(run, store), heartbeat(run, leaseMs)));

    if (Result.isSuccess(result)) {
      yield* databaseOperation("complete launch", () => store.complete(run.id, run.leaseToken, result.success));
      yield* Effect.logInfo("launch_completed", { runId: run.id, name: run.name });
      return true;
    }

    const message = errorMessage(result.failure);
    if (run.attempts < 3) {
      yield* databaseOperation("retry launch", () => store.retry(run.id, run.leaseToken, message, 5_000));
      yield* Effect.logWarning("launch_retry_queued", { runId: run.id, attempt: run.attempts, error: message });
    } else {
      yield* databaseOperation("fail launch", () => store.fail(run.id, run.leaseToken, message));
      yield* Effect.logError("launch_failed", { runId: run.id, attempt: run.attempts, error: message });
    }
    return true;
  });

export const launchWorkerLoop = (leaseMs: number, pollMs: number) =>
  Effect.forever(
    processNextLaunch(leaseMs).pipe(
      Effect.catchCause((cause) => Effect.logError("launch_worker_iteration_failed", { cause: String(cause) })),
      Effect.andThen(Effect.sleep(Duration.millis(pollMs))),
    ),
  );
