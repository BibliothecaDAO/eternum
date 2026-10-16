import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { workerRequest } from "./worker-request";

type UpdateReady = (apply: () => Promise<void>) => void;
class UpdateError extends Data.TaggedError("UpdateError")<{ message: string; cause?: unknown }> {}

/** Offers each different release once. Only the accepting page chooses when to reload. */
export function registerGameServiceWorker(runningRelease: string, onUpdateReady: UpdateReady): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  const lifecycle = Effect.gen(function* () {
    const registration = yield* Effect.tryPromise({
      try: () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }),
      catch: (cause) => new UpdateError({ message: "Worker registration failed", cause }),
    });
    const signal = yield* Effect.abortSignal;
    const offerUpdate = createUpdateOffer(registration, runningRelease, onUpdateReady, signal);
    yield* Effect.forkScoped(observeInstallations(registration).pipe(Stream.runForEach(() => offerUpdate)));
    yield* Effect.forkScoped(
      Stream.fromEventListener(window, "focus").pipe(
        Stream.runForEach(() => checkForUpdate(registration, offerUpdate)),
      ),
    );
    yield* Effect.never;
  });
  return Effect.runCallback(
    Effect.scoped(lifecycle).pipe(Effect.catch((error) => Effect.sync(() => reportRegistrationFailure(error)))),
  );
}

function createUpdateOffer(
  registration: ServiceWorkerRegistration,
  runningRelease: string,
  onUpdateReady: UpdateReady,
  signal: AbortSignal,
): Effect.Effect<void> {
  let consideredWorker: ServiceWorker | null = null;
  return Effect.gen(function* () {
    const waiting = registration.active ? registration.waiting : null;
    if (!waiting || waiting === consideredWorker) return;
    consideredWorker = waiting;
    yield* workerRequest(
      waiting,
      { type: "RELEASE" },
      Schema.NullOr(Schema.String),
      3_000,
      "Worker release query timed out",
    ).pipe(
      Effect.tap((release) =>
        Effect.sync(() => {
          if (registration.waiting === waiting && release !== runningRelease) {
            onUpdateReady(() => Effect.runPromise(activateUpdate(waiting), { signal }));
          }
        }),
      ),
      Effect.catch((error) =>
        Effect.sync(() => {
          if (consideredWorker === waiting) consideredWorker = null;
          reportRegistrationFailure(error);
        }),
      ),
    );
  });
}

function observeInstallations(registration: ServiceWorkerRegistration): Stream.Stream<unknown> {
  return Stream.merge(Stream.make(null), Stream.fromEventListener(registration, "updatefound")).pipe(
    Stream.switchMap(() =>
      registration.installing
        ? Stream.merge(Stream.make(null), Stream.fromEventListener(registration.installing, "statechange"))
        : Stream.make(null),
    ),
  );
}

function checkForUpdate(
  registration: ServiceWorkerRegistration,
  offerUpdate: Effect.Effect<void>,
): Effect.Effect<void> {
  if (!navigator.onLine) return Effect.void;
  return Effect.tryPromise({
    try: () => registration.update(),
    catch: (cause) => new UpdateError({ message: "Worker update check failed", cause }),
  }).pipe(
    Effect.andThen(offerUpdate),
    Effect.catch((error) => Effect.sync(() => reportRegistrationFailure(error))),
  );
}

function activateUpdate(waiting: ServiceWorker): Effect.Effect<void, UpdateError> {
  return Effect.callback<void, UpdateError>((resume) => {
    const cleanup = Effect.sync(() => waiting.removeEventListener("statechange", changed));
    const complete = (result: Effect.Effect<void, UpdateError>) => resume(Effect.ensuring(result, cleanup));
    const changed = () => {
      if (waiting.state === "activated") complete(Effect.void);
      else if (waiting.state === "redundant")
        complete(Effect.fail(new UpdateError({ message: "Update was superseded" })));
    };
    waiting.addEventListener("statechange", changed);
    if (waiting.state === "activated" || waiting.state === "redundant") changed();
    else {
      try {
        waiting.postMessage({ type: "SKIP_WAITING" });
        changed();
      } catch (cause) {
        complete(Effect.fail(new UpdateError({ message: "Could not activate update", cause })));
      }
    }
    return cleanup;
  }).pipe(
    Effect.timeoutOrElse({
      duration: 10_000,
      orElse: () => Effect.fail(new UpdateError({ message: "Update activation timed out" })),
    }),
  );
}

function reportRegistrationFailure(error: unknown): void {
  console.error("pwa_registration_failed", error);
}
