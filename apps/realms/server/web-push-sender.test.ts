import { createECDH, randomBytes } from "node:crypto";
import { Effect } from "effect";
import webpush from "web-push";
import { expect, it, vi } from "vitest";
vi.mock("./env", () => ({ serverEnv: {} }));
import { createWebPushSender, resolveWebPushConfig } from "./web-push-sender";

const vapid = webpush.generateVAPIDKeys();
const config = { ...vapid, subject: "mailto:ops@realms.party" };
const clientKey = createECDH("prime256v1");
clientKey.generateKeys();
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: clientKey.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
};
const envelope = {
  version: 1 as const,
  subscriptionId: "11111111-1111-4111-8111-111111111111",
  notification: {
    version: 1 as const,
    id: "test",
    owner: "0x1",
    title: "Test",
    body: "Secret message",
    target: "/enter/madara/game",
    createdAt: Date.now(),
    expiresAt: Date.now() + 120_000,
  },
};
it("requires matching credentials only for enabled deployments", () => {
  expect(resolveWebPushConfig({})).toBeNull();
  expect(() => resolveWebPushConfig({ WEB_PUSH_ENABLED: "yes" })).toThrow();
  expect(() => resolveWebPushConfig({ WEB_PUSH_ENABLED: "true" })).toThrow();
  expect(
    resolveWebPushConfig({
      WEB_PUSH_ENABLED: "true",
      WEB_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey,
      WEB_PUSH_VAPID_SUBJECT: config.subject,
    }),
  ).toEqual(config);
  expect(() =>
    resolveWebPushConfig({
      WEB_PUSH_ENABLED: "true",
      WEB_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: webpush.generateVAPIDKeys().privateKey,
      WEB_PUSH_VAPID_SUBJECT: config.subject,
    }),
  ).toThrow();
});
it("encrypts the payload and signs a bounded request without redirects", async () => {
  const request = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
  const sender = createWebPushSender(config, request);
  expect(await Effect.runPromise(sender.send(subscription, envelope))).toBe("accepted");
  const [url, options] = request.mock.calls[0]!;
  expect(url).toBe(subscription.endpoint);
  expect(options.redirect).toBe("error");
  expect(options.headers["Content-Encoding"]).toBe("aes128gcm");
  expect(options.headers.Authorization).toMatch(/^vapid /);
  expect(Number(options.headers.TTL)).toBeLessThanOrEqual(120);
  expect(Buffer.from(options.body).includes(Buffer.from("Secret message"))).toBe(false);
});
it.each([404, 410])("reports expired subscription for %i", async (status) => {
  expect(
    await Effect.runPromise(
      createWebPushSender(config, vi.fn().mockResolvedValue(new Response(null, { status }))).send(
        subscription,
        envelope,
      ),
    ),
  ).toBe("expired");
});
it("fails closed on provider errors, disabled sending, and untrusted stored endpoints", async () => {
  const request = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  const sender = createWebPushSender(config, request);
  await expect(Effect.runPromise(sender.send(subscription, envelope))).rejects.toMatchObject({ _tag: "PushSendError" });
  request.mockClear();
  await expect(
    Effect.runPromise(sender.send({ ...subscription, endpoint: "https://127.0.0.1/secret" }, envelope)),
  ).rejects.toThrow();
  await expect(Effect.runPromise(createWebPushSender(null, request).send(subscription, envelope))).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
