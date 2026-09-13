import { createECDH } from "node:crypto";
import { Context, Data, Effect, Layer } from "effect";
import webpush from "web-push";
import { parseWebPushSubscription, type PushEnvelope, type WebPushSubscription } from "@bibliothecadao/notifications";
import { serverEnv } from "./env";

type PushEnvironment = {
  WEB_PUSH_ENABLED?: string | undefined;
  WEB_PUSH_VAPID_PUBLIC_KEY?: string | undefined;
  WEB_PUSH_VAPID_PRIVATE_KEY?: string | undefined;
  WEB_PUSH_VAPID_SUBJECT?: string | undefined;
};
export function resolveWebPushConfig(env: PushEnvironment) {
  if (env.WEB_PUSH_ENABLED && !["true", "false"].includes(env.WEB_PUSH_ENABLED))
    throw new Error("WEB_PUSH_ENABLED must be true or false");
  if (env.WEB_PUSH_ENABLED !== "true") return null;
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "",
    privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY ?? "",
    subject = env.WEB_PUSH_VAPID_SUBJECT ?? "";
  if (
    !/^[A-Za-z0-9_-]{87}$/.test(publicKey) ||
    !/^[A-Za-z0-9_-]{43}$/.test(privateKey) ||
    !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)
  )
    throw new Error("Web Push requires a VAPID key pair and contact subject");
  const key = createECDH("prime256v1");
  key.setPrivateKey(Buffer.from(privateKey, "base64url"));
  if (key.getPublicKey().toString("base64url") !== publicKey) throw new Error("VAPID keys do not match");
  return { publicKey, privateKey, subject };
}

export function createWebPushSender(
  config: ReturnType<typeof resolveWebPushConfig>,
  request: (url: string, init: RequestInit) => Promise<Response> = globalThis.fetch,
) {
  return {
    configuration: () =>
      config ? { enabled: true as const, publicKey: config.publicKey } : { enabled: false as const },
    send: (subscription: WebPushSubscription, envelope: PushEnvelope) =>
      Effect.tryPromise({
        try: async () => {
          if (!config) throw new Error("disabled");
          const validated = parseWebPushSubscription(subscription);
          const ttl = Math.ceil((envelope.notification.expiresAt - Date.now()) / 1000);
          if (ttl <= 0) throw new Error("expired");
          const details = webpush.generateRequestDetails(validated, JSON.stringify(envelope), {
            vapidDetails: config,
            TTL: Math.min(ttl, 120),
            urgency: "normal",
            contentEncoding: "aes128gcm",
          });
          const response = await request(validated.endpoint, {
            method: "POST",
            headers: details.headers as Record<string, string>,
            body: new Uint8Array(details.body!),
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          });
          // Provider bodies/URLs may contain subscription credentials; never expose them in logs or API errors.
          await response.body?.cancel();
          if (response.status === 404 || response.status === 410) return "expired" as const;
          if (!response.ok) throw new Error("provider_rejected");
          return "accepted" as const;
        },
        catch: () => new PushSendError(),
      }),
  };
}
class PushSendError extends Data.TaggedError("PushSendError")<{}> {}
export class WebPushSender extends Context.Service<WebPushSender, ReturnType<typeof createWebPushSender>>()(
  "WebPushSender",
) {
  // Validate enabled deployments at startup; disabled deployments do not need VAPID credentials.
  static readonly configuration = resolveWebPushConfig(serverEnv);
  static readonly layer = Layer.sync(WebPushSender, () => createWebPushSender(WebPushSender.configuration));
}
