import { serviceFailure } from "@realms-world/value-ledger";
import { RegistrationOpen } from "./blitz-roster";
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
  const diagnostic = serviceFailure(
    cause,
    [
      "ledger_head_unconfirmed",
      "registration_head_changed",
      "invalid_ledger_slot",
      "invalid_registration_offset",
      "invalid_registration_page",
      "duplicate_registered_wallet",
      "registration_page_changed",
      "registration_history_incomplete",
      "registration_identity_page_incomplete",
      "registration_identity_page_too_large",
      "invalid_registration_time",
      "ledger_launch_mutation_reverted",
      "ledger_slot_window_differs",
      "ledger_slot_not_recorded",
      "ledger_season_missing_or_ambiguous",
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
  return cause instanceof RegistrationOpen
    ? { ...diagnostic, code: "registration_open", secondsUntilClose: cause.secondsUntilClose }
    : { ...diagnostic, secondsUntilClose: undefined };
};
