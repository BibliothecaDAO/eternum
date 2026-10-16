import { computeScheduleDelayMs } from "@/hooks/automation-scheduler";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";

/** Owns the clock, configuration subscription and current pass until the runner unmounts. */
export const startAutomationScope = (
  run: (signal: AbortSignal, configChanged: boolean) => Promise<void | false>,
  subscribe?: (changed: () => void) => () => void,
): (() => void) =>
  Effect.runCallback(
    Effect.scoped(
      Effect.gen(function* () {
        const checks = yield* Queue.sliding<void>(1);
        let configChanged = false;
        if (subscribe) {
          yield* Effect.acquireRelease(
            Effect.sync(() =>
              subscribe(() => {
                configChanged = true;
                Queue.offerUnsafe(checks, undefined);
              }),
            ),
            (unsubscribe) => Effect.sync(unsubscribe),
          );
        }
        yield* Effect.forkScoped(
          Effect.forever(
            Effect.gen(function* () {
              yield* Effect.sleep(computeScheduleDelayMs(Date.now()));
              yield* Queue.offer(checks, undefined);
            }),
          ),
        );
        while (true) {
          yield* Queue.take(checks);
          const changed = configChanged;
          configChanged = false;
          const result = yield* Effect.tryPromise({
            try: (signal) => run(signal, changed),
            catch: (error) => error,
          }).pipe(Effect.catch((error) => Effect.sync(() => console.error("Automation pass unavailable", error))));
          if (result === false) return;
        }
      }),
    ),
  );
