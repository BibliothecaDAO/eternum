import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class WorkerRequestError extends Data.TaggedError("WorkerRequestError")<{
  reason: "transport" | "timeout" | "reply" | "rejected";
  message: string;
  cause?: unknown;
}> {}

/** Own both ports until the reply, failure, timeout or caller cancellation. */
export function workerRequest<A>(
  worker: Pick<ServiceWorker, "postMessage">,
  message: unknown,
  reply: Schema.Codec<A, unknown>,
  timeoutMs: number,
  timeoutMessage: string,
): Effect.Effect<A, WorkerRequestError> {
  return Effect.scoped(
    Effect.gen(function* () {
      const channel = yield* Effect.acquireRelease(
        Effect.try({ try: () => new MessageChannel(), catch: transportError }),
        (channel) =>
          Effect.sync(() => {
            channel.port1.onmessage = null;
            channel.port1.onmessageerror = null;
            channel.port1.close();
            channel.port2.close();
          }),
      );
      return yield* Effect.callback<unknown, WorkerRequestError>((resume) => {
        channel.port1.onmessage = (event) => resume(Effect.succeed(event.data));
        channel.port1.onmessageerror = (event) => resume(Effect.fail(transportError(event)));
        try {
          worker.postMessage(message, [channel.port2]);
        } catch (cause) {
          resume(Effect.fail(transportError(cause)));
        }
      }).pipe(
        Effect.timeoutOrElse({
          duration: timeoutMs,
          orElse: () => Effect.fail(new WorkerRequestError({ reason: "timeout", message: timeoutMessage })),
        }),
        Effect.flatMap(Schema.decodeUnknownEffect(reply)),
        Effect.catchTag("SchemaError", (cause) =>
          Effect.fail(new WorkerRequestError({ reason: "reply", message: "Invalid worker reply", cause })),
        ),
      );
    }),
  );
}

function transportError(cause: unknown): WorkerRequestError {
  return new WorkerRequestError({ reason: "transport", message: "Worker communication failed", cause });
}
