import { Data } from "effect";

export class BoundaryDecodeError extends Data.TaggedError("BoundaryDecodeError")<{
  readonly boundary: string;
  readonly cause: unknown;
}> {}

export class IdentityUnavailable extends Data.TaggedError("IdentityUnavailable")<{
  readonly cause: unknown;
}> {}

export class DatabaseFailure extends Data.TaggedError("DatabaseFailure")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export class LaunchExecutionFailure extends Data.TaggedError("LaunchExecutionFailure")<{
  readonly runId: string;
  readonly cause: unknown;
}> {}

/**
 * A step's failure as the run record shows it: an Error's message (a starknet RPC error's carries its code) with the
 * cause it wraps, or an error event's message or wrapped error, never "[object …]".
 */
export const describeFailure = (cause: unknown): string => {
  if (cause instanceof Error) {
    const wrapped = cause.cause === undefined ? "" : `: ${describeFailure(cause.cause)}`;
    return `${cause.message || cause.name}${wrapped}`;
  }
  if (typeof cause === "object" && cause !== null) {
    const event = cause as { error?: unknown; message?: unknown; type?: unknown };
    if (event.error !== undefined && event.error !== null) return describeFailure(event.error);
    if (typeof event.message === "string" && event.message.length > 0) return event.message;
    if (typeof event.type === "string") return `${event.type} event with no message`;
  }
  return String(cause);
};
