import type { LocalNotificationPayload } from "@bibliothecadao/notifications";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { workerRequest, WorkerRequestError } from "./worker-request";
import { isAppleMobile, isInstalledPwa } from "./browser-capabilities";

export function localNotificationCapability(): string | null {
  if (isAppleMobile() && !isInstalledPwa()) return "Install the game to your Home Screen.";
  if (!window.isSecureContext || typeof Notification === "undefined" || !("serviceWorker" in navigator))
    return "Device notifications are unavailable in this browser.";
  if (Notification.permission === "denied") return "Notifications are blocked in this browser.";
  return null;
}

const deviceSchema = Schema.Struct({ owner: Schema.String, token: Schema.String, enabledAt: Schema.Int });
const pushDeviceSchema = Schema.Struct({
  ...deviceSchema.fields,
  id: Schema.String,
  state: Schema.Literals(["preparing", "active", "revoking"]),
  automatic: Schema.optional(Schema.Struct({ acknowledged: Schema.Boolean })),
});
const deliverySchema = Schema.Literals(["game-changed", "suppressed", "foreground", "shown"]);
const replies = {
  status: Schema.NullOr(deviceSchema),
  enable: deviceSchema,
  disable: Schema.Null,
  "push-status": Schema.NullOr(pushDeviceSchema),
  "prepare-push": pushDeviceSchema,
  "revoke-push": Schema.NullOr(pushDeviceSchema),
  "activate-push": Schema.Null,
  "forget-push": Schema.Null,
  "prepare-automatic": Schema.Null,
  "acknowledge-automatic": Schema.Null,
  "game-foreground-status": Schema.Boolean,
  "push-capabilities": Schema.Struct({
    automaticGameAlerts: Schema.Boolean,
    directMessageAlerts: Schema.Boolean,
    gameForegroundLease: Schema.Boolean,
  }),
  deliver: deliverySchema,
  test: deliverySchema,
};

export function notificationWorkerRequest<A extends keyof typeof replies>(
  owner: string,
  action: A,
  input: { payload?: LocalNotificationPayload; token?: string; id?: string; source?: unknown } = {},
  signal?: AbortSignal,
): Promise<(typeof replies)[A]["Type"]> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const registration = yield* Effect.tryPromise({
        try: () => navigator.serviceWorker.getRegistration("/"),
        catch: (cause) =>
          new WorkerRequestError({ reason: "transport", message: "Could not find the game worker", cause }),
      });
      const worker = registration?.active;
      if (!worker)
        return yield* Effect.fail(
          new WorkerRequestError({
            reason: "transport",
            message: "The game worker is not ready. Install the latest game update, then reload.",
          }),
        );
      return yield* requestNotificationReply<(typeof replies)[A]["Type"]>(
        worker,
        { type: "GAME_NOTIFICATION", owner, action, ...input },
        replies[action],
      );
    }),
    { signal },
  );
}

function requestNotificationReply<A>(
  worker: ServiceWorker,
  message: unknown,
  value: Schema.Codec<A, unknown>,
): Effect.Effect<A, WorkerRequestError> {
  const reply = Schema.Union([
    Schema.Struct({ ok: Schema.Literal(true), value }),
    Schema.Struct({ ok: Schema.Literal(false), error: Schema.String }),
  ]);
  return workerRequest(worker, message, reply, 5_000, "The game worker did not respond.").pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.succeed(response.value)
        : Effect.fail(new WorkerRequestError({ reason: "rejected", message: response.error })),
    ),
  );
}

export const readLocalNotificationDevice = (owner: string) => notificationWorkerRequest(owner, "status");

/** A delivery that failed in the background has no surface of its own: the operator reads it in the console. */
export function reportNotificationDeliveryError(error: unknown): void {
  console.error("notification_delivery_failed", { error: error instanceof Error ? error.message : error });
}
