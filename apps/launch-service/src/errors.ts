import { serviceFailure } from "@realms-world/value-ledger";
import { Data } from "effect";

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

/** Public diagnostics are fixed names; private logs retain the redacted underlying failure. */
export const launchFailure = (error: unknown) => {
  const cause = error instanceof DatabaseFailure ? error.cause : error;
  return serviceFailure(
    cause,
    [
      "ledger_head_unconfirmed",
      "invalid_ledger_slot",
      "ledger_launch_mutation_reverted",
      "invalid_ledger_integer",
      "invalid_ledger_bool",
      "invalid_u256_limb",
      "invalid_ledger_felt",
      "unlisted_or_inactive_shard",
      "wrong_launch_chain_or_slot",
    ],
    "launch_schedule_failed",
    [],
  );
};
