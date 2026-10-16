import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import { syncPushGameForeground } from "./push-notification-client";

const FOREGROUND_EVENTS = [
  "focus",
  "online",
  "pageshow",
  "pagehide",
  "popstate",
  "urlChanged",
  "pushRegistrationChanged",
] as const;

class ForegroundSyncError extends Data.TaggedError("ForegroundSyncError")<{ cause: unknown }> {}

/** One pending refresh coalesces events while the current server lease request completes. */
export function startPushForegroundLifecycle(owner: string): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  return Effect.runCallback(
    Effect.scoped(
      Effect.gen(function* () {
        const requests = yield* Queue.sliding<void>(1);
        const requestSync = () => {
          Queue.offerUnsafe(requests, undefined);
        };
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            document.addEventListener("visibilitychange", requestSync);
            for (const event of FOREGROUND_EVENTS) window.addEventListener(event, requestSync);
          }),
          () =>
            Effect.sync(() => {
              document.removeEventListener("visibilitychange", requestSync);
              for (const event of FOREGROUND_EVENTS) window.removeEventListener(event, requestSync);
            }),
        );
        yield* Effect.forkScoped(Effect.sync(requestSync).pipe(Effect.repeat(Schedule.spaced(20_000))), {
          startImmediately: true,
        });
        let reportedFailure = false;
        const refresh = Effect.tryPromise({
          try: (signal) => syncPushGameForeground(owner, signal),
          catch: (cause) => new ForegroundSyncError({ cause }),
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              reportedFailure = false;
            }),
          ),
          Effect.catch(() =>
            Effect.sync(() => {
              if (!reportedFailure) console.warn("push_game_foreground_sync_failed");
              reportedFailure = true;
            }),
          ),
        );
        yield* Queue.take(requests).pipe(Effect.andThen(refresh), Effect.forever);
      }),
    ),
  );
}
