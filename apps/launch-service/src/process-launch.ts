import { RegistrationOpen } from "./blitz-roster";
import { Effect, Result } from "effect";
import { describeFailure } from "./errors";
import { LaunchExecutor } from "./executor";
import { GameNotEnded } from "./results";
import { databaseOperation, LaunchDatabase } from "./store";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

export const processNextLaunch = (now: number) =>
  Effect.gen(function* () {
    const store = yield* LaunchDatabase;
    const executor = yield* LaunchExecutor;
    const run = yield* databaseOperation("start launch", () => store.startNext(now));
    if (!run) return false;
    if (run.attempts > MAX_ATTEMPTS) {
      const message = `Launch interrupted after ${run.attempts - 1} attempts`;
      yield* databaseOperation("fail interrupted launch", () => store.fail(run.id, message));
      yield* Effect.logError("launch_failed", { runId: run.id, error: message });
      return true;
    }

    yield* Effect.logInfo("launch_started", { runId: run.id, kind: run.kind, name: run.name, attempt: run.attempts });

    const result = yield* Effect.result(executor.execute(run, store));

    if (Result.isSuccess(result)) {
      yield* databaseOperation("complete launch", () => store.complete(run.id, result.success));
      yield* Effect.logInfo("launch_completed", { runId: run.id, name: run.name });
      return true;
    }

    if (result.failure.cause instanceof GameNotEnded || result.failure.cause instanceof RegistrationOpen) {
      const cause = result.failure.cause;
      const delayMs = (cause instanceof GameNotEnded ? cause.secondsUntilEnd : cause.secondsUntilClose) * 1_000;
      yield* databaseOperation("defer launch", () => store.defer(run.id, delayMs));
      yield* Effect.logInfo("launch_deferred", { runId: run.id, kind: run.kind, name: run.name, delayMs });
      return true;
    }

    const message = describeFailure(result.failure.cause);
    if (run.attempts < MAX_ATTEMPTS) {
      yield* databaseOperation("retry launch", () => store.retry(run.id, message, RETRY_DELAY_MS));
      yield* Effect.logWarning("launch_retry_queued", { runId: run.id, attempt: run.attempts, error: message });
    } else {
      yield* databaseOperation("fail launch", () => store.fail(run.id, message));
      yield* Effect.logError("launch_failed", { runId: run.id, attempt: run.attempts, error: message });
    }
    return true;
  });
