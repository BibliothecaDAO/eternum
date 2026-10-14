import * as Data from "effect/Data";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

class NotificationValidationError extends Data.TaggedError("NotificationValidationError")<{ message: string }> {}

export const notificationText = (max: number) =>
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(max), Schema.isPattern(/^[^\u0000-\u001f\u007f]*$/));
export const pushOwnerSchema = Schema.String.check(Schema.isPattern(/^0x[0-9a-f]{1,64}$/));
export const pushDeviceIdSchema = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
);
export const notificationRecord = Schema.declare<Record<string, unknown>>(
  (value): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value),
);

/** Preserve public error codes while Schema owns validation at each boundary. */
export function decodeNotification<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown,
  message: string,
  excess: "error" | "ignore" = "error",
): S["Type"] {
  const result = Schema.decodeUnknownResult(schema, { onExcessProperty: excess })(value);
  if (Result.isFailure(result)) throw new NotificationValidationError({ message });
  return result.success;
}
