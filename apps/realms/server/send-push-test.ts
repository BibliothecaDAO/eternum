import { Effect } from "effect";
import { isPushDeviceId, isPushOwner } from "@bibliothecadao/notifications";
import { sendPushTest } from "./push-notifications";
import { PushSubscriptionStore } from "./push-subscription-store";
import { WebPushSender } from "./web-push-sender";

const [owner, subscriptionId, target] = process.argv.slice(2);
if (!isPushOwner(owner) || !isPushDeviceId(subscriptionId) || !target)
  throw new Error("Usage: push:test <owner> <subscription-id> </enter/chain/game>");
const result = await Effect.runPromise(
  sendPushTest(owner, subscriptionId, target).pipe(
    Effect.provide(PushSubscriptionStore.layer),
    Effect.provide(WebPushSender.layer),
    Effect.catch(() => Effect.succeed("failed")),
  ),
);
console.log(JSON.stringify({ operation: "push-test", subscriptionId, result }));
if (result !== "accepted") process.exitCode = 1;
