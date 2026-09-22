import { Effect, Fiber } from "effect";
import { serverEnv } from "../env";
import { WebPushSender } from "../web-push-sender";
import { PushSubscriptionStore } from "../push-subscription-store";
import { ownerOfGameplayAccount, verifyGameplayBindingChain } from "../binding";
import { NotificationOutbox } from "./outbox";
import { createNotificationSource } from "./source";
import { createAutomaticNotifier } from "./notifier";
import { resolveAutomaticNotificationConfig } from "./config";

const config = resolveAutomaticNotificationConfig(serverEnv);
const status = {
  enabled: config !== null,
  healthy: false,
  lastTickAt: null as number | null,
  lastResult: null as unknown,
};
export const automaticNotificationHealth = () => ({
  ...status,
  healthy: status.healthy && status.lastTickAt !== null && Date.now() - status.lastTickAt < 60_000,
});

/** Owned by the identity server process; interruption stops the loop without advancing an unfinished page. */
export function startAutomaticNotifications() {
  if (!config) return async () => {};
  const notifier = createAutomaticNotifier({
    config,
    source: createNotificationSource(config),
    ownerOf: ownerOfGameplayAccount,
    verifyChain: () => verifyGameplayBindingChain(config.chainId),
  });
  const tick = notifier.tick.pipe(
    Effect.provide(NotificationOutbox.layer),
    Effect.provide(PushSubscriptionStore.layer),
    Effect.provide(WebPushSender.layer),
  );
  const loop = Effect.forever(
    Effect.gen(function* () {
      const result = yield* tick;
      status.lastTickAt = Date.now();
      status.lastResult = result;
      status.healthy = !("unavailable" in result.history) && result.unavailable === 0;
      console.info(JSON.stringify(result));
    }).pipe(
      Effect.catch(() =>
        Effect.sync(() => {
          status.healthy = false;
          status.lastTickAt = Date.now();
          status.lastResult = { event: "automatic_notifications_unavailable" };
          console.error(JSON.stringify(status.lastResult));
        }),
      ),
      Effect.andThen(Effect.sleep("2 seconds")),
    ),
  );
  const fiber = Effect.runFork(loop);
  return async () => {
    await Effect.runPromise(Fiber.interrupt(fiber));
    status.healthy = false;
  };
}
